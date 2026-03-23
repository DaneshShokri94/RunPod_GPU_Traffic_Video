/**
 * AnalysisRoom — Cloudflare Durable Object
 *
 * One instance per job (identified by jobId).
 * Responsibilities:
 *   - Hold WebSocket connections from browser clients watching this job
 *   - Connect to the GPU server and relay the job config
 *   - Broadcast frame results and progress to all watching clients
 *   - Store final result in KV when done
 */

export class AnalysisRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.clients = new Set()   // browser WebSocket sessions
    this.gpuWs = null          // WebSocket to RunPod GPU server
    this.jobStarted = false
  }

  async fetch(request) {
    const url = new URL(request.url)

    // ── Browser client connects to watch live results ──────────────────────
    if (url.pathname === '/connect') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 })
      }

      const { 0: client, 1: server } = new WebSocketPair()
      server.accept()
      this.clients.add(server)

      // send current job state if already running
      if (this.jobStarted) {
        server.send(JSON.stringify({ type: 'status', msg: 'Analysis already running...' }))
      }

      server.addEventListener('close', () => {
        this.clients.delete(server)
      })

      server.addEventListener('error', () => {
        this.clients.delete(server)
      })

      return new Response(null, { status: 101, webSocket: client })
    }

    // ── Start job — browser sends video URL + ROI config ──────────────────
    if (url.pathname === '/start' && request.method === 'POST') {
      if (this.jobStarted) {
        return Response.json({ error: 'Job already started' }, { status: 409 })
      }

      const config = await request.json()
      this.jobStarted = true

      // Connect to GPU server asynchronously (don't await — runs in background)
      this.state.waitUntil(this._runGpuJob(config))

      return Response.json({ ok: true, msg: 'Job started' })
    }

    return new Response('Not found', { status: 404 })
  }

  // ── GPU job runner ──────────────────────────────────────────────────────────

  async _runGpuJob(config) {
    const { gpuUrl, jobId, ...jobConfig } = config

    this._broadcast({ type: 'status', msg: 'Connecting to GPU server...' })

    try {
      // open WebSocket to RunPod GPU server
      const ws = new WebSocket(gpuUrl)
      this.gpuWs = ws

      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve)
        ws.addEventListener('error', reject)
      })

      // send job config to GPU
      ws.send(JSON.stringify({ type: 'job', ...jobConfig }))
      this._broadcast({ type: 'status', msg: 'GPU is processing your video...' })

      // relay all messages from GPU to browser clients
      await new Promise((resolve, reject) => {
        ws.addEventListener('message', async (event) => {
          const data = JSON.parse(event.data)

          // broadcast to all watching browser clients
          this._broadcast(data)

          // when done — save result to KV for later retrieval
          if (data.type === 'done') {
            await this.env.RESULTS_KV.put(
              `job:${jobId}:result`,
              event.data,
              { expirationTtl: 60 * 60 * 24 * 7 } // keep 7 days
            )
            resolve()
          }

          if (data.type === 'error') {
            reject(new Error(data.msg))
          }
        })

        ws.addEventListener('close', resolve)
        ws.addEventListener('error', (e) => reject(new Error('GPU WebSocket error')))
      })

    } catch (err) {
      console.error('GPU job error:', err)
      this._broadcast({ type: 'error', msg: err.message })
    }
  }

  _broadcast(data) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data)
    const dead = []
    for (const client of this.clients) {
      try {
        client.send(msg)
      } catch {
        dead.push(client)
      }
    }
    dead.forEach(c => this.clients.delete(c))
  }
}
