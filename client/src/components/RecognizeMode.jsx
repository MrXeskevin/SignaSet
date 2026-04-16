import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, HandMetal, AlertCircle, Type, Eraser, Delete, Loader2 } from 'lucide-react'
import { getLandmarksOnly } from '../services/api'
import { loadDataset, classify } from '../services/classifier'

// MediaPipe hand landmark connections for drawing
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
]

export default function RecognizeMode({ addToast }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const handsRef = useRef(null)
    const animFrameRef = useRef(null)

    // Debounce refs (non-state to avoid re-render lag)
    const steadyLabelRef = useRef(null)
    const steadyCountRef = useRef(0)
    const lastCommittedLetterRef = useRef(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [prediction, setPrediction] = useState({ label: null, confidence: 0 })
    const [letterBuffer, setLetterBuffer] = useState([])
    const [loading, setLoading] = useState(true)
    const [datasetLoaded, setDatasetLoaded] = useState(false)
    const [holdProgress, setHoldProgress] = useState(0)

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
        })
    }, [])

    // Initialize MediaPipe Hands (mirrors CameraCapture.jsx)
    const initMediaPipe = useCallback(async () => {
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
                if (canvas.width !== videoWidth) canvas.width = videoWidth;
                if (canvas.height !== videoHeight) canvas.height = videoHeight;
            }

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0]
                drawLandmarks(ctx, landmarks, canvas.width, canvas.height)

                // 1. Classify frame
                const result = classify(landmarks)
                setPrediction(result)

                // 2. Debounce & Word Buffer Logic
                if (result.label && result.confidence > 0.75) {
                    if (result.label === steadyLabelRef.current) {
                        steadyCountRef.current += 1;
                        setHoldProgress((steadyCountRef.current / 30) * 100);

                        if (steadyCountRef.current >= 30) {
                            // Committing the letter
                            if (result.label !== lastCommittedLetterRef.current) {
                                setLetterBuffer(prev => [...prev, result.label]);
                                lastCommittedLetterRef.current = result.label;
                            }
                            steadyCountRef.current = 0;
                            setHoldProgress(0);
                        }
                    } else {
                        // Label changed or just started
                        steadyLabelRef.current = result.label;
                        steadyCountRef.current = 0;
                        setHoldProgress(0);
                    }
                } else {
                    // Loss of confidence or no detection
                    steadyLabelRef.current = null;
                    steadyCountRef.current = 0;
                    setHoldProgress(0);
                }
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                setPrediction({ label: null, confidence: 0 })
                steadyLabelRef.current = null;
                steadyCountRef.current = 0;
                setHoldProgress(0);
            }
        })

        handsRef.current = hands
        return hands
    }, [drawLandmarks])

    // Load dataset and seed classifier
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const data = await getLandmarksOnly()
                if (!data || data.length === 0) {
                    setDatasetLoaded(false)
                } else {
                    loadDataset(data)
                    setDatasetLoaded(true)
                }
            } catch (err) {
                console.error(err)
                addToast('Failed to seed classifier dataset', 'error')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [addToast])

    const startCamera = async () => {
        try {
            setLoading(true)
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
            addToast('Failed to access camera. Check permissions.', 'error')
            setLoading(false)
        }
    }

    const stopCamera = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
        if (handsRef.current) {
            handsRef.current.close()
            handsRef.current = null
        }
        setCameraActive(false)
        setPrediction({ label: null, confidence: 0 })
        setHoldProgress(0)
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
                <h1>Recognize Mode</h1>
                <p>Live translation of hand gestures into continuous text</p>
            </div>

            {!datasetLoaded && !loading && (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <AlertCircle size={48} style={{ color: 'var(--accent-danger)', marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h2 style={{ marginBottom: '0.5rem' }}>No Gestures Found</h2>
                    <p style={{ maxWidth: '400px', margin: '0 auto' }}>
                        Your training dataset is empty. Please move to the <strong>Capture</strong> tab to record some gestures before using Recognition mode.
                    </p>
                </div>
            )}

            {(datasetLoaded || loading) && (
                <div className="media-section">
                    {/* Visual Feed */}
                    <div>
                        <div className="card">
                            <div className="card-header">
                                <div className="card-icon primary"><Camera size={22} /></div>
                                <div>
                                    <h2>Camera Feed</h2>
                                    <p>Recognition engine active</p>
                                </div>
                            </div>

                            <div className="video-wrapper">
                                <video ref={videoRef} playsInline muted style={{ transform: 'scaleX(-1)' }} />
                                <canvas ref={canvasRef} style={{ transform: 'scaleX(-1)' }} />

                                {!cameraActive && !loading && (
                                    <div className="loading-overlay" style={{ background: 'rgba(30,27,75,0.4)' }}>
                                        <Camera size={48} strokeWidth={1.5} style={{ opacity: 0.5, color: 'white' }} />
                                        <span style={{ color: 'white' }}>Recognition Paused</span>
                                    </div>
                                )}

                                {loading && (
                                    <div className="loading-overlay" style={{ background: 'rgba(30,27,75,0.8)' }}>
                                        <div className="spinner"></div>
                                        <span style={{ color: 'white' }}>Initialising engine...</span>
                                    </div>
                                )}
                            </div>

                            <div className="video-controls">
                                {!cameraActive ? (
                                    <button className="btn btn-primary btn-lg btn-full" onClick={startCamera} disabled={loading || !datasetLoaded}>
                                        <Camera size={18} /> Start Recognition
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary btn-lg btn-full" onClick={stopCamera}>
                                        Stop Recognition
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recognition Data */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Live Prediction Panel */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-icon success"><HandMetal size={22} /></div>
                                <div>
                                    <h2>Live Analysis</h2>
                                    <p>Probability and hold threshold</p>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                <div style={{
                                    fontSize: '120px',
                                    fontWeight: '800',
                                    lineHeight: 1,
                                    color: 'var(--accent-primary)',
                                    marginBottom: '0.5rem',
                                    height: '120px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {prediction.label || '—'}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em'
                                }}>
                                    Confidence: {(prediction.confidence * 100).toPrecision(2)}%
                                </div>

                                {/* Progress Bar */}
                                <div style={{
                                    height: 8,
                                    background: 'var(--border-light)',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    marginTop: '2rem',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${holdProgress}%`,
                                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                                        transition: 'width 0.1s linear'
                                    }} />
                                    {holdProgress > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            boxShadow: 'inset 0 0 10px rgba(255,255,255,0.4)',
                                            pointerEvents: 'none'
                                        }} />
                                    )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Hold gesture to commit to buffer
                                </div>
                            </div>
                        </div>

                        {/* Word Buffer Panel */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-icon primary"><Type size={22} /></div>
                                <div style={{ flex: 1 }}>
                                    <h2>Message Buffer</h2>
                                    <p>Accumulated text</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-icon btn-secondary" onClick={() => setLetterBuffer(prev => prev.slice(0, -1))} title="Clear Last">
                                        <Delete size={18} />
                                    </button>
                                    <button className="btn btn-icon btn-danger" onClick={() => { setLetterBuffer([]); lastCommittedLetterRef.current = null; }} title="Clear Word">
                                        <Eraser size={18} />
                                    </button>
                                </div>
                            </div>

                            <div style={{
                                background: 'white',
                                border: '1.5px solid var(--border-light)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1.5rem',
                                minHeight: '100px',
                                fontSize: '1.5rem',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                letterSpacing: '0.05em',
                                overflowWrap: 'break-word',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center'
                            }}>
                                {letterBuffer.length > 0 ? (
                                    letterBuffer.join('')
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '1.1rem', fontStyle: 'italic' }}>
                                        Recognized letters will appear here...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
