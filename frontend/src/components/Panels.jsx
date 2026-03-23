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
          <span>{currentFrame.detections?.length ?? 0} vehicles</span>
          {currentFrame.near_miss?.length > 0 && (
            <span style={{ color: 'var(--warn)' }}>
              {currentFrame.near_miss.length} conflict{currentFrame.near_miss.length > 1 ? 's' : ''}
            </span>
          )}
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

export function ROICountsPanel({ roiCounts, lineCounts, rois }) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, marginBottom: 16, color: 'var(--text2)' }}>
        Vehicle counts
      </h3>

      {Object.entries(roiCounts).length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Waiting for detections...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(roiCounts).map(([name, count], i) => (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              borderLeft: `3px solid ${ROI_COLORS[i % ROI_COLORS.length]}`,
            }}>
              <span style={{ color: 'var(--text)', fontSize: 14 }}>{name}</span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700,
                color: ROI_COLORS[i % ROI_COLORS.length],
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {Object.entries(lineCounts).length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, margin: '20px 0 12px', color: 'var(--text2)' }}>
            Line crossings
          </h3>
          {Object.entries(lineCounts).map(([name, data]) => (
            <div key={name} style={{
              padding: '10px 14px', marginBottom: 8,
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              borderLeft: '3px solid #FFD700',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{name}</div>
              <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--mono)', fontSize: 13 }}>
                <span style={{ color: 'var(--accent)' }}>→ {data.total_fwd ?? 0}</span>
                <span style={{ color: 'var(--accent2)' }}>← {data.total_bwd ?? 0}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── NearMissPanel ────────────────────────────────────────────────────────────
export function NearMissPanel({ events }) {
  const severityOrder = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']
  const sorted = [...events].sort((a, b) =>
    severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  )

  const counts = events.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1
    return acc
  }, {})

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text2)' }}>
          Near-miss events
        </h3>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: events.length > 0 ? 'var(--warn)' : 'var(--text3)' }}>
          {events.length}
        </span>
      </div>

      {/* severity summary pills */}
      {events.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {severityOrder.map(sev => counts[sev] ? (
            <span key={sev} className={`badge badge-${sev}`}>{sev}: {counts[sev]}</span>
          ) : null)}
        </div>
      )}

      {events.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>No conflicts detected yet</p>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.slice(0, 50).map((ev, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              fontSize: 13,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span className={`badge badge-${ev.severity}`} style={{ marginRight: 8 }}>{ev.severity}</span>
                <span style={{ color: 'var(--text2)' }}>
                  {ev.v1_class}#{ev.v1_id} vs {ev.v2_class}#{ev.v2_id}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
                {ev.ttc != null && <div>TTC {ev.ttc}s</div>}
                {ev.pet != null && <div>PET {ev.pet}s</div>}
                <div>{ev.time_sec}s</div>
              </div>
            </div>
          ))}
        </div>
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
  const nmBySev = summary.near_miss_by_severity || {}

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>
        Final report
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* totals */}
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 8 }}>TOTAL VEHICLES</div>
          <div style={{ fontSize: 36, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
            {totalVehicles}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
            {summary.duration_sec}s analysed · {summary.total_frames} frames
          </div>
        </div>

        {/* turning movements */}
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 12 }}>TURNING MOVEMENTS</div>
          {Object.entries(turning).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: TURN_COLORS[type] || 'var(--text)' }}>{type}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                {count} ({totalVehicles > 0 ? Math.round(count / totalVehicles * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>

        {/* near-miss totals */}
        <div className="card">
          <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 12 }}>NEAR-MISS SUMMARY</div>
          {['CRITICAL','HIGH','MODERATE','LOW'].map(sev => (
            <div key={sev} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className={`badge badge-${sev}`}>{sev}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontSize: 14 }}>
                {nmBySev[sev] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
