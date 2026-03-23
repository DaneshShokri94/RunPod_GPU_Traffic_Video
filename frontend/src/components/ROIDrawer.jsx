import { useRef, useState, useEffect } from 'react'

const ROI_COLORS = ['#FF4444','#44AAFF','#44FF44','#FFAA00','#FF44FF','#00DDDD']

export default function ROIDrawer({ backgroundFrame, frameWidth, frameHeight, onDone, onBack }) {
  const canvasRef = useRef(null)
  const [rois, setRois] = useState([])
  const [currentPts, setCurrentPts] = useState([])
  const bgImageRef = useRef(null)

  // Load background image once
  useEffect(() => {
    if (backgroundFrame) {
      const img = new Image()
      img.onload = () => {
        bgImageRef.current = img
        redraw([], [])
      }
      img.src = `data:image/jpeg;base64,${backgroundFrame}`
    } else {
      redraw([], [])
    }
  }, [backgroundFrame])

  // Redraw whenever ROIs or current points change
  useEffect(() => {
    redraw(rois, currentPts)
  }, [rois, currentPts])

  const redraw = (allRois, pts) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height)
    } else {
      ctx.fillStyle = '#1a1f2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#444'
      ctx.font = '18px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Click to draw ROI points · Double-click to close', canvas.width / 2, canvas.height / 2)
    }

    // Draw completed ROIs
    allRois.forEach((roi, i) => {
      const color = ROI_COLORS[i % ROI_COLORS.length]
      ctx.beginPath()
      roi.points.forEach(([x, y], j) => j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = color + '33'
      ctx.fill()
      // Label
      const cx = roi.points.reduce((s, [x]) => s + x, 0) / roi.points.length
      const cy = roi.points.reduce((s, [, y]) => s + y, 0) / roi.points.length
      ctx.font = 'bold 14px monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(roi.name, cx, cy + 5)
    })

    // Draw in-progress points
    if (pts.length > 0) {
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.strokeStyle = '#ffffff88'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
      // Dots
      pts.forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      })
    }
  }

  const handleClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    setCurrentPts(prev => [...prev, [x, y]])
  }

  const handleDoubleClick = () => {
    if (currentPts.length < 3) return
    setRois(prev => [...prev, { name: `Zone ${prev.length + 1}`, points: currentPts, color_idx: rois.length }])
    setCurrentPts([])
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ color: '#00d084', fontFamily: 'monospace' }}>Draw ROIs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {rois.length > 0 && (
            <button
              onClick={() => setRois(prev => prev.slice(0, -1))}
              style={{ padding: '8px 16px', background: 'transparent', color: '#f85149', border: '1px solid #f85149', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              Undo last ROI
            </button>
          )}
          <button onClick={onBack} style={{ padding: '8px 16px', background: '#21262d', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>← Back</button>
          <button
            onClick={() => onDone(rois, [])}
            disabled={rois.length === 0}
            style={{ padding: '8px 16px', background: rois.length > 0 ? '#00d084' : '#333', color: rois.length > 0 ? '#000' : '#666', border: 'none', borderRadius: 6, cursor: rois.length > 0 ? 'pointer' : 'default', fontWeight: 600 }}
          >
            Start analysis →
          </button>
        </div>
      </div>

      <p style={{ color: '#8b949e', marginBottom: 12, fontSize: 13 }}>
        Click to add points · Double-click to close polygon · ROIs drawn: {rois.length}
      </p>

      <canvas
        ref={canvasRef}
        width={frameWidth || 1280}
        height={frameHeight || 720}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ width: '100%', background: '#1a1f2e', borderRadius: 8, cursor: 'crosshair', border: '1px solid #30363d' }}
      />

      <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
        {rois.map((r, i) => (
          <span key={i} style={{ color: ROI_COLORS[i % ROI_COLORS.length], fontSize: 13 }}>■ {r.name}</span>
        ))}
      </div>
    </div>
  )
}
