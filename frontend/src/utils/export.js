/**
 * Client-side export utilities.
 * Replaces the filedialog + csv.writer from the original desktop app.
 */

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── CSV export ─────────────────────────────────────────────────────────────────
export function exportCSV(roiCounts, lineCounts, nearMissEvents) {
  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-')
  let csv = ''

  // ROI counts
  csv += 'ROI Counts\n'
  csv += 'ROI Name,Vehicle Count\n'
  Object.entries(roiCounts).forEach(([name, count]) => {
    csv += `"${name}",${count}\n`
  })

  // Line counts
  if (Object.keys(lineCounts).length > 0) {
    csv += '\nCounting Lines\n'
    csv += 'Line Name,Forward,Backward,Total\n'
    Object.entries(lineCounts).forEach(([name, data]) => {
      const fwd = data.total_fwd || 0
      const bwd = data.total_bwd || 0
      csv += `"${name}",${fwd},${bwd},${fwd + bwd}\n`
    })
  }

  // Near-miss events
  if (nearMissEvents.length > 0) {
    csv += '\nNear-Miss Events\n'
    csv += 'Time(s),Severity,TTC(s),PET(s),Vehicle1,Vehicle2\n'
    nearMissEvents.forEach(ev => {
      csv += `${ev.time_sec},${ev.severity},${ev.ttc ?? ''},${ev.pet ?? ''},"${ev.v1_class}#${ev.v1_id}","${ev.v2_class}#${ev.v2_id}"\n`
    })
  }

  downloadFile(csv, `traffic_report_${ts}.csv`, 'text/csv')
}

// ── HTML report export ─────────────────────────────────────────────────────────
export function exportHTML(summary, rois) {
  const ts = new Date().toLocaleString()

  const severityColors = {
    CRITICAL: '#ff1744', HIGH: '#ff6d00', MODERATE: '#ffd600', LOW: '#00e676'
  }

  const roiRows = Object.entries(summary.roi_totals || {}).map(([name, data]) =>
    `<tr><td>${name}</td><td>${data.total || 0}</td><td>${
      Object.entries(data.counts || {}).map(([k,v]) => `${k}: ${v}`).join(', ')
    }</td></tr>`
  ).join('')

  const lineRows = Object.entries(summary.line_totals || {}).map(([name, data]) =>
    `<tr><td>${name}</td><td>${data.total_fwd || 0}</td><td>${data.total_bwd || 0}</td><td>${(data.total_fwd||0)+(data.total_bwd||0)}</td></tr>`
  ).join('')

  const turnRows = Object.entries(summary.turning_movements || {}).map(([type, count]) =>
    `<tr><td>${type}</td><td>${count}</td><td>${summary.total_vehicles ? Math.round(count/summary.total_vehicles*100) : 0}%</td></tr>`
  ).join('')

  const nmRows = (summary.near_miss_events || []).slice(0, 100).map(ev =>
    `<tr>
      <td>${ev.time_sec}s</td>
      <td style="color:${severityColors[ev.severity]};font-weight:700">${ev.severity}</td>
      <td>${ev.ttc ?? '-'}</td>
      <td>${ev.pet ?? '-'}</td>
      <td>${ev.v1_class}#${ev.v1_id} vs ${ev.v2_class}#${ev.v2_id}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Traffic Analysis Report</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #0a0c0f; color: #e2e8f0; margin: 0; padding: 32px; }
  h1 { color: #00e5a0; font-family: monospace; }
  h2 { color: #8896aa; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #181c22; color: #8896aa; font-size: 12px; padding: 10px 14px; text-align: left; }
  td { padding: 10px 14px; border-bottom: 1px solid #232830; font-size: 14px; }
  tr:hover td { background: #111418; }
  .stat { display:inline-block; padding: 20px 28px; background: #111418;
          border: 1px solid #232830; border-radius: 10px; margin: 0 12px 12px 0; }
  .stat-num { font-size: 36px; font-family: monospace; font-weight: 700; color: #00e5a0; }
  .stat-label { font-size: 12px; color: #8896aa; letter-spacing: 0.08em; }
  .footer { color: #4a5568; font-size: 12px; margin-top: 40px; }
</style>
</head>
<body>
<h1>Traffic Analysis Report</h1>
<p style="color:#8896aa">Generated: ${ts}</p>

<div style="margin:20px 0">
  <div class="stat">
    <div class="stat-num">${summary.total_vehicles || 0}</div>
    <div class="stat-label">TOTAL VEHICLES</div>
  </div>
  <div class="stat">
    <div class="stat-num">${summary.duration_sec || 0}s</div>
    <div class="stat-label">DURATION</div>
  </div>
  <div class="stat">
    <div class="stat-num">${(summary.near_miss_events || []).length}</div>
    <div class="stat-label">NEAR-MISS EVENTS</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color:#ff1744">${(summary.near_miss_by_severity || {}).CRITICAL || 0}</div>
    <div class="stat-label">CRITICAL</div>
  </div>
</div>

<h2>ROI Vehicle Counts</h2>
<table>
  <tr><th>ROI</th><th>Total</th><th>By class</th></tr>
  ${roiRows}
</table>

${lineRows ? `
<h2>Counting Lines</h2>
<table>
  <tr><th>Line</th><th>Forward</th><th>Backward</th><th>Total</th></tr>
  ${lineRows}
</table>` : ''}

<h2>Turning Movements</h2>
<table>
  <tr><th>Type</th><th>Count</th><th>Percentage</th></tr>
  ${turnRows}
</table>

<h2>Near-Miss Events (top 100)</h2>
<table>
  <tr><th>Time</th><th>Severity</th><th>TTC (s)</th><th>PET (s)</th><th>Vehicles</th></tr>
  ${nmRows}
</table>

<p class="footer">Generated by Traffic Monitor · ${ts}</p>
</body>
</html>`

  downloadFile(html, `traffic_report_${ts.replace(/[/:, ]/g, '-')}.html`, 'text/html')
}
