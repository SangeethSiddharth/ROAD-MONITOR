import { SensorReading, ProcessedWindow, AppConfig, DEFAULT_CONFIG } from '../types';

export class SignalProcessor {
  private config: AppConfig;
  private buffer: SensorReading[] = [];
  private windowCallback: ((window: ProcessedWindow) => void) | null = null;

  constructor(config: AppConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  setWindowCallback(callback: (window: ProcessedWindow) => void): void {
    this.windowCallback = callback;
  }

  addReading(reading: SensorReading): void {
    this.buffer.push(reading);
    this.pruneOldReadings();
    this.checkWindowComplete();
  }

  private pruneOldReadings(): void {
    const cutoff = Date.now() - this.config.windowDurationMs * 2;
    this.buffer = this.buffer.filter(r => r.timestamp > cutoff);
  }

  private checkWindowComplete(): void {
    if (this.buffer.length < 2) return;

    const windowStart = this.buffer[0].timestamp;
    const windowEnd = this.buffer[this.buffer.length - 1].timestamp;
    
    if (windowEnd - windowStart >= this.config.windowDurationMs) {
      const windowReadings = this.buffer.filter(
        r => r.timestamp >= windowStart && r.timestamp < windowStart + this.config.windowDurationMs
      );
      
      if (windowReadings.length > 0) {
        const processed = this.processWindow(windowReadings);
        
        if (this.shouldEmitWindow(processed)) {
          this.windowCallback?.(processed);
        }
        
        // Slide window by half duration (overlapping windows)
        const slidePoint = windowStart + this.config.windowDurationMs / 2;
        this.buffer = this.buffer.filter(r => r.timestamp >= slidePoint);
      }
    }
  }

  private processWindow(readings: SensorReading[]): ProcessedWindow {
    const magnitudes = readings.map(r => this.calculateMagnitude(r.accelerometer));
    const speeds = readings
      .map(r => r.gps.speed)
      .filter((s): s is number => s !== null);
    
    const latitudes = readings.map(r => r.gps.latitude);
    const longitudes = readings.map(r => r.gps.longitude);

    return {
      startTime: readings[0].timestamp,
      endTime: readings[readings.length - 1].timestamp,
      magnitude: this.calculateRMS(magnitudes),
      peakMagnitude: Math.max(...magnitudes),
      averageSpeed: speeds.length > 0 ? this.average(speeds) * 3.6 : 0, // Convert m/s to km/h
      centroid: {
        latitude: this.average(latitudes),
        longitude: this.average(longitudes)
      },
      sampleCount: readings.length
    };
  }

  private calculateMagnitude(acc: { x: number; y: number; z: number }): number {
    // Remove gravity component (approximately 9.8 m/s²)
    const gravity = 9.81;
    const totalMag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    return Math.abs(totalMag - gravity);
  }

  private calculateRMS(values: number[]): number {
    if (values.length === 0) return 0;
    const sumSquares = values.reduce((sum, v) => sum + v ** 2, 0);
    return Math.sqrt(sumSquares / values.length);
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private shouldEmitWindow(window: ProcessedWindow): boolean {
    // Reject if speed too low
    if (window.averageSpeed < this.config.minSpeedThreshold) {
      return false;
    }

    // Only emit if magnitude exceeds threshold (spike detection)
    if (window.peakMagnitude < this.config.magnitudeThreshold) {
      return false;
    }

    // Ensure enough samples for reliable data
    const expectedSamples = (this.config.windowDurationMs / 1000) * this.config.sampleRateHz * 0.5;
    if (window.sampleCount < expectedSamples) {
      return false;
    }

    return true;
  }

  getSeverityFromMagnitude(magnitude: number): number {
    // Map magnitude to severity 1-10
    const minMag = this.config.magnitudeThreshold;
    const maxMag = 15; // Maximum expected magnitude
    const normalized = Math.min(1, Math.max(0, (magnitude - minMag) / (maxMag - minMag)));
    return Math.round(normalized * 9) + 1;
  }

  reset(): void {
    this.buffer = [];
  }
}
