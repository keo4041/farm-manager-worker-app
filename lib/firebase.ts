import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCklGXD8D--9gGajUAvxH8z8NXpVzD0gUw",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-9764494180-2cb45.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "studio-9764494180-2cb45",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-9764494180-2cb45.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "910807602522",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:910807602522:web:12f9f66e63850b8bba4f63",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Configure Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export const storage = getStorage(app);
// Limit retry timeouts to 30 seconds to prevent hanging on network disruptions
storage.maxUploadRetryTime = 30000;
storage.maxOperationRetryTime = 30000;

export default app;
