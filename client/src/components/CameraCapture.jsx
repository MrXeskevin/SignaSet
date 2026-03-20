import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, CircleDot, Save, RotateCcw, HandMetal, AlertCircle, Layers, Timer } from 'lucide-react'
import { saveGesture } from '../services/api'

// MediaPipe hand landmark connections for drawing
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
]

const MAX_BURST_FRAMES = 20

export default function CameraCapture({ addToast }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const handsRef = useRef(null)
    const animFrameRef = useRef(null)

    // Refs for callbacks to avoid stale closures
    const isRecordingRef = useRef(false)
    const sequenceRef = useRef([])

    const [cameraActive, setCameraActive] = useState(false)
    const [captured, setCaptured] = useState(null)  // { imageData, landmarks, sequence }
    const [label, setLabel] = useState('')
    const [saving, setSaving] = useState(false)
    const [currentLandmarks, setCurrentLandmarks] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Burst capture state
    const [captureMode, setCaptureMode] = useState('single') // 'single' | 'burst'
    const [isRecording, setIsRecording] = useState(false)
    const [recordingProgress, setRecordingProgress] = useState(0)
    const [countdown, setCountdown] = useState(null)

    // Draw landmarks on canvas
    const drawLandmarks = useCallback((ctx, landmarks, width, height) => {
        ctx.clearRect(0, 0, width, height)
        if (!landmarks || landmarks.length === 0) return

        // Draw connections
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)'
        ctx.lineWidth = 2
        for (const [i, j] of HAND_CONNECTIONS) {
            const a = landmarks[i]
            const b = landmarks[j]
            ctx.beginPath()
            ctx.moveTo(a.x * width, a.y * height)
            ctx.lineTo(b.x * width, b.y * height)
            ctx.stroke()
        }

        // Draw points
        landmarks.forEach((point, idx) => {
            const x = point.x * width
            const y = point.y * height

            const isTip = [4, 8, 12, 16, 20].includes(idx)
            const radius = isTip ? 6 : 3.5

            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fillStyle = isTip ? '#10b981' : '#6366f1'
            ctx.fill()

            if (isTip) {
                ctx.beginPath()
                ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'
                ctx.lineWidth = 2
                ctx.stroke()
            }
        })
    }, [])

    // Finalize recording
    const finishRecording = useCallback(() => {
        isRecordingRef.current = false
        setIsRecording(false)
        const sequence = [...sequenceRef.current]

        const video = videoRef.current
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = video.videoWidth
        tempCanvas.height = video.videoHeight
        const ctx = tempCanvas.getContext('2d')
        ctx.drawImage(video, 0, 0)

        if (sequence.length > 0) {
            drawLandmarks(ctx, sequence[sequence.length - 1], tempCanvas.width, tempCanvas.height)
        }

        const imageData = tempCanvas.toDataURL('image/jpeg', 0.9)

        const cleanCanvas = document.createElement('canvas')
        cleanCanvas.width = video.videoWidth
        cleanCanvas.height = video.videoHeight
        const cleanCtx = cleanCanvas.getContext('2d')
        cleanCtx.drawImage(video, 0, 0)
        const cleanImageData = cleanCanvas.toDataURL('image/jpeg', 0.9)

        setCaptured({
            imageData,
            cleanImageData,
            landmarks: null,
            sequence: sequence.map(frame => frame.map(p => ({ x: p.x, y: p.y, z: p.z })))
        })
        addToast(`Burst sequence captured! (${sequence.length} frames)`, 'success')
    }, [addToast, drawLandmarks])

    // Initialize MediaPipe Hands
    const initMediaPipe = useCallback(async () => {
        // Access from window object since we loaded it via index.html scripts
        const MediaPipeHands = window.Hands;

        if (!MediaPipeHands) {
            throw new Error('MediaPipe Hands script not loaded. Check your internet connection.');
        }

        const hands = new MediaPipeHands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        })

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.5,
        })

        hands.onResults((results) => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            const { videoWidth, videoHeight } = videoRef.current || {}

            if (videoWidth && videoHeight) {
                if (canvas.width !== videoWidth) canvas.width = videoWidth
                if (canvas.height !== videoHeight) canvas.height = videoHeight
            }

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const allLandmarks = results.multiHandLandmarks[0]
                setCurrentLandmarks(allLandmarks)
                drawLandmarks(ctx, allLandmarks, canvas.width, canvas.height)

                if (isRecordingRef.current) {
                    sequenceRef.current.push(allLandmarks)
                    setRecordingProgress(sequenceRef.current.length / MAX_BURST_FRAMES * 100)

                    if (sequenceRef.current.length >= MAX_BURST_FRAMES) {
                        finishRecording()
                    }
                }
            } else {
                setCurrentLandmarks(null)
                ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
        })

        handsRef.current = hands
        return hands
    }, [drawLandmarks, finishRecording])

    // Start camera
    const startCamera = async () => {
        try {
            setLoading(true)
            setError(null)

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            })

            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            const hands = await initMediaPipe()

            const processFrame = async () => {
                if (videoRef.current && videoRef.current.readyState >= 2) {
                    await hands.send({ image: videoRef.current })
                }
                animFrameRef.current = requestAnimationFrame(processFrame)
            }

            setCameraActive(true)
            setLoading(false)
            processFrame()
        } catch (err) {
            console.error('Camera error:', err)
            setError('Failed to access camera. Please check permissions.')
            setLoading(false)
        }
    }

    // Stop camera
    const stopCamera = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
        }
        if (handsRef.current) {
            handsRef.current.close()
            handsRef.current = null
        }
        setCameraActive(false)
        setCurrentLandmarks(null)
        setIsRecording(false)
        isRecordingRef.current = false
    }

    // Main capture function
    const startCapture = () => {
        if (captureMode === 'single') {
            captureSingleFrame()
        } else {
            startCountdown()
        }
    }

    const captureSingleFrame = () => {
        if (!currentLandmarks) {
            addToast('No hand detected!', 'error')
            return
        }

        const video = videoRef.current
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = video.videoWidth
        tempCanvas.height = video.videoHeight
        const ctx = tempCanvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        drawLandmarks(ctx, currentLandmarks, tempCanvas.width, tempCanvas.height)
        const imageData = tempCanvas.toDataURL('image/jpeg', 0.9)

        const cleanCanvas = document.createElement('canvas')
        cleanCanvas.width = video.videoWidth
        cleanCanvas.height = video.videoHeight
        const cleanCtx = cleanCanvas.getContext('2d')
        cleanCtx.drawImage(video, 0, 0)
        const cleanImageData = cleanCanvas.toDataURL('image/jpeg', 0.9)

        setCaptured({
            imageData,
            cleanImageData,
            landmarks: currentLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z })),
            sequence: null
        })
        addToast('Frame captured!', 'success')
    }

    const startCountdown = () => {
        if (!currentLandmarks) {
            addToast('Show your hand to the camera first.', 'error')
            return
        }

        let count = 3
        setCountdown(count)

        const timer = setInterval(() => {
            count -= 1
            if (count === 0) {
                clearInterval(timer)
                setCountdown(null)
                startBurstRecording()
            } else {
                setCountdown(count)
            }
        }, 1000)
    }

    const startBurstRecording = () => {
        sequenceRef.current = []
        setRecordingProgress(0)
        setIsRecording(true)
        isRecordingRef.current = true
    }

    const handleSave = async () => {
        if (!label.trim()) {
            addToast('Please enter a label.', 'error')
            return
        }
        if (!captured) return

        try {
            setSaving(true)
            await saveGesture({
                label: label.trim(),
                landmarks: captured.landmarks,
                sequence: captured.sequence,
                imageData: captured.cleanImageData,
                source: 'camera',
            })
            addToast(`Gesture "${label.trim()}" saved!`, 'success')
            setCaptured(null)
            setLabel('')
        } catch (err) {
            addToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const resetCapture = () => {
        setCaptured(null)
        setLabel('')
    }

    useEffect(() => {
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
            if (handsRef.current) handsRef.current.close()
        }
    }, [])

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Camera Capture</h1>
                <p>Collect hand gestures using single-frame or burst-mode recording</p>
            </div>

            <div className="media-section">
                {/* Video Feed */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon primary"><Camera size={22} /></div>
                            <div style={{ flex: 1 }}>
                                <h2>Live Feed</h2>
                                <p>Webcam with landmark overlay</p>
                            </div>
                            <div className="mode-toggle">
                                <button
                                    className={captureMode === 'single' ? 'active' : ''}
                                    onClick={() => !isRecording && setCaptureMode('single')}
                                >
                                    Single
                                </button>
                                <button
                                    className={captureMode === 'burst' ? 'active' : ''}
                                    onClick={() => !isRecording && setCaptureMode('burst')}
                                >
                                    Burst
                                </button>
                            </div>
                        </div>

                        <div className="video-wrapper">
                            <video ref={videoRef} playsInline muted style={{ transform: 'scaleX(-1)' }} />
                            <canvas ref={canvasRef} style={{ transform: 'scaleX(-1)' }} />

                            {cameraActive && !isRecording && (
                                <div className="video-overlay">
                                    <span className="live-dot"></span>
                                    LIVE
                                </div>
                            )}

                            {isRecording && (
                                <div className="video-overlay recording">
                                    <span className="live-dot"></span>
                                    RECORDING BURST...
                                </div>
                            )}

                            {isRecording && (
                                <div className="recording-progress" style={{ width: `${recordingProgress}%` }} />
                            )}

                            {countdown !== null && (
                                <div className="countdown-overlay">
                                    {countdown}
                                </div>
                            )}

                            {!cameraActive && !loading && (
                                <div style={{
                                    position: 'absolute', inset: 0, display: 'flex',
                                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.6)', gap: 12, zIndex: 3
                                }}>
                                    <Camera size={48} strokeWidth={1.5} />
                                    <span style={{ fontSize: '0.9rem' }}>Camera inactive</span>
                                </div>
                            )}

                            {loading && (
                                <div className="loading-overlay" style={{ background: 'rgba(30,27,75,0.8)' }}>
                                    <div className="spinner"></div>
                                    <span style={{ color: 'white' }}>Starting camera...</span>
                                </div>
                            )}
                        </div>

                        <div className="video-controls">
                            {!cameraActive ? (
                                <button className="btn btn-primary btn-lg btn-full" onClick={startCamera} disabled={loading}>
                                    <Camera size={18} /> Start Camera
                                </button>
                            ) : (
                                <>
                                    <button
                                        className={`btn ${captureMode === 'single' ? 'btn-primary' : 'btn-danger'} btn-lg`}
                                        onClick={startCapture}
                                        disabled={isRecording || countdown !== null}
                                        style={{ flex: 1 }}
                                    >
                                        {captureMode === 'single' ? <CircleDot size={18} /> : <Timer size={18} />}
                                        {captureMode === 'single' ? 'Capture Frame' : 'Start Burst Capture'}
                                    </button>
                                    <button className="btn btn-secondary" onClick={stopCamera} disabled={isRecording}>
                                        Stop
                                    </button>
                                </>
                            )}
                        </div>

                        {cameraActive && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                                {currentLandmarks ? (
                                    <span className="landmark-badge">
                                        <HandMetal size={14} /> Landmarks detected
                                    </span>
                                ) : (
                                    <span className="landmark-badge none">
                                        <AlertCircle size={14} /> No hand detected
                                    </span>
                                )}
                                {captureMode === 'burst' && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Layers size={14} /> {MAX_BURST_FRAMES} frames
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview & Save Panel */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon success"><Save size={22} /></div>
                            <div>
                                <h2>Preview & Save</h2>
                                <p>Label and persist your data</p>
                            </div>
                        </div>

                        <div className="preview-panel">
                            <div className="preview-image-wrapper">
                                {captured ? (
                                    <img src={captured.imageData} alt="Captured gesture" />
                                ) : (
                                    <div className="preview-placeholder">
                                        <CircleDot size={48} />
                                        <span>Awaiting capture...</span>
                                    </div>
                                )}
                            </div>

                            {captured && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {captured.sequence ? (
                                            <span className="landmark-badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)' }}>
                                                <Layers size={14} /> Burst Sequence: {captured.sequence.length} frames
                                            </span>
                                        ) : (
                                            <span className="landmark-badge">
                                                <CircleDot size={14} /> Single Static Frame
                                            </span>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="gesture-label">Gesture Label</label>
                                        <input
                                            id="gesture-label"
                                            className="form-input"
                                            type="text"
                                            placeholder='e.g. "A", "Hello"'
                                            value={label}
                                            onChange={e => setLabel(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                                            autoFocus
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            className="btn btn-success btn-lg"
                                            onClick={handleSave}
                                            disabled={saving || !label.trim()}
                                            style={{ flex: 1 }}
                                        >
                                            {saving ? <div className="spinner" /> : <Save size={18} />}
                                            {saving ? 'Saving...' : 'Save Dataset Entry'}
                                        </button>
                                        <button className="btn btn-secondary" onClick={resetCapture}>
                                            <RotateCcw size={16} /> Retake
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
