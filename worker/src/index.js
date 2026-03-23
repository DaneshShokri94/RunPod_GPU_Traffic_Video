/**
 * Cloudflare Worker — Traffic Monitor API
 *
 * Routes:
 *   POST /api/upload-url          → returns pre-signed R2 upload URL
 *   GET  /api/job/:id/connect     → WebSocket — browser watches analysis progress
 *   POST /api/job/:id/start       → triggers GPU server to start processing
 *   GET  /api/job/:id/result      → fetch cached final result from KV
 *   GET  /health                  → health check
 */

import { AnalysisRoom } from './AnalysisRoom.js'
export { AnalysisRoom }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    try {
      // ── GET /health ────────────────────────────────────────────────────────
      if (path === '/health') {
        return Response.json({ ok: true }, { headers: cors })
      }

      // ── POST /api/upload-url ───────────────────────────────────────────────
      // Client asks for a pre-signed URL to upload video directly to R2
      if (path === '/api/upload-url' && request.method === 'POST') {
        const { filename, size } = await request.json()

        const maxMB = parseInt(env.MAX_VIDEO_SIZE_MB || '500')
        if (size > maxMB * 1024 * 1024) {
          return Response.json(
            { error: `File too large. Max ${maxMB}MB` },
            { status: 400, headers: cors }
          )
        }

        const jobId = crypto.randomUUID()
        const videoKey = `videos/${jobId}/${filename}`

        // Create multipart upload — client uploads directly to R2
        const mpu = await env.VIDEO_BUCKET.createMultipartUpload(videoKey)

        return Response.json({
          jobId,
          videoKey,
          uploadId: mpu.uploadId,
          // Public URL the GPU server will use to download
          videoUrl: `${new URL(request.url).origin}/api/upload/${videoKey}`,
        }, { headers: cors })
      }

      // ── PUT /api/upload/:key — receive video and store in R2 ──────────────
      if (request.method === 'PUT' && path.startsWith('/api/upload/')) {
        const key = path.replace('/api/upload/', '')
        await env.VIDEO_BUCKET.put(key, request.body, {
          httpMetadata: { contentType: request.headers.get('content-type') || 'video/mp4' }
        })
        return Response.json({ ok: true }, { headers: cors })
      }

      // ── POST /api/upload-complete ──────────────────────────────────────────
      if (path === '/api/upload-complete' && request.method === 'POST') {
        const { jobId, videoKey, uploadId, parts } = await request.json()
        const mpu = env.VIDEO_BUCKET.resumeMultipartUpload(videoKey, uploadId)
        await mpu.complete(parts)
        return Response.json({ ok: true, jobId }, { headers: cors })
      }

      // ── GET /api/job/:id/connect (WebSocket) ───────────────────────────────
      // Dashboard client connects here to receive live results
      const connectMatch = path.match(/^\/api\/job\/([^/]+)\/connect$/)
      if (connectMatch) {
        const jobId = connectMatch[1]
        const roomId = env.ANALYSIS_ROOM.idFromName(jobId)
        const room = env.ANALYSIS_ROOM.get(roomId)
        return room.fetch(new Request(
          `http://internal/connect?jobId=${jobId}`,
          { headers: request.headers }
        ))
      }

      // ── POST /api/job/:id/start ────────────────────────────────────────────
      // Browser sends this after drawing ROIs — kicks off GPU processing
      const startMatch = path.match(/^\/api\/job\/([^/]+)\/start$/)
      if (startMatch) {
        const jobId = startMatch[1]
        const body = await request.json()
        const roomId = env.ANALYSIS_ROOM.idFromName(jobId)
        const room = env.ANALYSIS_ROOM.get(roomId)
        return room.fetch(new Request('http://internal/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, jobId, gpuUrl: env.GPU_SERVER_URL }),
        }))
      }

      // ── GET /api/job/:id/result ────────────────────────────────────────────
      const resultMatch = path.match(/^\/api\/job\/([^/]+)\/result$/)
      if (resultMatch) {
        const jobId = resultMatch[1]
        const result = await env.RESULTS_KV.get(`job:${jobId}:result`)
        if (!result) {
          return Response.json({ error: 'Result not ready yet' }, { status: 404, headers: cors })
        }
        return new Response(result, {
          headers: { ...cors, 'Content-Type': 'application/json' }
        })
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: cors })

    } catch (err) {
      console.error(err)
      return Response.json(
        { error: err.message },
        { status: 500, headers: cors }
      )
    }
  }
}
