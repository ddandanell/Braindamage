
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCliLe51I0w5mnPeR8NT0az78_meW4YrQc",
  authDomain: "noad-5961e.firebaseapp.com",
  databaseURL: "https://noad-5961e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "noad-5961e",
  storageBucket: "noad-5961e.firebasestorage.app",
  messagingSenderId: "928476669832",
  appId: "1:928476669832:web:cd09d181b36839ee65bc3d",
  measurementId: "G-7LD3T97LV3"
};

// Initialize Firebase using the modern v9 modular SDK
const app = initializeApp(firebaseConfig);

// Export Firebase services for modular SDK usage
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);