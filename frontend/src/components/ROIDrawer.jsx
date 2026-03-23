import { useRef, useState, useEffect } from 'react'

const ROI_COLORS = ['#FF4444','#44AAFF','#44FF44','#FFAA00','#FF44FF','#00DDDD']

export default function ROIDrawer({ backgroundFrame, frameWidth, frameHeight, onDone, onBack }) {
  const canvasRef = useRef(null)
  const [rois, setRois] = useState([])
  const [currentPts, setCurrentPts] = useState([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1f2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#444'
    ctx.font = '18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Click to draw ROI points · Double-click to close', canvas.width/2, canvas.height/2)
  }, [])

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
        width={1280}
        height={600}
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
