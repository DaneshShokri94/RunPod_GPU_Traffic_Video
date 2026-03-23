import { useState, useRef } from 'react'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
const CHUNK_SIZE = 90 * 1024 * 1024 // 90MB per chunk

export default function UploadStep({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    if (!f.type.startsWith('video/') && !f.name.match(/\.(mp4|avi|mov|webm|mkv)$/i)) {
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
      // 1. init upload
      const res = await fetch(`${WORKER_URL}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size, multipart: file.size > CHUNK_SIZE }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to init upload')
      }
      const { jobId, videoKey, uploadId, videoUrl } = await res.json()

      if (file.size <= CHUNK_SIZE) {
        // Small file: simple PUT upload
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', `${WORKER_URL}/api/upload/${videoKey}`)
          xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 80))
          }
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.send(file)
        })
      } else {
        // Large file: multipart chunked upload
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
        const parts = []

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, file.size)
          const chunk = file.slice(start, end)

          const partRes = await fetch(
            `${WORKER_URL}/api/upload-part?key=${encodeURIComponent(videoKey)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${i + 1}`,
            { method: 'PUT', body: chunk }
          )
          if (!partRes.ok) throw new Error(`Chunk ${i + 1}/${totalChunks} failed`)
          const partData = await partRes.json()
          parts.push({ partNumber: partData.partNumber, etag: partData.etag })

          setProgress(Math.round(((i + 1) / totalChunks) * 80))
        }

        // Complete multipart
        const completeRes = await fetch(`${WORKER_URL}/api/upload-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, videoKey, uploadId, parts }),
        })
        if (!completeRes.ok) throw new Error('Failed to complete upload')
      }

      setProgress(85)

      // Extract first frame locally
      const frame = await extractFirstFrame(file)

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
        Upload a traffic video to begin analysis. Supports MP4, AVI, MOV, WebM up to 500MB.
      </p>

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
        <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])} />

        {file ? (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{file.name}</div>
            <div style={{ color: 'var(--text2)', fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>⬆</div>
            <div style={{ color: 'var(--text)', marginBottom: 8 }}>Drop video here or click to browse</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>MP4, AVI, MOV, WebM · Max 500MB</div>
          </div>
        )}
      </div>

      {uploading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}>
              {progress < 80 ? 'Uploading...' : progress < 100 ? 'Extracting first frame...' : 'Done!'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: '#ff3b3b1a', border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {file && !uploading && (
        <button className="btn-primary" onClick={handleUpload}
          style={{ marginTop: 20, width: '100%', padding: '12px' }}>
          Upload & continue →
        </button>
      )}
    </div>
  )
}

function extractFirstFrame(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.onloadeddata = () => { video.currentTime = 0.1 }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      URL.revokeObjectURL(video.src)
      resolve({ data: base64, width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      resolve({ data: null, width: 1280, height: 720 })
    }
    video.src = URL.createObjectURL(file)
  })
}
