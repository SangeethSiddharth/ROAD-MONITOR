import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { subscribeToDetections, getAggregatedReports } from '../services/database';
import { Detection, AggregatedReport } from '../types';

// Hardcoded demo data for Delhi area
const DEMO_DETECTIONS: Detection[] = [
  {
    id: 'map-demo-1',
    sessionId: 'demo-session',
    userId: 'user-1',
    timestamp: Date.now() - 3600000,
    location: { latitude: 28.6139, longitude: 77.2090 },
    defectType: 'pothole',
    confidence: 0.92,
    severity: 8,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 6.2, peakMagnitude: 9.1, averageSpeed: 18, centroid: { latitude: 28.6139, longitude: 77.2090 }, sampleCount: 90 }
  },
  {
    id: 'map-demo-2',
    sessionId: 'demo-session',
    userId: 'user-2',
    timestamp: Date.now() - 7200000,
    location: { latitude: 28.6280, longitude: 77.2180 },
    defectType: 'speed_breaker',
    confidence: 0.88,
    severity: 5,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 4.1, peakMagnitude: 6.5, averageSpeed: 22, centroid: { latitude: 28.6280, longitude: 77.2180 }, sampleCount: 85 }
  },
  {
    id: 'map-demo-3',
    sessionId: 'demo-session',
    userId: 'user-3',
    timestamp: Date.now() - 10800000,
    location: { latitude: 28.6353, longitude: 77.2250 },
    defectType: 'pothole',
    confidence: 0.95,
    severity: 9,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 7.8, peakMagnitude: 11.2, averageSpeed: 15, centroid: { latitude: 28.6353, longitude: 77.2250 }, sampleCount: 92 }
  },
  {
    id: 'map-demo-4',
    sessionId: 'demo-session',
    userId: 'user-1',
    timestamp: Date.now() - 14400000,
    location: { latitude: 28.6200, longitude: 77.2350 },
    defectType: 'pothole',
    confidence: 0.89,
    severity: 7,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 5.5, peakMagnitude: 8.2, averageSpeed: 20, centroid: { latitude: 28.6200, longitude: 77.2350 }, sampleCount: 87 }
  },
  {
    id: 'map-demo-5',
    sessionId: 'demo-session',
    userId: 'user-4',
    timestamp: Date.now() - 18000000,
    location: { latitude: 28.6450, longitude: 77.2100 },
    defectType: 'speed_breaker',
    confidence: 0.93,
    severity: 4,
    processedWindow: { startTime: 0, endTime: 0, magnitude: 3.9, peakMagnitude: 5.8, averageSpeed: 28, centroid: { latitude: 28.6450, longitude: 77.2100 }, sampleCount: 91 }
  }
];

const DEMO_AGGREGATED_REPORTS: AggregatedReport[] = [
  {
    id: 'agg-demo-1',
    geohash: 'ttnfv2k',
    location: { latitude: 28.6139, longitude: 77.2090 },
    defectType: 'pothole',
    averageSeverity: 8.2,
    reportCount: 12,
    uniqueUsers: ['user-1', 'user-2', 'user-3', 'user-5', 'user-6'],
    firstReported: Date.now() - 86400000 * 7,
    lastReported: Date.now() - 3600000,
    credibilityScore: 0.91
  },
  {
    id: 'agg-demo-2',
    geohash: 'ttnfv3m',
    location: { latitude: 28.6353, longitude: 77.2250 },
    defectType: 'pothole',
    averageSeverity: 9.1,
    reportCount: 8,
    uniqueUsers: ['user-2', 'user-3', 'user-4', 'user-7'],
    firstReported: Date.now() - 86400000 * 5,
    lastReported: Date.now() - 7200000,
    credibilityScore: 0.85
  },
  {
    id: 'agg-demo-3',
    geohash: 'ttnfv1p',
    location: { latitude: 28.6280, longitude: 77.2180 },
    defectType: 'speed_breaker',
    averageSeverity: 5.0,
    reportCount: 15,
    uniqueUsers: ['user-1', 'user-2', 'user-4', 'user-5', 'user-8', 'user-9'],
    firstReported: Date.now() - 86400000 * 14,
    lastReported: Date.now() - 1800000,
    credibilityScore: 0.94
  }
];

// Custom marker icons
const potholeIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="background:#d32f2f;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🕳️</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const speedBreakerIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="background:#f57c00;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">⬆️</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 15 });

    map.on('locationfound', (e) => {
      setPosition([e.latlng.lat, e.latlng.lng]);
    });
  }, [map]);

  return position ? (
    <Circle
      center={position}
      radius={50}
      pathOptions={{ color: '#1976d2', fillColor: '#1976d2', fillOpacity: 0.3 }}
    />
  ) : null;
}

function MapPage() {
  const [detections, setDetections] = useState<Detection[]>(DEMO_DETECTIONS);
  const [aggregatedReports, setAggregatedReports] = useState<AggregatedReport[]>(DEMO_AGGREGATED_REPORTS);
  const [viewMode, setViewMode] = useState<'detections' | 'aggregated'>('detections');
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState<[number, number]>([28.6200, 77.2200]); // Delhi center for demo

  useEffect(() => {
    // Get user's location for initial center (falls back to Delhi demo location)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {} // Keep Delhi center on error
      );
    }
  }, []);

  useEffect(() => {
    // Try to load real data, but keep demo data as fallback
    try {
      const unsubscribe = subscribeToDetections((newDetections) => {
        if (newDetections.length > 0) {
          setDetections([...DEMO_DETECTIONS, ...newDetections]);
        }
      });

      getAggregatedReports().then((reports) => {
        if (reports.length > 0) {
          setAggregatedReports([...DEMO_AGGREGATED_REPORTS, ...reports]);
        }
      });

      return () => unsubscribe();
    } catch (e) {
      // Keep demo data on error
    }
  }, []);

  const getSeverityColor = (severity: number): string => {
    if (severity >= 7) return '#d32f2f';
    if (severity >= 4) return '#f57c00';
    return '#388e3c';
  };

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="page" style={{ padding: 0 }}>
      {/* View Mode Toggle */}
      <div style={{ padding: '0.5rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="grid grid-2" style={{ gap: '0.5rem' }}>
          <button
            className={`btn ${viewMode === 'detections' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('detections')}
          >
            All Detections ({detections.length})
          </button>
          <button
            className={`btn ${viewMode === 'aggregated' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('aggregated')}
          >
            Verified ({aggregatedReports.length})
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 'calc(100vh - 180px)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker />

            {viewMode === 'detections' && detections.map((det) => (
              <Marker
                key={det.id}
                position={[det.location.latitude, det.location.longitude]}
                icon={det.defectType === 'pothole' ? potholeIcon : speedBreakerIcon}
              >
                <Popup>
                  <div style={{ minWidth: '150px' }}>
                    <strong style={{ color: det.defectType === 'pothole' ? '#d32f2f' : '#f57c00' }}>
                      {det.defectType === 'pothole' ? '🕳️ Pothole' : '⬆️ Speed Breaker'}
                    </strong>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      <div>Severity: {det.severity}/10</div>
                      <div>Confidence: {(det.confidence * 100).toFixed(0)}%</div>
                      <div style={{ color: '#757575' }}>{formatTimestamp(det.timestamp)}</div>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <div className="severity-bar">
                        <div 
                          className={`severity-fill ${det.severity >= 7 ? 'severity-high' : det.severity >= 4 ? 'severity-medium' : 'severity-low'}`}
                          style={{ width: `${det.severity * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {viewMode === 'aggregated' && aggregatedReports.map((report) => (
              <Circle
                key={report.id}
                center={[report.location.latitude, report.location.longitude]}
                radius={30 + report.reportCount * 5}
                pathOptions={{
                  color: getSeverityColor(report.averageSeverity),
                  fillColor: getSeverityColor(report.averageSeverity),
                  fillOpacity: 0.4
                }}
              >
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    <strong style={{ color: getSeverityColor(report.averageSeverity) }}>
                      {report.defectType === 'pothole' ? '🕳️ Verified Pothole' : '⬆️ Verified Speed Breaker'}
                    </strong>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      <div>Average Severity: {report.averageSeverity.toFixed(1)}/10</div>
                      <div>Reports: {report.reportCount}</div>
                      <div>Unique Reporters: {report.uniqueUsers.length}</div>
                      <div>Credibility: {(report.credibilityScore * 100).toFixed(0)}%</div>
                    </div>
                    <a
                      href={`/rti?reportId=${report.id}`}
                      style={{ 
                        display: 'block', 
                        marginTop: '0.5rem', 
                        padding: '0.5rem', 
                        background: 'var(--primary)', 
                        color: 'white', 
                        textAlign: 'center',
                        borderRadius: '4px',
                        textDecoration: 'none'
                      }}
                    >
                      Generate RTI
                    </a>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div style={{ 
        padding: '0.5rem 1rem', 
        background: 'var(--surface)', 
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        fontSize: '0.75rem'
      }}>
        <span><span style={{ color: '#d32f2f' }}>●</span> Pothole</span>
        <span><span style={{ color: '#f57c00' }}>●</span> Speed Breaker</span>
        <span><span style={{ color: '#1976d2' }}>●</span> Your Location</span>
      </div>
    </div>
  );
}

export default MapPage;
