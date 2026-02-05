import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyD56HxABXmhelowVOXgrSnrpZ9NIGjUvr0",
  authDomain: "civicai-8428f.firebaseapp.com",
  projectId: "civicai-8428f",
  storageBucket: "civicai-8428f.firebasestorage.app",
  messagingSenderId: "232988846972",
  appId: "1:232988846972:web:e32b2eb8e26677c4f052f9",
  measurementId: "G-BYYX0HHVVV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
