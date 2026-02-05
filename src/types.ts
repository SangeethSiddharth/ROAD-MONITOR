// Type definitions for RoadWatch PWA

export interface SensorReading {
  timestamp: number;
  accelerometer: { x: number; y: number; z: number };
  gps: { latitude: number; longitude: number; accuracy: number; speed: number | null };
}

export interface ProcessedWindow {
  startTime: number;
  endTime: number;
  magnitude: number;
  peakMagnitude: number;
  averageSpeed: number;
  centroid: { latitude: number; longitude: number };
  sampleCount: number;
}

export interface DetectionResult {
  defectType: 'pothole' | 'speed_breaker' | 'normal';
  confidence: number;
  severity: number;
}

export interface Detection {
  id?: string;
  sessionId: string;
  userId: string;
  timestamp: number;
  location: { latitude: number; longitude: number };
  defectType: 'pothole' | 'speed_breaker' | 'normal';
  confidence: number;
  severity: number;
  processedWindow: ProcessedWindow;
}

export interface Session {
  id?: string;
  userId: string;
  startTime: number;
  endTime?: number;
  detectionCount: number;
  distanceTraveled: number;
  status: 'active' | 'completed' | 'paused';
}

export interface AggregatedReport {
  id?: string;
  geohash: string;
  location: { latitude: number; longitude: number };
  defectType: 'pothole' | 'speed_breaker';
  averageSeverity: number;
  reportCount: number;
  uniqueUsers: string[];
  firstReported: number;
  lastReported: number;
  credibilityScore: number;
}

export interface RTIDraft {
  id?: string;
  userId: string;
  createdAt: number;
  reportIds: string[];
  municipalAuthority: string;
  location: { latitude: number; longitude: number; address: string };
  defectType: string;
  severity: string;
  detectionCount: number;
  content: string;
  status: 'draft' | 'finalized';
}

export interface DeviceState {
  isPortrait: boolean;
  isMounted: boolean;
  hasMotionPermission: boolean;
  hasLocationPermission: boolean;
  isSecureContext: boolean;
}

export interface AppConfig {
  minSpeedThreshold: number; // km/h
  windowDurationMs: number;
  magnitudeThreshold: number;
  confidenceThreshold: number;
  sampleRateHz: number;
  aggregationRadiusMeters: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  minSpeedThreshold: 5, // km/h
  windowDurationMs: 1500, // 1.5 seconds
  magnitudeThreshold: 2.5, // g-force threshold
  confidenceThreshold: 0.7,
  sampleRateHz: 60,
  aggregationRadiusMeters: 20
};
