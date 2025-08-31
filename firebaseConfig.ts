
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration provided via Vite env (define in .env.* files)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
  measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);

export const analytics = ((): ReturnType<typeof getAnalytics> | null => {
  try {
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      return getAnalytics(app);
    }
  } catch (_) {
    // Ignore analytics errors
  }
  return null;
})();

setLogLevel(import.meta.env.DEV ? 'warn' : 'error');

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db as any, 'localhost', 8080);
    console.info('[firebase] Emulators connected');
  } catch (e) {
    console.warn('[firebase] Emulator connection failed', e);
  }
}

if (import.meta.env.DEV) {
  const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn('[firebase] Missing env vars:', missing.join(', '));
  }
}