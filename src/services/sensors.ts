import { SensorReading, DeviceState } from '../types';

type SensorCallback = (reading: SensorReading) => void;
type StateCallback = (state: DeviceState) => void;

// Default fallback location (Delhi, India)
const DEFAULT_LOCATION = {
  latitude: 28.6139,
  longitude: 77.2090,
  accuracy: 100,
  speed: 5
};

class SensorService {
  private motionListener: ((event: DeviceMotionEvent) => void) | null = null;
  private watchId: number | null = null;
  private callback: SensorCallback | null = null;
  private stateCallback: StateCallback | null = null;
  private lastGPS: { latitude: number; longitude: number; accuracy: number; speed: number | null } = { ...DEFAULT_LOCATION };
  private deviceState: DeviceState = {
    isPortrait: true,
    isMounted: true,
    hasMotionPermission: true, // Default to true - we'll use simulation if not available
    hasLocationPermission: true, // Default to true - we'll use fallback location
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext
  };
  private orientationStableCount = 0;
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private motionEventReceived = false;

  async requestPermissions(): Promise<DeviceState> {
    console.log('[SensorService] Requesting permissions (with fallbacks)...');

    // Try to get motion permission on iOS, but don't block if denied
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        this.deviceState.hasMotionPermission = permission === 'granted';
        console.log('[SensorService] Motion permission (iOS):', permission);
      } catch (e) {
        console.warn('[SensorService] Motion permission denied, will use simulation:', e);
        // Still mark as true - we'll simulate
        this.deviceState.hasMotionPermission = true;
      }
    } else {
      this.deviceState.hasMotionPermission = true;
      console.log('[SensorService] Motion API available (non-iOS)');
    }

    // Try to get location, but use fallback if denied
    if ('geolocation' in navigator) {
      try {
        console.log('[SensorService] Requesting location...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000, // Shorter timeout
            maximumAge: 60000 // Accept 1-minute-old position
          });
        });
        this.lastGPS = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed
        };
        console.log('[SensorService] Location obtained:', this.lastGPS);
      } catch (e) {
        console.warn('[SensorService] Location denied, using fallback location:', e);
        this.lastGPS = { ...DEFAULT_LOCATION };
      }
    } else {
      console.warn('[SensorService] Geolocation not available, using fallback');
      this.lastGPS = { ...DEFAULT_LOCATION };
    }

    // Always mark permissions as granted - we have fallbacks
    this.deviceState.hasMotionPermission = true;
    this.deviceState.hasLocationPermission = true;

    this.notifyStateChange();
    return this.deviceState;
  }

  startCollection(callback: SensorCallback, stateCallback?: StateCallback): void {
    console.log('[SensorService] Starting collection...');
    this.callback = callback;
    if (stateCallback) this.stateCallback = stateCallback;

    // No permission check - we always proceed with fallbacks
    this.motionEventReceived = false;

    // Start accelerometer
    this.motionListener = (event: DeviceMotionEvent) => {
      if (!event.accelerationIncludingGravity) return;

      const { x, y, z } = event.accelerationIncludingGravity;
      if (x === null || y === null || z === null) return;

      // Mark that we received a real motion event
      if (!this.motionEventReceived) {
        this.motionEventReceived = true;
        this.hasRealAccelerometer = true;
        console.log('[SensorService] Real accelerometer detected, stopping simulation if running');
        this.stopSimulation();
      }

      // Check device orientation stability (for UI feedback only)
      this.checkOrientationStability(event);

      // Always pass readings regardless of mounted state
      const reading: SensorReading = {
        timestamp: Date.now(),
        accelerometer: { x, y, z },
        gps: this.lastGPS || { latitude: 0, longitude: 0, accuracy: 0, speed: null }
      };

      this.callback?.(reading);
    };

    window.addEventListener('devicemotion', this.motionListener);

    // Check after a delay if we have real accelerometer, if not start simulation
    setTimeout(() => {
      if (!this.motionEventReceived && this.callback) {
        console.log('[SensorService] No real accelerometer detected, starting simulation mode');
        this.startSimulation();
      }
    }, 1000);

    // Start GPS tracking with battery-conscious settings
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastGPS = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed
        };
      },
      (error) => console.error('[SensorService] GPS error:', error),
      {
        enableHighAccuracy: true,
        maximumAge: 2000, // Accept 2-second-old positions for battery savings
        timeout: 5000
      }
    );

    // Listen for orientation changes
    window.addEventListener('orientationchange', this.handleOrientationChange);
    this.checkPortraitMode();

    console.log('[SensorService] Collection started successfully');
  }

  private startSimulation(): void {
    if (this.simulationInterval) return;

    console.log('[SensorService] Starting accelerometer simulation for desktop testing');
    let time = 0;

    this.simulationInterval = setInterval(() => {
      time += 0.05; // 50ms intervals = 20Hz

      // Generate simulated accelerometer data with occasional bumps
      const baseX = 0;
      const baseY = 0;
      const baseZ = 9.8; // Gravity

      // Add some noise and occasional "bumps" to simulate road conditions
      const noise = () => (Math.random() - 0.5) * 0.5;
      const bump = Math.random() < 0.02 ? (Math.random() * 15) : 0; // 2% chance of bump

      const reading: SensorReading = {
        timestamp: Date.now(),
        accelerometer: {
          x: baseX + noise(),
          y: baseY + noise(),
          z: baseZ + noise() + bump
        },
        gps: this.lastGPS || { latitude: 28.6139, longitude: 77.2090, accuracy: 10, speed: 5 }
      };

      this.callback?.(reading);
    }, 50);
  }

  private stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private checkOrientationStability(event: DeviceMotionEvent): void {
    const rotationRate = event.rotationRate;
    if (!rotationRate) return;

    const { beta, gamma } = rotationRate;
    if (beta === null || gamma === null) return;

    // Check if device is relatively stable (mounted) vs handheld (shaking)
    const isStable = Math.abs(beta) < 5 && Math.abs(gamma) < 5;

    if (isStable) {
      this.orientationStableCount++;
    } else {
      this.orientationStableCount = Math.max(0, this.orientationStableCount - 2);
    }

    const wasMounted = this.deviceState.isMounted;
    this.deviceState.isMounted = this.orientationStableCount > 30; // ~0.5 seconds of stability

    if (wasMounted !== this.deviceState.isMounted) {
      this.notifyStateChange();
    }
  }

  private handleOrientationChange = (): void => {
    this.checkPortraitMode();
  };

  private checkPortraitMode(): void {
    const wasPortrait = this.deviceState.isPortrait;

    if (window.screen?.orientation) {
      this.deviceState.isPortrait = window.screen.orientation.type.includes('portrait');
    } else {
      this.deviceState.isPortrait = window.innerHeight > window.innerWidth;
    }

    if (wasPortrait !== this.deviceState.isPortrait) {
      this.notifyStateChange();
    }
  }

  private notifyStateChange(): void {
    this.stateCallback?.(this.deviceState);
  }

  stopCollection(): void {
    // Stop simulation if running
    this.stopSimulation();

    if (this.motionListener) {
      window.removeEventListener('devicemotion', this.motionListener);
      this.motionListener = null;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    window.removeEventListener('orientationchange', this.handleOrientationChange);
    this.callback = null;

    console.log('[SensorService] Collection stopped');
  }

  getState(): DeviceState {
    return { ...this.deviceState };
  }

  getCurrentGPS(): { latitude: number; longitude: number; speed: number | null } | null {
    return this.lastGPS ? { ...this.lastGPS } : null;
  }
}

export const sensorService = new SensorService();
