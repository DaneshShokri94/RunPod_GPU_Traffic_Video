import { useEffect } from 'react'
import useAnalysis from '../hooks/useAnalysis.js'
import { ProgressPanel, ROICountsPanel, SummaryPanel } from './Panels.jsx'
import { exportCSV, exportHTML } from '../utils/export.js'

export default function AnalysisView({ job, rois, lines, onBack }) {
  const {
    status, progress, currentFrame,
    roiCounts, summary, statusMsg, error,
    start, stop,
  } = useAnalysis(job, rois, lines)

  useEffect(() => { start() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 4 }}>
            Vehicle Counting
          </h2>
          <span style={{ color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
            Job: {job.jobId.slice(0, 8)}...
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {status === 'done' && (
            <>
              <button className="btn-secondary" onClick={() => exportCSV(roiCounts, {})}>Export CSV</button>
              <button className="btn-secondary" onClick={() => exportHTML(summary, rois)}>Export HTML</button>
            </>
          )}
          {status === 'running' && <button className="btn-danger" onClick={stop}>Stop</button>}
          <button className="btn-secondary" onClick={onBack}>← Back</button>
        </div>
      </div>

      <ProgressPanel status={status} progress={progress} statusMsg={statusMsg} error={error} currentFrame={currentFrame} />

      {(status === 'running' || status === 'done') && (
        <div style={{ marginTop: 20 }}>
          <ROICountsPanel roiCounts={roiCounts} />
        </div>
      )}

      {status === 'done' && summary && <SummaryPanel summary={summary} />}
    </div>
  )
}
