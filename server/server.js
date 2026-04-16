const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/images', express.static(path.join(__dirname, 'data', 'images')));

// Database setup
const dbPath = path.join(__dirname, 'data', 'gestures.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS gestures (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    landmarks TEXT,
    sequence TEXT,
    image_url TEXT,
    source TEXT NOT NULL CHECK(source IN ('camera', 'upload')),
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'data', 'images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- API Routes ---

// Save a gesture sample
app.post('/api/gestures', (req, res) => {
    try {
        const { label, landmarks, sequence, imageData, source } = req.body;

        if (!label || !label.trim()) {
            return res.status(400).json({ error: 'Label is required' });
        }

        // Validate landmarks OR sequence
        if ((!landmarks || landmarks.length === 0) && (!sequence || sequence.length === 0)) {
            return res.status(400).json({ error: 'Landmarks or sequence is required' });
        }
        if (!source || !['camera', 'upload'].includes(source)) {
            return res.status(400).json({ error: 'Source must be "camera" or "upload"' });
        }

        const id = uuidv4();
        const timestamp = new Date().toISOString();
        let imageUrl = null;

        // Save base64 image to file
        if (imageData) {
            const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const filename = `${id}.${ext}`;
                const filepath = path.join(__dirname, 'data', 'images', filename);
                fs.writeFileSync(filepath, buffer);
                imageUrl = `/images/${filename}`;
            }
        }

        const stmt = db.prepare(`
      INSERT INTO gestures (id, label, landmarks, sequence, image_url, source, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            label.trim(),
            landmarks ? JSON.stringify(landmarks) : null,
            sequence ? JSON.stringify(sequence) : null,
            imageUrl,
            source,
            timestamp
        );

        res.status(201).json({
            message: 'Gesture saved successfully',
            gesture: { id, label: label.trim(), landmarks, imageUrl, source, timestamp }
        });
    } catch (err) {
        console.error('Error saving gesture:', err);
        res.status(500).json({ error: 'Failed to save gesture' });
    }
});

// Get all gestures
app.get('/api/gestures', (req, res) => {
    try {
        const { label, source, limit = 50, offset = 0 } = req.query;
        let query = 'SELECT * FROM gestures';
        const conditions = [];
        const params = [];

        if (label) {
            conditions.push('label LIKE ?');
            params.push(`%${label}%`);
        }
        if (source) {
            conditions.push('source = ?');
            params.push(source);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const gestures = db.prepare(query).all(...params);

        // Parse landmarks and sequence back to arrays
        const parsed = gestures.map(g => ({
            ...g,
            landmarks: g.landmarks ? JSON.parse(g.landmarks) : null,
            sequence: g.sequence ? JSON.parse(g.sequence) : null
        }));

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM gestures';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        const { total } = db.prepare(countQuery).get(...params.slice(0, -2));

        res.json({ gestures: parsed, total });
    } catch (err) {
        console.error('Error fetching gestures:', err);
        res.status(500).json({ error: 'Failed to fetch gestures' });
    }
});

// Get landmarks only for classifier seeding
app.get('/api/gestures/landmarks-only', (req, res) => {
    try {
        const gestures = db.prepare('SELECT label, landmarks FROM gestures WHERE landmarks IS NOT NULL').all();
        const parsed = gestures.map(g => ({
            label: g.label,
            landmarks: JSON.parse(g.landmarks)
        }));
        res.json(parsed);
    } catch (err) {
        console.error('Error fetching landmarks-only:', err);
        res.status(500).json({ error: 'Failed to fetch landmarks' });
    }
});

// Get a single gesture
app.get('/api/gestures/:id', (req, res) => {
    try {
        const gesture = db.prepare('SELECT * FROM gestures WHERE id = ?').get(req.params.id);
        if (!gesture) return res.status(404).json({ error: 'Gesture not found' });
        if (gesture.landmarks) gesture.landmarks = JSON.parse(gesture.landmarks);
        if (gesture.sequence) gesture.sequence = JSON.parse(gesture.sequence);
        res.json(gesture);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch gesture' });
    }
});

// Update a gesture
app.put('/api/gestures/:id', (req, res) => {
    try {
        const { label } = req.body;
        if (!label || !label.trim()) {
            return res.status(400).json({ error: 'Label is required' });
        }

        const result = db.prepare('UPDATE gestures SET label = ? WHERE id = ?')
            .run(label.trim(), req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Gesture not found' });
        }

        res.json({ message: 'Gesture updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update gesture' });
    }
});

// Delete a gesture
app.delete('/api/gestures/:id', (req, res) => {
    try {
        const gesture = db.prepare('SELECT * FROM gestures WHERE id = ?').get(req.params.id);
        if (!gesture) return res.status(404).json({ error: 'Gesture not found' });

        // Delete associated image
        if (gesture.image_url) {
            const imagePath = path.join(__dirname, 'data', gesture.image_url);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        db.prepare('DELETE FROM gestures WHERE id = ?').run(req.params.id);
        res.json({ message: 'Gesture deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete gesture' });
    }
});

// Get dataset stats
app.get('/api/stats', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM gestures').get().count;
        const labels = db.prepare('SELECT label, COUNT(*) as count FROM gestures GROUP BY label ORDER BY count DESC').all();
        const sources = db.prepare('SELECT source, COUNT(*) as count FROM gestures GROUP BY source').all();
        res.json({ total, labels, sources });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Export dataset as JSON
app.get('/api/export', (req, res) => {
    try {
        const gestures = db.prepare('SELECT * FROM gestures ORDER BY label, created_at').all();
        const dataset = gestures.map(g => ({
            id: g.id,
            label: g.label,
            landmarks: JSON.parse(g.landmarks),
            source: g.source,
            timestamp: g.timestamp
        }));
        res.setHeader('Content-Disposition', 'attachment; filename=gesture_dataset.json');
        res.json(dataset);
    } catch (err) {
        res.status(500).json({ error: 'Failed to export dataset' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Signaset API server running on http://localhost:${PORT}`);
});
