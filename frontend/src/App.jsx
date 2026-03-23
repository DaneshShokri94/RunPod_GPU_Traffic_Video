import { useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import UploadStep from './components/UploadStep.jsx'
import ROIDrawer from './components/ROIDrawer.jsx'
import AnalysisView from './components/AnalysisView.jsx'

const STEPS = ['Upload', 'Draw ROIs', 'Analyse']

export default function App() {
  const [step, setStep] = useState(0)
  const [job, setJob] = useState(null)         // { jobId, videoKey, videoUrl }
  const [firstFrame, setFirstFrame] = useState(null)  // base64 JPEG
  const [frameSize, setFrameSize] = useState({ w: 1280, h: 720 })
  const [rois, setRois] = useState([])
  const [lines, setLines] = useState([])

  const handleUploaded = (jobData, frame, size) => {
    setJob(jobData)
    setFirstFrame(frame)
    setFrameSize(size)
    setStep(1)
  }

  const handleROIsDone = (roiList, lineList) => {
    setRois(roiList)
    setLines(lineList)
    setStep(2)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: 'var(--bg2)',
      }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          color: 'var(--accent)',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          TRAFFIC_MONITOR
        </span>

        {/* step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: 16 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 14px',
                borderRadius: 20,
                background: step === i ? 'var(--accent)' : 'transparent',
                color: step === i ? '#000' : step > i ? 'var(--accent)' : 'var(--text3)',
                fontSize: 13,
                fontWeight: step === i ? 600 : 400,
                transition: 'all 0.2s',
              }}>
                <span style={{
                  width: 18, height: 18,
                  borderRadius: '50%',
                  background: step > i ? 'var(--accent)' : step === i ? '#000' : 'var(--border2)',
                  color: step > i ? '#000' : step === i ? 'var(--accent)' : 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  fontFamily: 'var(--mono)',
                }}>
                  {step > i ? '✓' : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 24, height: 1,
                  background: step > i ? 'var(--accent)' : 'var(--border2)',
                  transition: 'background 0.3s',
                }}/>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* main content */}
      <main style={{ flex: 1, padding: '32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {step === 0 && (
          <UploadStep onUploaded={handleUploaded} />
        )}
        {step === 1 && (
          <>
            {console.log('Rendering ROIDrawer', { firstFrame: !!firstFrame, frameSize })}
            <ErrorBoundary>
              <ROIDrawer
                backgroundFrame={firstFrame}
                frameWidth={frameSize.w}
                frameHeight={frameSize.h}
                onDone={handleROIsDone}
                onBack={() => setStep(0)}
              />
            </ErrorBoundary>
          </>
        )}
        {step === 2 && job && (
          <AnalysisView
            job={job}
            rois={rois}
            lines={lines}
            onBack={() => setStep(1)}
          />
        )}
      </main>
    </div>
  )
}
