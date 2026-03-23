import { useState, useRef } from 'react'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

export default function UploadStep({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    const ok = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    if (!ok.includes(f.type) && !f.name.match(/\.(mp4|avi|mov|webm|mkv)$/i)) {
      setError('Please upload a video file (MP4, AVI, MOV, WebM)')
      return
    }
    setError(null)
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // 1. get upload URL from Worker
      const res = await fetch(`${WORKER_URL}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to get upload URL')
      }
      const { jobId, videoKey, videoUrl } = await res.json()

      // 2. upload directly to R2 via PUT (track progress with XMLHttpRequest)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', `${WORKER_URL}/api/upload/${videoKey}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 80))
        }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      setProgress(85)

      // 3. get first frame from GPU server for ROI drawing
      const wsUrl = `${WORKER_URL.replace('http', 'ws')}/api/job/${jobId}/connect`
      const frame = await getFirstFrame(wsUrl, videoUrl)

      setProgress(100)
      onUploaded({ jobId, videoKey, videoUrl }, frame.data, { w: frame.width, h: frame.height })

    } catch (e) {
      setError(e.message)
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto' }}>
      <h1 style={{ fontFamily: 'var(--mono)', fontSize: 28, marginBottom: 8, color: 'var(--accent)' }}>
        Upload Video
      </h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
        Upload a traffic video to begin analysis. Supports MP4, AVI, MOV, WebM.
      </p>

      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'var(--accent2)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? '#00e5a00a' : 'var(--bg2)',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{file.name}</div>
            <div style={{ color: 'var(--text2)', fontSize: 13 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>⬆</div>
            <div style={{ color: 'var(--text)', marginBottom: 8 }}>
              Drop video here or click to browse
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              MP4, AVI, MOV, WebM · Max 500MB
            </div>
          </div>
        )}
      </div>

      {/* progress */}
      {uploading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}>
              {progress < 85 ? 'Uploading...' : 'Extracting first frame...'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>
              {progress}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* error */}
      {error && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: '#ff3b3b1a', border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* upload button */}
      {file && !uploading && (
        <button
          className="btn-primary"
          onClick={handleUpload}
          style={{ marginTop: 20, width: '100%', padding: '12px' }}
        >
          Upload & continue →
        </button>
      )}
    </div>
  )
}

// helper: open WS, ask GPU for first frame, return base64
function getFirstFrame(wsUrl, videoUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      ws.close()
      // fallback: return a placeholder if GPU not reachable
      resolve({ data: null, width: 1280, height: 720 })
    }, 10000)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'first_frame', video_url: videoUrl }))
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'first_frame') {
        clearTimeout(timer)
        ws.close()
        resolve({ data: msg.frame, width: msg.width, height: msg.height })
      }
      if (msg.type === 'error') {
        clearTimeout(timer)
        ws.close()
        resolve({ data: null, width: 1280, height: 720 })
      }
    }
    ws.onerror = () => {
      clearTimeout(timer)
      resolve({ data: null, width: 1280, height: 720 })
    }
  })
}
