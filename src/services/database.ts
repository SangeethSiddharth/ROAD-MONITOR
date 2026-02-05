import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  orderBy, 
  limit,
  GeoPoint,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Detection, Session, AggregatedReport, RTIDraft } from '../types';

// Sessions
export async function createSession(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    // Return a local session ID if not authenticated
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const session: Omit<Session, 'id'> = {
    userId: user.uid,
    startTime: Date.now(),
    detectionCount: 0,
    distanceTraveled: 0,
    status: 'active'
  };

  const docRef = await addDoc(collection(db, 'sessions'), session);
  return docRef.id;
}

export async function endSession(sessionId: string, stats: Partial<Session>): Promise<void> {
  // Skip Firebase update for local sessions
  if (sessionId.startsWith('local-')) {
    return;
  }
  
  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    ...stats,
    endTime: Date.now(),
    status: 'completed'
  });
}

// Detections
export async function saveDetection(detection: Omit<Detection, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'detections'), {
    ...detection,
    location: new GeoPoint(detection.location.latitude, detection.location.longitude),
    timestamp: Timestamp.fromMillis(detection.timestamp)
  });
  return docRef.id;
}

export async function getDetectionsInArea(
  bounds: { north: number; south: number; east: number; west: number },
  limitCount: number = 100
): Promise<Detection[]> {
  // Firestore doesn't support geo-queries natively, so we use a bounding box approach
  const q = query(
    collection(db, 'detections'),
    where('defectType', 'in', ['pothole', 'speed_breaker']),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  const detections: Detection[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const loc = data.location as GeoPoint;
    
    // Client-side filter for bounds
    if (loc.latitude >= bounds.south && loc.latitude <= bounds.north &&
        loc.longitude >= bounds.west && loc.longitude <= bounds.east) {
      detections.push({
        id: docSnap.id,
        sessionId: data.sessionId,
        userId: data.userId,
        timestamp: data.timestamp.toMillis(),
        location: { latitude: loc.latitude, longitude: loc.longitude },
        defectType: data.defectType,
        confidence: data.confidence,
        severity: data.severity,
        processedWindow: data.processedWindow
      });
    }
  });

  return detections;
}

export function subscribeToDetections(
  callback: (detections: Detection[]) => void
): () => void {
  const q = query(
    collection(db, 'detections'),
    where('defectType', 'in', ['pothole', 'speed_breaker']),
    orderBy('timestamp', 'desc'),
    limit(200)
  );

  return onSnapshot(q, (snapshot) => {
    const detections: Detection[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const loc = data.location as GeoPoint;
      return {
        id: docSnap.id,
        sessionId: data.sessionId,
        userId: data.userId,
        timestamp: data.timestamp.toMillis(),
        location: { latitude: loc.latitude, longitude: loc.longitude },
        defectType: data.defectType,
        confidence: data.confidence,
        severity: data.severity,
        processedWindow: data.processedWindow
      };
    });
    callback(detections);
  });
}

// Aggregated Reports
export async function getAggregatedReports(): Promise<AggregatedReport[]> {
  const q = query(
    collection(db, 'aggregatedReports'),
    where('reportCount', '>=', 2),
    orderBy('reportCount', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as AggregatedReport[];
}

// RTI Drafts
export async function saveRTIDraft(draft: Omit<RTIDraft, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'rtiDrafts'), draft);
  return docRef.id;
}

export async function getUserRTIDrafts(): Promise<RTIDraft[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const q = query(
    collection(db, 'rtiDrafts'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  })) as RTIDraft[];
}

export async function updateRTIDraft(draftId: string, updates: Partial<RTIDraft>): Promise<void> {
  const draftRef = doc(db, 'rtiDrafts', draftId);
  await updateDoc(draftRef, updates);
}
