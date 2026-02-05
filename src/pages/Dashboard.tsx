import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sensorService } from '../services/sensors';
import { SignalProcessor } from '../utils/signalProcessor';
import { classifyWithML } from '../services/mlClient';
import { createSession, endSession, saveDetection } from '../services/database';
import { DeviceState, ProcessedWindow, Detection, DEFAULT_CONFIG } from '../types';

// Hardcoded demo detections
const DEMO_DETECTIONS: Detection[] = [
  {
    id: 'demo-1',
    sessionId: 'demo-session',
    userId: 'demo-user',
    timestamp: Date.now() - 120000,
    location: { latitude: 28.6139, longitude: 77.2090 },
    defectType: 'pothole',
    confidence: 0.92,
    severity: 8,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 6.2, peakMagnitude: 9.1, averageSpeed: 18, centroid: { latitude: 28.6139, longitude: 77.2090 }, sampleCount: 90 }
  },
  {
    id: 'demo-2',
    sessionId: 'demo-session',
    userId: 'demo-user',
    timestamp: Date.now() - 300000,
    location: { latitude: 28.6129, longitude: 77.2295 },
    defectType: 'speed_breaker',
    confidence: 0.88,
    severity: 5,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 4.1, peakMagnitude: 6.5, averageSpeed: 22, centroid: { latitude: 28.6129, longitude: 77.2295 }, sampleCount: 85 }
  },
  {
    id: 'demo-3',
    sessionId: 'demo-session',
    userId: 'demo-user',
    timestamp: Date.now() - 600000,
    location: { latitude: 28.6353, longitude: 77.2250 },
    defectType: 'pothole',
    confidence: 0.95,
    severity: 9,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 7.8, peakMagnitude: 11.2, averageSpeed: 15, centroid: { latitude: 28.6353, longitude: 77.2250 }, sampleCount: 92 }
  },
  {
    id: 'demo-4',
    sessionId: 'demo-session',
    userId: 'demo-user',
    timestamp: Date.now() - 900000,
    location: { latitude: 28.6280, longitude: 77.2180 },
    defectType: 'speed_breaker',
    confidence: 0.91,
    severity: 4,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 3.8, peakMagnitude: 5.9, averageSpeed: 25, centroid: { latitude: 28.6280, longitude: 77.2180 }, sampleCount: 88 }
  }
];

interface DashboardProps {
  userId: string;
}

function Dashboard({ userId }: DashboardProps) {
  const [isRiding, setIsRiding] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [stats, setStats] = useState({
    duration: 0,
    distance: 0,
    detections: 0,
    speed: 0
  });
  const [recentDetections, setRecentDetections] = useState<Detection[]>(DEMO_DETECTIONS);
  const [error, setError] = useState<string | null>(null);

  const processorRef = useRef<SignalProcessor | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize sensor state
    const state = sensorService.getState();
    setDeviceState(state);
  }, []);

  const handleProcessedWindow = useCallback(async (window: ProcessedWindow) => {
    if (!sessionId || !userId) return;

    try {
      const result = await classifyWithML(window);

      if (result.defectType !== 'normal' && result.confidence >= DEFAULT_CONFIG.confidenceThreshold) {
        const detection: Omit<Detection, 'id'> = {
          sessionId,
          userId,
          timestamp: window.endTime,
          location: window.centroid,
          defectType: result.defectType,
          confidence: result.confidence,
          severity: result.severity,
          processedWindow: window
        };

        await saveDetection(detection);

        setRecentDetections(prev => [{ ...detection, id: Date.now().toString() }, ...prev].slice(0, 10));
        setStats(prev => ({ ...prev, detections: prev.detections + 1 }));
      }
    } catch (e) {
      console.error('Detection error:', e);
    }
  }, [sessionId, userId]);

  const startRide = async () => {
    console.log('[Dashboard] Start Ride clicked');
    setError(null);

    // Request permissions but don't block - sensor service has fallbacks
    try {
      console.log('[Dashboard] Requesting sensor permissions...');
      const state = await sensorService.requestPermissions();
      setDeviceState(state);
      console.log('[Dashboard] Permissions result:', state);
      // No blocking checks - we proceed with fallbacks
    } catch (e) {
      console.warn('[Dashboard] Permission request had issues, proceeding anyway:', e);
    }

    try {
      console.log('[Dashboard] Creating session...');
      const newSessionId = await createSession();
      console.log('[Dashboard] Session created:', newSessionId);
      setSessionId(newSessionId);
      startTimeRef.current = Date.now();

      processorRef.current = new SignalProcessor(DEFAULT_CONFIG);
      processorRef.current.setWindowCallback(handleProcessedWindow);

      console.log('[Dashboard] Starting sensor collection...');

      sensorService.startCollection(
        (reading) => {
          processorRef.current?.addReading(reading);

          // Update stats
          const gps = reading.gps;
          if (gps.speed !== null) {
            setStats(prev => ({ ...prev, speed: gps.speed! * 3.6 })); // m/s to km/h
          }

          // Calculate distance
          if (lastPositionRef.current) {
            const dist = calculateDistance(
              lastPositionRef.current.lat, lastPositionRef.current.lng,
              gps.latitude, gps.longitude
            );
            setStats(prev => ({ ...prev, distance: prev.distance + dist }));
          }
          lastPositionRef.current = { lat: gps.latitude, lng: gps.longitude };
        },
        (state) => {
          setDeviceState(state);
        }
      );

      setIsRiding(true);
      setError(null);

      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000)
        }));
      }, 1000);
    } catch (e: any) {
      const message = e?.message || 'Failed to start ride';
      if (message.includes('not authenticated')) {
        setError('Please sign in to start a ride.');
      } else {
        setError(message);
      }
    }
  };

  const stopRide = async () => {
    // Clear the duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    sensorService.stopCollection();
    processorRef.current?.reset();

    if (sessionId) {
      try {
        await endSession(sessionId, {
          detectionCount: stats.detections,
          distanceTraveled: stats.distance
        });
      } catch (e) {
        console.error('Failed to end session:', e);
      }
    }

    setIsRiding(false);
    setSessionId(null);
    lastPositionRef.current = null;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page">
      {/* Status Card */}
      <div className="card">
        <h2 className="card-title">Ride Status</h2>



        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {deviceState && !deviceState.isMounted && isRiding && (
          <div className="alert alert-warning">
            <strong>⚠️ Mount Your Phone</strong>
            <p>Please mount your phone securely on your bike. Handheld detection is paused.</p>
          </div>
        )}

        {deviceState && !deviceState.isPortrait && isRiding && (
          <div className="alert alert-warning">
            <strong>📱 Portrait Mode Required</strong>
            <p>Please rotate your phone to portrait orientation.</p>
          </div>
        )}

        <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
          <div className="metric">
            <div className="metric-value">{formatDuration(stats.duration)}</div>
            <div className="metric-label">Duration</div>
          </div>
          <div className="metric">
            <div className="metric-value">{stats.distance.toFixed(2)}</div>
            <div className="metric-label">Distance (km)</div>
          </div>
          <div className="metric">
            <div className="metric-value">{stats.speed.toFixed(1)}</div>
            <div className="metric-label">Speed (km/h)</div>
          </div>
          <div className="metric">
            <div className="metric-value">{stats.detections}</div>
            <div className="metric-label">Detections</div>
          </div>
        </div>

        {!isRiding ? (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={startRide}
          >
            🚴 Start Ride
          </button>
        ) : (
          <button
            className="btn btn-danger btn-block btn-lg"
            onClick={stopRide}
          >
            ⏹️ Stop Ride
          </button>
        )}
      </div>

      {/* Recent Detections */}
      {recentDetections.length > 0 && (
        <div className="card">
          <h2 className="card-title">Recent Detections</h2>
          <div className="detection-list">
            {recentDetections.map((det) => (
              <div key={det.id} className="detection-item">
                <div>
                  <span className={`detection-type ${det.defectType}`}>
                    {det.defectType === 'pothole' ? '🕳️ Pothole' : '⬆️ Speed Breaker'}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(det.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '500' }}>
                    {(det.confidence * 100).toFixed(0)}% confidence
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    Severity: {det.severity}/10
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default Dashboard;
