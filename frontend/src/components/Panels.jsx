// ─── ProgressPanel ────────────────────────────────────────────────────────────
export function ProgressPanel({ status, progress, statusMsg, error, currentFrame }) {
  const statusColors = {
    idle: 'var(--text3)',
    connecting: 'var(--accent2)',
    running: 'var(--accent)',
    done: 'var(--low)',
    error: 'var(--danger)',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'running' && (
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              borderRadius: '50%', background: 'var(--accent)',
              animation: 'pulse 1s infinite',
            }}/>
          )}
          <span style={{ color: statusColors[status], fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>
            {status.toUpperCase()}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>
          {progress.toFixed(1)}%
        </span>
      </div>

      <div className="progress-track" style={{ marginBottom: 10 }}>
        <div
          className="progress-bar"
          style={{
            width: `${progress}%`,
            background: status === 'done' ? 'var(--low)' : status === 'error' ? 'var(--danger)' : 'var(--accent)',
          }}
        />
      </div>

      {statusMsg && <p style={{ color: 'var(--text2)', fontSize: 13 }}>{statusMsg}</p>}

      {error && (
        <div style={{
          marginTop: 10, padding: '10px 14px',
          background: '#ff3b3b1a', border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {currentFrame && (
        <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
          Frame {currentFrame.frame} / {currentFrame.total} · {currentFrame.detections?.length ?? 0} vehicles in frame
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  )
}

// ─── ROICountsPanel ───────────────────────────────────────────────────────────
const ROI_COLORS = ['#FF4444','#44AAFF','#44FF44','#FFAA00','#FF44FF','#00DDDD','#FF8844','#8844FF']

export function ROICountsPanel({ roiCounts }) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, marginBottom: 16, color: 'var(--text2)' }}>
        Vehicle Counts by Zone
      </h3>

      {Object.entries(roiCounts).length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Waiting for detections...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(roiCounts).map(([name, count], i) => (
            <div key={name} style={{
              padding: '16px',
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              borderLeft: `4px solid ${ROI_COLORS[i % ROI_COLORS.length]}`,
            }}>
              <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>{name}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700,
                color: ROI_COLORS[i % ROI_COLORS.length],
              }}>
                {count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SummaryPanel ─────────────────────────────────────────────────────────────
const CLASS_COLORS = { Car: '#44AAFF', Motorcycle: '#FF44FF', Bus: '#FFAA00', Truck: '#44FF44' }

export function SummaryPanel({ summary }) {
  const totalVehicles = summary.total_vehicles || 0
  const roiTotals = summary.roi_totals || {}

  // Aggregate all class counts across all ROIs
  const totalByClass = {}
  Object.values(roiTotals).forEach(data => {
    Object.entries(data.counts || {}).forEach(([cls, count]) => {
      totalByClass[cls] = (totalByClass[cls] || 0) + count
    })
  })

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>
        Final Report
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* total + duration */}
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 8 }}>TOTAL VEHICLES</div>
          <div style={{ fontSize: 48, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
            {totalVehicles}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 8 }}>
            {summary.duration_sec}s analysed · {summary.total_frames} frames
          </div>
        </div>

        {/* classification breakdown */}
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 16 }}>CLASSIFICATION</div>
          {Object.entries(totalByClass).length > 0 ? (
            Object.entries(totalByClass).map(([cls, count]) => (
              <div key={cls} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 10, padding: '8px 12px',
                background: 'var(--bg3)', borderRadius: 'var(--radius)',
                borderLeft: `3px solid ${CLASS_COLORS[cls] || '#888'}`,
              }}>
                <span style={{ color: CLASS_COLORS[cls] || 'var(--text)', fontSize: 14 }}>{cls}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>No classification data</p>
          )}
        </div>
      </div>

      {/* per-zone breakdown */}
      {Object.entries(roiTotals).length > 1 && (
        <div style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 16 }}>PER-ZONE BREAKDOWN</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {Object.entries(roiTotals).map(([name, data], i) => (
                <div key={name} style={{
                  padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)',
                  borderLeft: `3px solid ${ROI_COLORS[i % ROI_COLORS.length]}`,
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: ROI_COLORS[i % ROI_COLORS.length], marginBottom: 6 }}>
                    {data.total || 0}
                  </div>
                  {Object.entries(data.counts || {}).map(([cls, count]) => (
                    <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
                      <span>{cls}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
