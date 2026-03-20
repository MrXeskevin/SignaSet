import { Link } from 'react-router-dom'
import { Camera, Upload, Sparkles, Database } from 'lucide-react'

export default function HomePage() {
    return (
        <div className="page-enter">
            <section className="home-hero">
                <h1>
                    <span className="gradient-text">Gesture Data</span>
                    <br />Collector
                </h1>
                <p className="tagline">
                    Capture or upload hand gesture images, extract landmarks with MediaPipe,
                    and build your sign language dataset — all from the browser.
                </p>

                <div className="mode-cards">
                    <Link to="/capture" className="mode-card" id="mode-camera">
                        <div className="mode-icon camera-icon">
                            <Camera size={30} />
                        </div>
                        <h3>Capture with Camera</h3>
                        <p>Use your webcam to record hand gestures in real time with live landmark tracking</p>
                    </Link>

                    <Link to="/upload" className="mode-card" id="mode-upload">
                        <div className="mode-icon upload-icon">
                            <Upload size={30} />
                        </div>
                        <h3>Upload Image</h3>
                        <p>Upload an existing image and automatically extract hand landmarks for labeling</p>
                    </Link>
                </div>
            </section>

            <section style={{ maxWidth: 700, margin: '2rem auto 0', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: '0.75rem' }}>
                    <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>How It Works</h2>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1.25rem',
                    marginTop: '1rem'
                }}>
                    {[
                        { step: '1', title: 'Choose Mode', desc: 'Camera capture or image upload' },
                        { step: '2', title: 'Detect & Label', desc: 'MediaPipe extracts 21 hand landmarks' },
                        { step: '3', title: 'Build Dataset', desc: 'Structured data ready for ML training' },
                    ].map(item => (
                        <div key={item.step} className="card" style={{ textAlign: 'center', padding: '1.25rem 1rem' }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.9rem', margin: '0 auto 0.75rem'
                            }}>
                                {item.step}
                            </div>
                            <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{item.title}</h4>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.desc}</p>
                        </div>
                    ))}
                </div>

                <Link to="/dataset" className="btn btn-secondary btn-lg" style={{ marginTop: '2rem' }}>
                    <Database size={18} />
                    View Dataset
                </Link>
            </section>
        </div>
    )
}
