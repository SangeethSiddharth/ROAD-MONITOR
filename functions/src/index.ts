import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Types
interface ProcessedWindow {
  startTime: number;
  endTime: number;
  magnitude: number;
  peakMagnitude: number;
  averageSpeed: number;
  centroid: { latitude: number; longitude: number };
  sampleCount: number;
}

interface DetectionResult {
  defectType: 'pothole' | 'speed_breaker' | 'normal';
  confidence: number;
  severity: number;
}

interface Detection {
  id?: string;
  sessionId: string;
  userId: string;
  timestamp: admin.firestore.Timestamp;
  location: admin.firestore.GeoPoint;
  defectType: 'pothole' | 'speed_breaker' | 'normal';
  confidence: number;
  severity: number;
  processedWindow: ProcessedWindow;
}

// ML Classification (simulated - replace with actual ML model call)
function classifyDefectML(window: ProcessedWindow): DetectionResult {
  const { magnitude, peakMagnitude, averageSpeed } = window;
  
  // Simulated ML model logic
  // In production, this would call a TensorFlow Serving endpoint or similar
  
  // Pothole: Sharp, sudden impact
  if (peakMagnitude > 8 && magnitude > 4) {
    const confidence = Math.min(0.95, 0.6 + (peakMagnitude - 8) * 0.05 + (magnitude - 4) * 0.03);
    return {
      defectType: 'pothole',
      confidence,
      severity: Math.min(10, Math.round(peakMagnitude / 1.2))
    };
  }
  
  // Speed breaker: Sustained elevated vibration with lower peak
  if (magnitude > 3 && peakMagnitude < 12 && averageSpeed < 35) {
    const confidence = Math.min(0.92, 0.5 + magnitude * 0.1);
    return {
      defectType: 'speed_breaker',
      confidence,
      severity: Math.min(10, Math.round(magnitude * 2))
    };
  }
  
  return {
    defectType: 'normal',
    confidence: 0.95,
    severity: 0
  };
}

// Single defect classification
export const classifyDefect = functions.https.onCall(
  (data: ProcessedWindow, context): DetectionResult => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    
    return classifyDefectML(data);
  }
);

// Batch classification
export const classifyDefectBatch = functions.https.onCall(
  (data: ProcessedWindow[], context): DetectionResult[] => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    
    return data.map(classifyDefectML);
  }
);

// Geohash encoding for aggregation
function encodeGeohash(lat: number, lng: number, precision: number = 7): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        idx = idx * 2 + 1;
        lngMin = lngMid;
      } else {
        idx = idx * 2;
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

// Haversine distance in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Trigger: Aggregate detections when a new one is created
export const aggregateDetection = functions.firestore
  .document('detections/{detectionId}')
  .onCreate(async (snapshot, context) => {
    const detection = snapshot.data() as Detection;
    
    // Skip normal detections
    if (detection.defectType === 'normal') return;
    
    const location = detection.location;
    const lat = location.latitude;
    const lng = location.longitude;
    const geohash = encodeGeohash(lat, lng, 7);
    
    const AGGREGATION_RADIUS = 25; // meters
    
    // Find existing aggregated reports in the vicinity
    const reportsRef = db.collection('aggregatedReports');
    const nearbyReports = await reportsRef
      .where('geohash', '>=', geohash.substring(0, 5))
      .where('geohash', '<=', geohash.substring(0, 5) + '\uf8ff')
      .where('defectType', '==', detection.defectType)
      .get();
    
    let matchedReport: admin.firestore.DocumentSnapshot | null = null;
    
    for (const doc of nearbyReports.docs) {
      const report = doc.data();
      const distance = calculateDistance(lat, lng, report.location.latitude, report.location.longitude);
      
      if (distance <= AGGREGATION_RADIUS) {
        matchedReport = doc;
        break;
      }
    }
    
    if (matchedReport) {
      // Update existing report
      const existing = matchedReport.data()!;
      const uniqueUsers = existing.uniqueUsers || [];
      
      if (!uniqueUsers.includes(detection.userId)) {
        uniqueUsers.push(detection.userId);
      }
      
      const newReportCount = existing.reportCount + 1;
      const newAverageSeverity = (existing.averageSeverity * existing.reportCount + detection.severity) / newReportCount;
      
      // Credibility increases with unique reporters
      const credibilityScore = Math.min(1, 0.3 + uniqueUsers.length * 0.15 + Math.log10(newReportCount) * 0.2);
      
      await matchedReport.ref.update({
        reportCount: newReportCount,
        averageSeverity: newAverageSeverity,
        uniqueUsers,
        lastReported: detection.timestamp,
        credibilityScore
      });
    } else {
      // Create new aggregated report
      await reportsRef.add({
        geohash,
        location: new admin.firestore.GeoPoint(lat, lng),
        defectType: detection.defectType,
        averageSeverity: detection.severity,
        reportCount: 1,
        uniqueUsers: [detection.userId],
        firstReported: detection.timestamp,
        lastReported: detection.timestamp,
        credibilityScore: 0.3
      });
    }
  });

// Scheduled cleanup of old, unverified single-report detections
export const cleanupOldDetections = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    );
    
    // Get aggregated reports with only 1 report (unverified) and old
    const unverifiedReports = await db.collection('aggregatedReports')
      .where('reportCount', '==', 1)
      .where('lastReported', '<', cutoff)
      .get();
    
    const batch = db.batch();
    unverifiedReports.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (unverifiedReports.size > 0) {
      await batch.commit();
      console.log(`Cleaned up ${unverifiedReports.size} unverified reports`);
    }
    
    return null;
  });

// HTTP endpoint for public statistics
export const getPublicStats = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.status(204).send('');
    return;
  }
  
  const [detectionsSnap, reportsSnap] = await Promise.all([
    db.collection('detections').count().get(),
    db.collection('aggregatedReports').where('reportCount', '>=', 2).count().get()
  ]);
  
  res.json({
    totalDetections: detectionsSnap.data().count,
    verifiedReports: reportsSnap.data().count,
    timestamp: Date.now()
  });
});
