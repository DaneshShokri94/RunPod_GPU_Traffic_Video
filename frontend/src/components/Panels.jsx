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

      {statusMsg && (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{statusMsg}</p>
      )}

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
        <div style={{
          marginTop: 12, display: 'flex', gap: 20,
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)',
        }}>
          <span>Frame {currentFrame.frame} / {currentFrame.total}</span>
          <span>{currentFrame.detections?.length ?? 0} vehicles in frame</span>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// ─── ROICountsPanel ───────────────────────────────────────────────────────────
const ROI_COLORS = ['#FF4444','#44AAFF','#44FF44','#FFAA00','#FF44FF','#00DDDD','#FF8844','#8844FF']
const CLASS_COLORS = { Car: '#44AAFF', Motorcycle: '#FF44FF', Bus: '#FFAA00', Truck: '#44FF44' }

export function ROICountsPanel({ roiCounts, lineCounts, rois }) {
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
              <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>vehicles detected</div>
            </div>
          ))}
        </div>
      )}

      {Object.entries(lineCounts).length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, margin: '24px 0 12px', color: 'var(--text2)' }}>
            Line Crossings
          </h3>
          {Object.entries(lineCounts).map(([name, data]) => (
            <div key={name} style={{
              padding: '14px 16px', marginBottom: 8,
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              borderLeft: '4px solid #FFD700',
            }}>
              <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>{name}</div>
              <div style={{ display: 'flex', gap: 24, fontFamily: 'var(--mono)', fontSize: 14 }}>
                <span style={{ color: 'var(--accent)' }}>Forward: {data.total_fwd ?? 0}</span>
                <span style={{ color: 'var(--accent2)' }}>Backward: {data.total_bwd ?? 0}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── SummaryPanel ─────────────────────────────────────────────────────────────
const TURN_COLORS = {
  'Straight':   '#44FF44',
  'Left Turn':  '#FF4444',
  'Right Turn': '#44AAFF',
  'U-Turn':     '#FF44FF',
  'Unknown':    '#888888',
}

export function SummaryPanel({ summary }) {
  const totalVehicles = summary.total_vehicles || 0
  const turning = summary.turning_movements || {}
  const roiTotals = summary.roi_totals || {}

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>
        Final Report
      </h3>

      {/* top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 8 }}>TOTAL VEHICLES</div>
          <div style={{ fontSize: 36, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
            {totalVehicles}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
            {summary.duration_sec}s analysed · {summary.total_frames} frames
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 12 }}>TURNING MOVEMENTS</div>
          {Object.entries(turning).length > 0 ? Object.entries(turning).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: TURN_COLORS[type] || 'var(--text)' }}>{type}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                {count} ({totalVehicles > 0 ? Math.round(count / totalVehicles * 100) : 0}%)
              </span>
            </div>
          )) : (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>No data</p>
          )}
        </div>

        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 12 }}>CLASSIFICATION</div>
          {Object.entries(roiTotals).map(([name, data]) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{name}</div>
              {Object.entries(data.counts || {}).map(([cls, count]) => (
                <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                  <span style={{ color: CLASS_COLORS[cls] || 'var(--text)' }}>{cls}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
