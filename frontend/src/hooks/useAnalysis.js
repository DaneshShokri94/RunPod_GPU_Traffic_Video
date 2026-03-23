import { useState, useEffect, useRef, useCallback } from 'react'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

export default function useAnalysis(job, rois, lines) {
  const [status, setStatus]       = useState('idle')   // idle|connecting|running|done|error
  const [progress, setProgress]   = useState(0)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [roiCounts, setRoiCounts] = useState({})
  const [lineCounts, setLineCounts] = useState({})
  const [nearMissEvents, setNearMissEvents] = useState([])
  const [summary, setSummary]     = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError]         = useState(null)
  const wsRef = useRef(null)

  const start = useCallback(async () => {
    if (!job || status === 'running') return
    setStatus('connecting')
    setError(null)
    setProgress(0)
    setNearMissEvents([])
    setSummary(null)

    try {
      // 1. POST to Worker to kick off GPU job
      const res = await fetch(`${WORKER_URL}/api/job/${job.jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: job.videoUrl,
          rois,
          lines,
          every_n_frames: 3,
        }),
      })
      if (!res.ok) throw new Error('Failed to start job')

      // 2. Open WebSocket to receive streaming results
      const wsUrl = `${WORKER_URL.replace(/^http/, 'ws')}/api/job/${job.jobId}/connect`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => setStatus('running')

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)

        switch (data.type) {
          case 'status':
            setStatusMsg(data.msg)
            break

          case 'video_info':
            setStatusMsg(`Video: ${data.width}×${data.height} @ ${data.fps?.toFixed(1)}fps`)
            break

          case 'frame_result':
            setProgress(data.percent || 0)
            setCurrentFrame(data)
            if (data.roi_counts)  setRoiCounts(data.roi_counts)
            if (data.line_counts) setLineCounts(data.line_counts)
            if (data.near_miss?.length > 0) {
              setNearMissEvents(prev => [...prev, ...data.near_miss])
            }
            break

          case 'done':
            setProgress(100)
            setSummary(data)
            setStatus('done')
            ws.close()
            break

          case 'error':
            setError(data.msg)
            setStatus('error')
            ws.close()
            break
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection error. Check your GPU server is running.')
        setStatus('error')
      }

      ws.onclose = () => {
        if (status !== 'done') setStatus(s => s === 'running' ? 'error' : s)
      }

    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }, [job, rois, lines, status])

  const stop = useCallback(() => {
    wsRef.current?.close()
    setStatus('idle')
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  return {
    status, progress, currentFrame,
    roiCounts, lineCounts,
    nearMissEvents, summary,
    statusMsg, error,
    start, stop,
  }
}
