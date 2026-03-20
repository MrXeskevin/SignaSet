import { useState, useEffect, useCallback } from 'react'
import {
    Database, Search, Camera, Upload, Trash2, Edit3, Download,
    ChevronLeft, ChevronRight, X, Save, BarChart3, Image as ImageIcon
} from 'lucide-react'
import { getGestures, getStats, deleteGesture, updateGesture, getImageUrl, getExportUrl } from '../services/api'

export default function DatasetPreview({ addToast }) {
    const [gestures, setGestures] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [searchLabel, setSearchLabel] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [editModal, setEditModal] = useState(null) // { id, label }
    const [editLabel, setEditLabel] = useState('')
    const pageSize = 12

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = { limit: pageSize, offset: page * pageSize }
            if (searchLabel) params.label = searchLabel
            if (sourceFilter) params.source = sourceFilter

            const [gestureRes, statsRes] = await Promise.all([
                getGestures(params),
                getStats(),
            ])

            setGestures(gestureRes.gestures)
            setTotal(gestureRes.total)
            setStats(statsRes)
        } catch (err) {
            addToast('Failed to load dataset.', 'error')
        } finally {
            setLoading(false)
        }
    }, [page, searchLabel, sourceFilter, addToast])

    useEffect(() => { fetchData() }, [fetchData])

    const handleDelete = async (id, label) => {
        if (!window.confirm(`Delete gesture "${label}"?`)) return
        try {
            await deleteGesture(id)
            addToast(`Deleted "${label}"`, 'success')
            fetchData()
        } catch (err) {
            addToast('Failed to delete gesture.', 'error')
        }
    }

    const handleEdit = async () => {
        if (!editLabel.trim() || !editModal) return
        try {
            await updateGesture(editModal.id, editLabel.trim())
            addToast('Label updated!', 'success')
            setEditModal(null)
            fetchData()
        } catch (err) {
            addToast('Failed to update.', 'error')
        }
    }

    const openEdit = (gesture) => {
        setEditModal({ id: gesture.id, label: gesture.label })
        setEditLabel(gesture.label)
    }

    const totalPages = Math.ceil(total / pageSize)

    const handleExport = () => {
        window.open(getExportUrl(), '_blank')
    }

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Dataset Preview</h1>
                <p>Browse, search, and manage your collected gesture dataset</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Total Gestures</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.labels.length}</div>
                        <div className="stat-label">Unique Labels</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">
                            {stats.sources.find(s => s.source === 'camera')?.count || 0}
                        </div>
                        <div className="stat-label">Camera Captures</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">
                            {stats.sources.find(s => s.source === 'upload')?.count || 0}
                        </div>
                        <div className="stat-label">Uploaded Images</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
                    <Search size={16} style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--text-muted)'
                    }} />
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Search by label..."
                        value={searchLabel}
                        onChange={e => { setSearchLabel(e.target.value); setPage(0) }}
                        style={{ paddingLeft: 36, maxWidth: '100%' }}
                        id="search-input"
                    />
                </div>

                <div className="filter-group">
                    <button className={!sourceFilter ? 'active' : ''} onClick={() => { setSourceFilter(''); setPage(0) }}>
                        All
                    </button>
                    <button className={sourceFilter === 'camera' ? 'active' : ''} onClick={() => { setSourceFilter('camera'); setPage(0) }}>
                        <Camera size={13} /> Camera
                    </button>
                    <button className={sourceFilter === 'upload' ? 'active' : ''} onClick={() => { setSourceFilter('upload'); setPage(0) }}>
                        <Upload size={13} /> Upload
                    </button>
                </div>

                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-secondary btn-sm" onClick={handleExport} id="btn-export">
                        <Download size={14} /> Export JSON
                    </button>
                </div>
            </div>

            {/* Gesture Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner dark" style={{ width: 32, height: 32, margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading dataset...</p>
                </div>
            ) : gestures.length === 0 ? (
                <div className="empty-state">
                    <Database size={64} />
                    <h3>No Gestures Yet</h3>
                    <p>Start collecting gestures by capturing with your camera or uploading images.</p>
                </div>
            ) : (
                <>
                    <div className="dataset-grid">
                        {gestures.map(g => (
                            <div className="gesture-card" key={g.id}>
                                <div className="gesture-image">
                                    {g.image_url ? (
                                        <img src={getImageUrl(g.image_url)} alt={g.label} loading="lazy" />
                                    ) : (
                                        <div className="no-image">
                                            <ImageIcon size={24} />
                                        </div>
                                    )}
                                </div>
                                <div className="gesture-info">
                                    <div className="gesture-label">{g.label}</div>
                                    <div className="gesture-meta">
                                        <span className={`badge ${g.source}`}>
                                            {g.source === 'camera' ? <Camera size={10} /> : <Upload size={10} />}
                                            {g.source}
                                        </span>
                                        <span>{new Date(g.timestamp).toLocaleDateString()}</span>
                                        <span>{g.landmarks.length} pts</span>
                                    </div>
                                    <div className="gesture-actions">
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>
                                            <Edit3 size={14} /> Edit
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ color: 'var(--accent-danger)' }}
                                            onClick={() => handleDelete(g.id, g.label)}
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '1rem', marginTop: '2rem'
                        }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPage(p => p - 1)}
                                disabled={page === 0}
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Page {page + 1} of {totalPages}
                            </span>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages - 1}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Edit Modal */}
            {editModal && (
                <div className="modal-backdrop" onClick={() => setEditModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Edit Gesture Label</h3>
                        <div className="form-group">
                            <label htmlFor="edit-label">Label</label>
                            <input
                                id="edit-label"
                                className="form-input"
                                type="text"
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEdit()}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setEditModal(null)}>
                                <X size={16} /> Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleEdit} disabled={!editLabel.trim()}>
                                <Save size={16} /> Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
