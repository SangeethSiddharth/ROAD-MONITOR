# RoadWatch - Civic Road Damage Reporting PWA

A Progressive Web App for AI-powered road damage detection using smartphone sensors. Built for civic engagement in India, enabling citizens to detect potholes and speed breakers while cycling, and auto-generate RTI (Right to Information) applications.

## Features

### 🚴 Live Ride Dashboard
- Real-time sensor data collection (accelerometer + GPS)
- Device motion analysis with rolling window segmentation
- Automatic pothole and speed breaker detection
- Battery-conscious design with foreground-only operation

### 🗺️ Interactive Map
- View all detected road defects on an OpenStreetMap-based map
- Filter between individual detections and verified (aggregated) reports
- Real-time updates via Firestore subscriptions

### 📄 RTI Generator
- Auto-generate legally formatted RTI applications
- Addressed to appropriate municipal authorities
- Includes GPS coordinates, map links, severity scores
- PDF and text export options

### ⚙️ Admin Dashboard
- Overview of all detections and verified reports
- Statistics on volunteers, defect types, severity levels
- Quick access to RTI generation for any verified report

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Custom CSS (no frameworks)
- **Maps**: Leaflet + React-Leaflet + OpenStreetMap
- **Backend**: Firebase (Firestore, Auth, Functions)
- **PDF**: jsPDF
- **PWA**: vite-plugin-pwa

## Browser APIs Used

- `DeviceMotionEvent` - accelerometer data
- `Geolocation API` - GPS coordinates and speed
- `Screen Orientation API` - detect portrait/landscape changes

## Setup

1. **Clone and install**
   ```bash
   cd RoadWatch
   npm install
   cd functions && npm install && cd ..
   ```

2. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Anonymous Authentication
   - Create a Firestore database
   - Copy `.env.example` to `.env.local` and fill in your Firebase config

3. **Deploy Firestore rules and indexes**
   ```bash
   firebase deploy --only firestore
   ```

4. **Deploy Cloud Functions**
   ```bash
   firebase deploy --only functions
   ```

5. **Run locally**
   ```bash
   npm run dev
   ```

## Production Deployment

```bash
npm run build
firebase deploy --only hosting
```

## Browser Requirements

- HTTPS required (secure context for sensor access)
- Modern browser with DeviceMotion API support
- GPS/Location services enabled
- Portrait orientation recommended

## Signal Processing

The app uses a rolling window approach:
1. Collect accelerometer + GPS data continuously
2. Segment into 1.5-second overlapping windows
3. Calculate vibration magnitude (RMS) and peak values
4. Filter by minimum speed threshold (5 km/h)
5. Detect spikes exceeding magnitude threshold
6. Send processed windows to ML backend for classification

## ML Integration

- Client includes a heuristic classifier as fallback
- Server-side Firebase Function performs ML inference
- Replace `classifyDefectML()` in functions with actual TensorFlow model

## RTI Application

Generated RTI documents include:
- Addressed to the Public Information Officer
- GPS coordinates with Google Maps link
- Defect type and severity score
- Number of independent citizen verifications
- Public safety risk statement
- Standard RTI format per RTI Act, 2005

## License

MIT
