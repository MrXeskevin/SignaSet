const API_BASE = '/api';

export async function saveGesture({ label, landmarks, sequence, imageData, source }) {
    const res = await fetch(`${API_BASE}/gestures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, landmarks, sequence, imageData, source }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save gesture');
    }
    return res.json();
}

export async function getGestures(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/gestures?${query}`);
    if (!res.ok) throw new Error('Failed to fetch gestures');
    return res.json();
}

export async function updateGesture(id, label) {
    const res = await fetch(`${API_BASE}/gestures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error('Failed to update gesture');
    return res.json();
}

export async function deleteGesture(id) {
    const res = await fetch(`${API_BASE}/gestures/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete gesture');
    return res.json();
}

export async function getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
}

export function getImageUrl(imageUrl) {
    if (!imageUrl) return null;
    // In dev, Vite proxy handles it; in production, same origin
    return imageUrl;
}

export function getExportUrl() {
    return `${API_BASE}/export`;
}
