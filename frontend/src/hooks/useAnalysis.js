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
      // connect directly to GPU server WebSocket
      const ws = new WebSocket('ws://213.173.107.138:29855')
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('running')
        ws.send(JSON.stringify({
          type: 'job',
          video_url: job.videoUrl,
          rois,
          lines,
          every_n_frames: 3,
        }))
      }

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'status') setStatusMsg(data.msg)
        if (data.type === 'frame_result') {
          setProgress(data.percent || 0)
          setCurrentFrame(data)
          if (data.roi_counts) setRoiCounts(data.roi_counts)
          if (data.line_counts) setLineCounts(data.line_counts)
          if (data.near_miss?.length > 0)
            setNearMissEvents(prev => [...prev, ...data.near_miss])
        }
        if (data.type === 'done') {
          setProgress(100)
          setSummary(data)
          setStatus('done')
          ws.close()
        }
        if (data.type === 'error') {
          setError(data.msg)
          setStatus('error')
          ws.close()
        }
      }

      ws.onerror = () => {
        setError('Cannot connect to GPU server. Make sure RunPod is running.')
        setStatus('error')
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
