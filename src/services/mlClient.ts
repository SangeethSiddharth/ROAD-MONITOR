import { ProcessedWindow, DetectionResult } from '../types';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

// Client-side heuristic classifier (fallback when offline or for initial filtering)
export function classifyLocally(window: ProcessedWindow): DetectionResult {
  const { magnitude, peakMagnitude, averageSpeed } = window;
  
  // Pothole detection: sharp, sudden spikes
  if (peakMagnitude > 8 && magnitude > 4) {
    return {
      defectType: 'pothole',
      confidence: Math.min(0.85, peakMagnitude / 15),
      severity: Math.min(10, Math.round(peakMagnitude / 1.5))
    };
  }
  
  // Speed breaker: sustained elevated vibration
  if (magnitude > 3 && peakMagnitude < 10 && averageSpeed < 30) {
    return {
      defectType: 'speed_breaker',
      confidence: Math.min(0.9, magnitude / 6),
      severity: Math.min(10, Math.round(magnitude * 1.5))
    };
  }
  
  return {
    defectType: 'normal',
    confidence: 0.95,
    severity: 0
  };
}

// Server-side ML inference
export async function classifyWithML(window: ProcessedWindow): Promise<DetectionResult> {
  try {
    const classifyDefect = httpsCallable<ProcessedWindow, DetectionResult>(functions, 'classifyDefect');
    const result = await classifyDefect(window);
    return result.data;
  } catch (error) {
    console.warn('ML inference failed, using local classifier:', error);
    return classifyLocally(window);
  }
}

// Batch classification for efficiency
export async function classifyBatch(windows: ProcessedWindow[]): Promise<DetectionResult[]> {
  try {
    const classifyBatchFn = httpsCallable<ProcessedWindow[], DetectionResult[]>(
      functions, 
      'classifyDefectBatch'
    );
    const result = await classifyBatchFn(windows);
    return result.data;
  } catch (error) {
    console.warn('Batch ML inference failed, using local classifier:', error);
    return windows.map(classifyLocally);
  }
}
