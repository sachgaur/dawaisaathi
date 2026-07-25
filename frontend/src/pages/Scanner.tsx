import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Zap, ZapOff, Camera, X, Upload, Pencil } from 'lucide-react'

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null)
  const navigate = useNavigate()
  const { activeMemberId } = useAuth()
  const [capturing, setCapturing] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [flashActive, setFlashActive] = useState(false)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)

  const toggleFlash = async () => {
    try {
      const stream = webcamRef.current?.video?.srcObject as MediaStream | null
      if (!stream) return
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities() as any
      if (capabilities && 'torch' in capabilities) {
        const newFlashState = !flashActive
        await track.applyConstraints({ advanced: [{ torch: newFlashState }] } as any)
        setFlashActive(newFlashState)
      } else {
        alert('Flash/Torch is not supported on this device/camera.')
      }
    } catch (err) {
      console.error('Failed to toggle flash', err)
    }
  }

  const handleCapture = useCallback(async () => {
    if (capturing) return
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return

    setCapturing(true)
    setCapturedPreview(imageSrc)
    try {
      const res = await fetch(imageSrc)
      const blob = await res.blob()
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('image', file)

      const scanRes = await api.post('/medicine/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      navigate('/scan/approve', {
        state: {
          scanData: scanRes.data,
          capturedImage: imageSrc,
          targetMemberId: activeMemberId,
        },
      })
    } catch (err) {
      console.error('Scan failed', err)
      setCapturing(false)
      setCapturedPreview(null)
    }
  }, [capturing, navigate, activeMemberId])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCapturing(true)
    const imageSrc = URL.createObjectURL(file)
    setCapturedPreview(imageSrc)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const scanRes = await api.post('/medicine/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      navigate('/scan/approve', {
        state: {
          scanData: scanRes.data,
          capturedImage: imageSrc,
          targetMemberId: activeMemberId,
        },
      })
    } catch (err) {
      console.error('Scan upload failed', err)
      setCapturing(false)
      setCapturedPreview(null)
    }
  }, [navigate, activeMemberId])

  return (
    <div className="scanner-fullpage">
      {/* Dark header row */}
      <div className="scanner-top-bar">
        <div className="scanner-brand">
          <div className="scanner-brand-dot" />
          <span>DawaiSathi Scanner</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`flash-toggle-btn ${flashActive ? 'active' : ''}`}
            onClick={toggleFlash}
            type="button"
            aria-label="Toggle Flash"
            id="toggle-flash-btn"
          >
            {flashActive ? <Zap size={18} color="var(--accent-teal)" /> : <ZapOff size={18} color="rgba(255,255,255,0.6)" />}
          </button>
          <button
            className="scanner-close-btn"
            onClick={() => navigate('/cabinet')}
            type="button"
            aria-label="Close scanner"
          >
            <X size={18} color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </div>

      {/* Full-screen camera view */}
      <div className="scanner-camera-area">
        {capturedPreview && (
          <img
            src={capturedPreview}
            className="scanner-video-feed"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 25 }}
            alt="Captured Preview"
          />
        )}
        {capturing && (
          <div className="scanner-analyzing-overlay">
            <div className="loading-spinner-container">
              <div className="loading-spinner" style={{ borderTopColor: 'var(--accent-teal)', width: 36, height: 36 }} />
            </div>
            <span className="scanner-analyzing-text">Analyzing prescription…</span>
          </div>
        )}
        {cameraError && !capturedPreview ? (
          <div className="scanner-error-state">
            <ZapOff size={52} opacity={0.4} color="white" />
            <p className="scanner-error-title">Camera Unavailable</p>
            <p className="scanner-error-desc">Allow camera access in browser settings and refresh.</p>
          </div>
        ) : (
          <>
            {!capturedPreview && (
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={1.0}
                videoConstraints={{
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                }}
                onUserMediaError={() => setCameraError(true)}
                className="scanner-video-feed"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* Viewfinder overlay */}
            {!capturedPreview && (
              <div className="scanner-viewfinder">
                <div className="scanner-scan-line" />
                <div className="scanner-corner tl" />
                <div className="scanner-corner tr" />
                <div className="scanner-corner bl" />
                <div className="scanner-corner br" />
              </div>
            )}

            {/* Hint label */}
            <div className="scanner-hint">
              {capturing ? 'Analyzing with AI…' : 'Place prescription inside frame'}
            </div>
          </>
        )}
      </div>

      {/* Capture button pinned above bottom */}
      <div className={`scanner-capture-dock ${capturing ? 'processing-state' : ''}`}>
        <div className="scanner-action-wrapper">
          <button
            className="capture-btn"
            onClick={handleCapture}
            disabled={cameraError || capturing}
            id="capture-btn"
            aria-label="Capture medicine image"
            type="button"
          >
            <Camera size={28} color="#0f172a" strokeWidth={2} />
          </button>
          <span className="scanner-action-label">Take Photo</span>
        </div>

        <div className="scanner-action-wrapper">
          <label
            className="scanner-gallery-btn"
            style={{
              cursor: capturing ? 'not-allowed' : 'pointer',
              opacity: capturing ? 0.5 : 1,
              pointerEvents: capturing ? 'none' : 'auto',
            }}
            title="Upload prescription photo"
          >
            <Upload size={28} color="var(--accent-teal)" strokeWidth={2} />
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              style={{ display: 'none' }}
              disabled={capturing}
            />
          </label>
          <span className="scanner-action-label">Upload</span>
        </div>

        <div className="scanner-action-wrapper">
          <button
            className="scanner-gallery-btn"
            style={{
              cursor: capturing ? 'not-allowed' : 'pointer',
              opacity: capturing ? 0.5 : 1,
              pointerEvents: capturing ? 'none' : 'auto',
            }}
            onClick={() => navigate('/manual-entry')}
            disabled={capturing}
            type="button"
            title="Enter manually"
          >
            <Pencil size={24} color="var(--accent-teal)" strokeWidth={2} />
          </button>
          <span className="scanner-action-label">Manual</span>
        </div>
      </div>
    </div>
  )
}
