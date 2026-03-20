# Signaset — Gesture Data Collector

A web-based gesture data collection platform for sign language dataset creation. Capture or upload hand gesture images, extract landmarks with MediaPipe, and build structured datasets for machine learning.

![Signaset](https://img.shields.io/badge/Signaset-Gesture_Data_Collector-6366f1?style=for-the-badge)

## Features

- **Camera Capture Mode** — Access webcam, detect hands in real time with MediaPipe, capture frames with landmark overlay
- **Image Upload Mode** — Upload images, auto-detect hand landmarks, preview results
- **21-Point Hand Landmarks** — MediaPipe extracts precise x, y, z coordinates for all 21 hand keypoints
- **Label & Save** — Label each gesture and store structured data to the backend
- **Dataset Preview** — Browse, search, filter, edit, and delete saved gestures
- **Export** — Download your entire dataset as JSON for ML training
- **Validation** — Prevents saving without labels or without detected landmarks

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React + Vite                        |
| Styling   | Vanilla CSS (glassmorphism, modern) |
| Hand Tracking | MediaPipe Hands               |
| Backend   | Node.js + Express                   |
| Database  | SQLite (via better-sqlite3)         |
| Icons     | Lucide React                        |

## Project Structure

```
Signaset/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── CameraCapture.jsx
│   │   │   ├── ImageUpload.jsx
│   │   │   ├── DatasetPreview.jsx
│   │   │   └── Toast.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── vite.config.js
├── server/                  # Express backend
│   ├── server.js
│   ├── data/
│   │   ├── gestures.db     # SQLite database (auto-created)
│   │   └── images/         # Stored gesture images
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd Signaset
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../client
   npm install
   ```

### Running the App

1. **Start the backend** (Terminal 1)
   ```bash
   cd server
   npm run dev
   ```
   Server starts at `http://localhost:3001`

2. **Start the frontend** (Terminal 2)
   ```bash
   cd client
   npm run dev
   ```
   App opens at `http://localhost:5173`

## Data Format

Each saved gesture is stored with this structure:

```json
{
  "id": "uuid",
  "label": "A",
  "landmarks": [
    { "x": 0.523, "y": 0.412, "z": -0.032 },
    { "x": 0.498, "y": 0.352, "z": -0.018 },
    // ... 21 points total
  ],
  "image_url": "/images/uuid.jpg",
  "source": "camera",
  "timestamp": "2026-03-20T13:30:00.000Z"
}
```

## API Endpoints

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | `/api/gestures`       | Save a new gesture       |
| GET    | `/api/gestures`       | List gestures (paginated)|
| GET    | `/api/gestures/:id`   | Get single gesture       |
| PUT    | `/api/gestures/:id`   | Update gesture label     |
| DELETE | `/api/gestures/:id`   | Delete a gesture         |
| GET    | `/api/stats`          | Get dataset statistics   |
| GET    | `/api/export`         | Export dataset as JSON   |

## License

MIT
