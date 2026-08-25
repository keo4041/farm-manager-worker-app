import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCklGXD8D--9gGajUAvxH8z8NXpVzD0gUw",
  authDomain: "studio-9764494180-2cb45.firebaseapp.com",
  projectId: "studio-9764494180-2cb45",
  storageBucket: "studio-9764494180-2cb45.firebasestorage.app",
  messagingSenderId: "910807602522",
  appId: "1:910807602522:web:12f9f66e63850b8bba4f63",
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
export default app;
