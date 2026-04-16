import { Routes, Route } from 'react-router-dom'
import { useState, useCallback } from 'react'
import Navbar from './components/Navbar'
import HomePage from './components/HomePage'
import CameraCapture from './components/CameraCapture'
import ImageUpload from './components/ImageUpload'
import DatasetPreview from './components/DatasetPreview'
import RecognizeMode from './components/RecognizeMode'
import Toast from './components/Toast'

function App() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <>
      <Navbar />
      <main className="page-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/capture" element={<CameraCapture addToast={addToast} />} />
          <Route path="/upload" element={<ImageUpload addToast={addToast} />} />
          <Route path="/dataset" element={<DatasetPreview addToast={addToast} />} />
          <Route path="/recognize" element={<RecognizeMode addToast={addToast} />} />
        </Routes>
      </main>
      <footer className="footer">
        Signaset — Gesture Data Collector · Built for Sign Language Dataset Creation
      </footer>
      <Toast toasts={toasts} />
    </>
  )
}

export default App
