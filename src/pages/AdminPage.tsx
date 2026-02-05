import React, { useState, useEffect } from 'react';
import { getAggregatedReports, subscribeToDetections } from '../services/database';
import { AggregatedReport, Detection } from '../types';

function AdminPage() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [reports, setReports] = useState<AggregatedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'detections' | 'reports'>('overview');

  useEffect(() => {
    const unsubscribe = subscribeToDetections((data) => {
      setDetections(data);
      setLoading(false);
    });

    getAggregatedReports().then(setReports);

    return () => unsubscribe();
  }, []);

  const stats = {
    totalDetections: detections.length,
    potholes: detections.filter(d => d.defectType === 'pothole').length,
    speedBreakers: detections.filter(d => d.defectType === 'speed_breaker').length,
    verifiedReports: reports.length,
    uniqueVolunteers: new Set(detections.map(d => d.userId)).size,
    highSeverity: detections.filter(d => d.severity >= 7).length
  };

  const recentActivity = detections.slice(0, 20);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Tab Navigation */}
      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <button
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`btn ${activeTab === 'detections' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('detections')}
        >
          Detections
        </button>
        <button
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="card">
            <h2 className="card-title">📊 Dashboard Overview</h2>
            <div className="grid grid-3">
              <div className="metric">
                <div className="metric-value">{stats.totalDetections}</div>
                <div className="metric-label">Total Detections</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: '#d32f2f' }}>{stats.potholes}</div>
                <div className="metric-label">Potholes</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: '#f57c00' }}>{stats.speedBreakers}</div>
                <div className="metric-label">Speed Breakers</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: '#388e3c' }}>{stats.verifiedReports}</div>
                <div className="metric-label">Verified Reports</div>
              </div>
              <div className="metric">
                <div className="metric-value">{stats.uniqueVolunteers}</div>
                <div className="metric-label">Volunteers</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: '#d32f2f' }}>{stats.highSeverity}</div>
                <div className="metric-label">High Severity</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h2 className="card-title">🕐 Recent Activity</h2>
            <div className="detection-list" style={{ maxHeight: '400px' }}>
              {recentActivity.map((det) => (
                <div key={det.id} className="detection-item">
                  <div>
                    <span className={`detection-type ${det.defectType}`}>
                      {det.defectType === 'pothole' ? '🕳️ Pothole' : '⬆️ Speed Breaker'}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {det.location.latitude.toFixed(4)}, {det.location.longitude.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="severity-bar" style={{ width: '60px' }}>
                      <div 
                        className={`severity-fill ${det.severity >= 7 ? 'severity-high' : det.severity >= 4 ? 'severity-medium' : 'severity-low'}`}
                        style={{ width: `${det.severity * 10}%` }}
                      />
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
                      {new Date(det.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'detections' && (
        <div className="card">
          <h2 className="card-title">All Detections ({detections.length})</h2>
          <div className="detection-list" style={{ maxHeight: '600px' }}>
            {detections.map((det) => (
              <div key={det.id} className="detection-item">
                <div>
                  <span className={`detection-type ${det.defectType}`}>
                    {det.defectType === 'pothole' ? '🕳️ Pothole' : '⬆️ Speed Breaker'}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Confidence: {(det.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {det.location.latitude.toFixed(6)}, {det.location.longitude.toFixed(6)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '600' }}>Severity: {det.severity}/10</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(det.timestamp).toLocaleString()}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${det.location.latitude},${det.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
                  >
                    View on Map →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="card">
          <h2 className="card-title">Verified Reports ({reports.length})</h2>
          {reports.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              No verified reports yet. Reports are created when multiple volunteers detect the same defect.
            </p>
          ) : (
            <div className="detection-list" style={{ maxHeight: '600px' }}>
              {reports.map((report) => (
                <div key={report.id} className="detection-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className={`detection-type ${report.defectType}`}>
                      {report.defectType === 'pothole' ? '🕳️ Pothole' : '⬆️ Speed Breaker'}
                    </span>
                    <span className="status-badge status-active">
                      {report.reportCount} reports
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <div>Average Severity: <strong>{report.averageSeverity.toFixed(1)}/10</strong></div>
                    <div>Unique Reporters: <strong>{report.uniqueUsers.length}</strong></div>
                    <div>Credibility: <strong>{(report.credibilityScore * 100).toFixed(0)}%</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={`https://www.google.com/maps?q=${report.location.latitude},${report.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                    >
                      📍 View Map
                    </a>
                    <a
                      href={`/rti?reportId=${report.id}`}
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                    >
                      📄 Generate RTI
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System Info */}
      <div className="card">
        <h2 className="card-title">ℹ️ System Information</h2>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <p><strong>RoadWatch v1.0</strong></p>
          <p>A civic-tech initiative for AI-powered road damage detection.</p>
          <p style={{ marginTop: '0.5rem' }}>
            This system aggregates sensor data from citizen volunteers to identify 
            and verify road defects, enabling automated RTI applications to municipal authorities.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
