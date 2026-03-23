import { useRef, useState, useEffect } from 'react'

const ROI_COLORS   = ['#FF4444','#44AAFF','#44FF44','#FFAA00','#FF44FF','#00DDDD','#FF8844','#8844FF']
const LINE_COLORS  = ['#FFD700','#FF69B4','#00FFFF','#FF6347']

export default function ROIDrawer({ backgroundFrame, frameWidth, frameHeight, onDone, onBack }) {
  const canvasRef   = useRef(null)
  const [mode, setMode]             = useState('roi')    // 'roi' | 'line'
  const [rois, setRois]             = useState([])
  const [lines, setLines]           = useState([])
  const [currentPts, setCurrentPts] = useState([])
  const [linePt1, setLinePt1]       = useState(null)
  const [hover, setHover]           = useState(null)

  // redraw whenever state changes
  useEffect(() => { redraw(currentPts, linePt1, hover) }, [rois, lines, currentPts, linePt1, hover, backgroundFrame])

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const scaleX = frameWidth  / rect.width
    const scaleY = frameHeight / rect.height
    return [
      (e.clientX - rect.left)  * scaleX,
      (e.clientY - rect.top)   * scaleY,
    ]
  }

  // ── mouse handlers ──────────────────────────────────────────────────────────
  const handleClick = (e) => {
    const [x, y] = getCanvasPos(e)

    if (mode === 'roi') {
      setCurrentPts(prev => [...prev, [x, y]])
    } else {
      // counting line: first click = pt1, second = pt2
      if (!linePt1) {
        setLinePt1([x, y])
      } else {
        const newLine = {
          name: `Line ${lines.length + 1}`,
          pt1: linePt1,
          pt2: [x, y],
          color_idx: lines.length % LINE_COLORS.length,
        }
        setLines(prev => [...prev, newLine])
        setLinePt1(null)
      }
    }
  }

  const handleDoubleClick = (e) => {
    if (mode !== 'roi') return
    if (currentPts.length < 3) return
    const newRoi = {
      name: `ROI ${rois.length + 1}`,
      points: currentPts,
      color_idx: rois.length % ROI_COLORS.length,
    }
    setRois(prev => [...prev, newRoi])
    setCurrentPts([])
  }

  const handleMouseMove = (e) => {
    setHover(getCanvasPos(e))
  }

  // ── canvas draw ─────────────────────────────────────────────────────────────
  const redraw = (current, lp1, hv) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // background frame
    if (backgroundFrame) {
      const img = new Image()
      img.src = `data:image/jpeg;base64,${backgroundFrame}`
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawOverlays(ctx, current, lp1, hv)
      }
    } else {
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#444'
      ctx.font = '24px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No preview — ROI drawing still works', canvas.width / 2, canvas.height / 2)
      drawOverlays(ctx, current, lp1, hv)
    }
  }

  const drawOverlays = (ctx, current, lp1, hv) => {
    // ── completed ROIs ───────────────────────────────────────────────────────
    rois.forEach((roi) => {
      const color = ROI_COLORS[roi.color_idx]
      ctx.beginPath()
      roi.points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = color + '22'
      ctx.fill()
      const cx = roi.points.reduce((s, [x]) => s + x, 0) / roi.points.length
      const cy = roi.points.reduce((s, [, y]) => s + y, 0) / roi.points.length
      ctx.font = 'bold 14px DM Sans'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(roi.name, cx, cy + 5)
    })

    // ── counting lines ───────────────────────────────────────────────────────
    lines.forEach((line) => {
      const color = LINE_COLORS[line.color_idx]
      ctx.beginPath()
      ctx.moveTo(line.pt1[0], line.pt1[1])
      ctx.lineTo(line.pt2[0], line.pt2[1])
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.stroke()
      // arrow direction
      const mx = (line.pt1[0] + line.pt2[0]) / 2
      const my = (line.pt1[1] + line.pt2[1]) / 2
      ctx.fillStyle = color
      ctx.font = 'bold 13px DM Sans'
      ctx.textAlign = 'center'
      ctx.fillText(line.name, mx, my - 8)
    })

    // ── in-progress ROI polygon ──────────────────────────────────────────────
    if (mode === 'roi' && current.length > 0) {
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      current.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      if (hv) ctx.lineTo(hv[0], hv[1])
      ctx.strokeStyle = '#ffffff88'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
      // dots at each point
      current.forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      })
    }

    // ── in-progress counting line ────────────────────────────────────────────
    if (mode === 'line' && lp1 && hv) {
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(lp1[0], lp1[1])
      ctx.lineTo(hv[0], hv[1])
      ctx.strokeStyle = '#FFD70099'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(lp1[0], lp1[1], 6, 0, Math.PI * 2)
      ctx.fillStyle = '#FFD700'
      ctx.fill()
    }
  }

  const removeLastROI  = () => setRois(prev => prev.slice(0, -1))
  const removeLastLine = () => setLines(prev => prev.slice(0, -1))
  const clearCurrent   = () => { setCurrentPts([]); setLinePt1(null) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 4 }}>
            Draw ROIs & Lines
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            {mode === 'roi'
              ? 'Click to add polygon points · Double-click to close ROI'
              : 'Click twice to place a counting line · Forward direction = left to right'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button
            className="btn-primary"
            disabled={rois.length === 0}
            onClick={() => onDone(rois, lines)}
          >
            Start analysis →
          </button>
        </div>
      </div>

      {/* toolbar */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
        padding: '10px 14px',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        <span style={{ color: 'var(--text2)', fontSize: 13, marginRight: 4 }}>Mode:</span>
        <button
          onClick={() => { setMode('roi'); clearCurrent() }}
          style={{
            background: mode === 'roi' ? 'var(--accent)' : 'var(--bg3)',
            color: mode === 'roi' ? '#000' : 'var(--text)',
            border: `1px solid ${mode === 'roi' ? 'var(--accent)' : 'var(--border2)'}`,
            fontSize: 13, padding: '5px 14px',
          }}
        >
          ROI polygon
        </button>
        <button
          onClick={() => { setMode('line'); clearCurrent() }}
          style={{
            background: mode === 'line' ? '#FFD700' : 'var(--bg3)',
            color: mode === 'line' ? '#000' : 'var(--text)',
            border: `1px solid ${mode === 'line' ? '#FFD700' : 'var(--border2)'}`,
            fontSize: 13, padding: '5px 14px',
          }}
        >
          Counting line
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--border2)', margin: '0 4px' }} />

        <button className="btn-secondary" onClick={clearCurrent} style={{ fontSize: 13, padding: '5px 12px' }}>
          Cancel current
        </button>
        {rois.length > 0 && (
          <button onClick={removeLastROI} style={{ background: 'transparent', color: 'var(--danger)', fontSize: 13, padding: '5px 12px' }}>
            Remove last ROI
          </button>
        )}
        {lines.length > 0 && (
          <button onClick={removeLastLine} style={{ background: 'transparent', color: 'var(--warn)', fontSize: 13, padding: '5px 12px' }}>
            Remove last line
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
          {rois.map((r, i) => (
            <span key={i} style={{ color: ROI_COLORS[r.color_idx] }}>■ {r.name}</span>
          ))}
          {lines.map((l, i) => (
            <span key={i} style={{ color: LINE_COLORS[l.color_idx] }}>— {l.name}</span>
          ))}
        </div>
      </div>

      {/* canvas */}
      <canvas
        ref={canvasRef}
        width={frameWidth}
        height={frameHeight}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          cursor: 'crosshair',
          display: 'block',
          border: '1px solid var(--border)',
          background: '#1a1f2e',
        }}
      />

      {rois.length === 0 && (
        <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
          Draw at least one ROI polygon to enable analysis
        </p>
      )}
    </div>
  )
}
