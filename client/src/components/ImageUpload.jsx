import { useRef, useState, useCallback } from 'react'
import { Upload, Image as ImageIcon, Save, RotateCcw, HandMetal, AlertCircle, FileUp } from 'lucide-react'
import { saveGesture } from '../services/api'

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
]

export default function ImageUpload({ addToast }) {
    const fileInputRef = useRef(null)
    const canvasRef = useRef(null)

    const [imagePreview, setImagePreview] = useState(null)
    const [originalImage, setOriginalImage] = useState(null)
    const [landmarks, setLandmarks] = useState(null)
    const [label, setLabel] = useState('')
    const [saving, setSaving] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [error, setError] = useState(null)

    // Draw landmarks on canvas overlay
    const drawLandmarksOnImage = useCallback((imageSrc, landmarkPoints) => {
        return new Promise((resolve) => {
            const img = new window.Image()
            img.onload = () => {
                const canvas = canvasRef.current
                if (!canvas) return resolve(imageSrc)

                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')

                ctx.drawImage(img, 0, 0)

                // Draw connections
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)'
                ctx.lineWidth = Math.max(2, img.width / 200)
                for (const [i, j] of HAND_CONNECTIONS) {
                    const a = landmarkPoints[i]
                    const b = landmarkPoints[j]
                    ctx.beginPath()
                    ctx.moveTo(a.x * img.width, a.y * img.height)
                    ctx.lineTo(b.x * img.width, b.y * img.height)
                    ctx.stroke()
                }

                // Draw points
                const pointRadius = Math.max(3, img.width / 120)
                landmarkPoints.forEach((point, idx) => {
                    const x = point.x * img.width
                    const y = point.y * img.height
                    const isTip = [4, 8, 12, 16, 20].includes(idx)
                    const r = isTip ? pointRadius * 1.6 : pointRadius

                    ctx.beginPath()
                    ctx.arc(x, y, r, 0, Math.PI * 2)
                    ctx.fillStyle = isTip ? '#10b981' : '#6366f1'
                    ctx.fill()

                    if (isTip) {
                        ctx.beginPath()
                        ctx.arc(x, y, r + 3, 0, Math.PI * 2)
                        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'
                        ctx.lineWidth = 2
                        ctx.stroke()
                    }
                })

                resolve(canvas.toDataURL('image/jpeg', 0.92))
            }
            img.src = imageSrc
        })
    }, [])

    // Process image with MediaPipe
    const processImage = useCallback(async (imageSrc) => {
        try {
            setProcessing(true)
            setError(null)
            setLandmarks(null)

            const { Hands } = await import('@mediapipe/hands')

            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            })

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                selfieMode: false,
            })

            return new Promise((resolve) => {
                hands.onResults(async (results) => {
                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        const detected = results.multiHandLandmarks[0]
                        const landmarkData = detected.map(p => ({ x: p.x, y: p.y, z: p.z }))

                        setLandmarks(landmarkData)
                        const overlayImage = await drawLandmarksOnImage(imageSrc, detected)
                        setImagePreview(overlayImage)
                        setError(null)
                        addToast(`Detected ${landmarkData.length} hand landmarks!`, 'success')
                    } else {
                        setLandmarks(null)
                        setError('No hand detected. Please upload a clearer image.')
                        addToast('No hand detected in this image.', 'error')
                    }
                    setProcessing(false)
                    hands.close()
                    resolve()
                })

                // Load and send image
                const img = new window.Image()
                img.onload = () => {
                    hands.send({ image: img })
                }
                img.src = imageSrc
            })
        } catch (err) {
            console.error('MediaPipe error:', err)
            setError('Failed to process image. Please try again.')
            setProcessing(false)
        }
    }, [addToast, drawLandmarksOnImage])

    // Handle file selection
    const handleFile = useCallback(async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            addToast('Please select a valid image file.', 'error')
            return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
            const imageSrc = e.target.result
            setOriginalImage(imageSrc)
            setImagePreview(imageSrc)
            setLabel('')
            setLandmarks(null)
            setError(null)
            await processImage(imageSrc)
        }
        reader.readAsDataURL(file)
    }, [addToast, processImage])

    // Drag and drop handlers
    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
    const handleDragLeave = () => setDragOver(false)
    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        handleFile(file)
    }

    // Save gesture
    const handleSave = async () => {
        if (!label.trim()) {
            addToast('Please enter a label for this gesture.', 'error')
            return
        }
        if (!landmarks) {
            addToast('No landmarks detected. Cannot save.', 'error')
            return
        }

        try {
            setSaving(true)
            await saveGesture({
                label: label.trim(),
                landmarks,
                imageData: originalImage,
                source: 'upload',
            })
            addToast(`Gesture "${label.trim()}" saved successfully!`, 'success')
            reset()
        } catch (err) {
            addToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    // Reset state
    const reset = () => {
        setImagePreview(null)
        setOriginalImage(null)
        setLandmarks(null)
        setLabel('')
        setError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Upload Image</h1>
                <p>Upload an image containing a hand gesture for landmark extraction</p>
            </div>

            {/* Hidden canvas for drawing landmarks */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="media-section">
                {/* Upload / Image Preview */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon secondary"><Upload size={22} /></div>
                            <div>
                                <h2>Image Input</h2>
                                <p>Upload or drag & drop an image</p>
                            </div>
                        </div>

                        {!imagePreview ? (
                            <div
                                className={`upload-area ${dragOver ? 'dragover' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                id="upload-area"
                            >
                                <div className="upload-icon">
                                    <FileUp size={52} />
                                </div>
                                <h3>Drop an image here or click to browse</h3>
                                <p>Supports JPG, PNG, WebP • Max 10MB</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={e => handleFile(e.target.files[0])}
                                />
                            </div>
                        ) : (
                            <div className="preview-image-wrapper" style={{ position: 'relative' }}>
                                <img src={imagePreview} alt="Uploaded gesture" />
                                {processing && (
                                    <div className="loading-overlay">
                                        <div className="spinner dark" style={{ width: 32, height: 32 }}></div>
                                        <span>Processing with MediaPipe...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {imagePreview && (
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={16} /> Change Image
                                </button>
                                <button className="btn btn-ghost" onClick={reset}>
                                    <RotateCcw size={16} /> Reset
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={e => handleFile(e.target.files[0])}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Label & Save Panel */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-icon success"><Save size={22} /></div>
                            <div>
                                <h2>Label & Save</h2>
                                <p>Add a label and save the gesture data</p>
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                color: 'var(--accent-danger)', marginBottom: '1rem',
                                fontSize: '0.875rem', fontWeight: 500
                            }}>
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        {landmarks ? (
                            <>
                                <div style={{ marginBottom: '1rem' }}>
                                    <span className="landmark-badge">
                                        <HandMetal size={14} /> {landmarks.length} landmarks detected
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="upload-label">Gesture Label</label>
                                    <input
                                        id="upload-label"
                                        className="form-input"
                                        type="text"
                                        placeholder='e.g. "A", "Hello", "Peace"'
                                        value={label}
                                        onChange={e => setLabel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    className="btn btn-success btn-lg btn-full"
                                    onClick={handleSave}
                                    disabled={saving || !label.trim()}
                                    id="btn-save-upload"
                                >
                                    {saving ? <div className="spinner" /> : <Save size={18} />}
                                    {saving ? 'Saving...' : 'Save Gesture'}
                                </button>
                            </>
                        ) : (
                            <div className="preview-placeholder" style={{ aspectRatio: 'auto', padding: '2rem 1rem' }}>
                                <ImageIcon size={48} />
                                <span>{processing ? 'Analyzing image...' : 'Upload an image to get started'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
