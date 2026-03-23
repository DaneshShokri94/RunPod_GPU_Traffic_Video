import { useEffect } from 'react'
import useAnalysis from '../hooks/useAnalysis.js'
import ProgressPanel from './ProgressPanel.jsx'
import ROICountsPanel from './ROICountsPanel.jsx'
import NearMissPanel from './NearMissPanel.jsx'
import SummaryPanel from './SummaryPanel.jsx'
import { exportCSV, exportHTML } from '../utils/export.js'

export default function AnalysisView({ job, rois, lines, onBack }) {
  const {
    status, progress, currentFrame,
    roiCounts, lineCounts,
    nearMissEvents, summary,
    statusMsg, error,
    start, stop,
  } = useAnalysis(job, rois, lines)

  // auto-start when component mounts
  useEffect(() => { start() }, [])

  const criticalCount = nearMissEvents.filter(e => e.severity === 'CRITICAL').length
  const highCount     = nearMissEvents.filter(e => e.severity === 'HIGH').length

  return (
    <div>
      {/* top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24,
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 4 }}>
            Analysis
          </h2>
          <span style={{ color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
            Job: {job.jobId.slice(0, 8)}...
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {status === 'done' && (
            <>
              <button
                className="btn-secondary"
                onClick={() => exportCSV(roiCounts, lineCounts, nearMissEvents)}
              >
                Export CSV
              </button>
              <button
                className="btn-secondary"
                onClick={() => exportHTML(summary, rois)}
              >
                Export HTML report
              </button>
            </>
          )}
          {status === 'running' && (
            <button className="btn-danger" onClick={stop}>Stop</button>
          )}
          <button className="btn-secondary" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* critical alert banner */}
      {criticalCount > 0 && (
        <div style={{
          padding: '12px 20px', marginBottom: 20,
          background: '#ff17441a', border: '1px solid var(--critical)',
          borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <span style={{ color: 'var(--critical)', fontWeight: 600 }}>
            {criticalCount} CRITICAL near-miss event{criticalCount > 1 ? 's' : ''} detected
            {highCount > 0 ? ` · ${highCount} HIGH` : ''}
          </span>
        </div>
      )}

      {/* progress */}
      <ProgressPanel
        status={status}
        progress={progress}
        statusMsg={statusMsg}
        error={error}
        currentFrame={currentFrame}
      />

      {/* live results grid */}
      {(status === 'running' || status === 'done') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 20,
        }}>
          <ROICountsPanel
            roiCounts={roiCounts}
            lineCounts={lineCounts}
            rois={rois}
          />
          <NearMissPanel events={nearMissEvents} />
        </div>
      )}

      {/* final summary */}
      {status === 'done' && summary && (
        <SummaryPanel summary={summary} />
      )}
    </div>
  )
}
