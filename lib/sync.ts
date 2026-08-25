import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { storage, db } from './firebase';

export interface PendingMedia {
  id: string;
  logId: string;
  localUri: string;
  type: 'photo' | 'video' | 'voice';
  fileName: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0 to 100
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

const SYNC_QUEUE_KEY = '@farm_manager_sync_queue';

export const getSyncQueue = async (): Promise<PendingMedia[]> => {
  try {
    const queueData = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueData ? JSON.parse(queueData) : [];
  } catch (e) {
    console.error('Error reading sync queue', e);
    return [];
  }
};

export const saveQueue = async (queue: PendingMedia[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving sync queue', e);
  }
};

export const addToQueue = async (
  item: Omit<PendingMedia, 'status' | 'progress' | 'retryCount' | 'createdAt'>
) => {
  const queue = await getSyncQueue();
  const newItem: PendingMedia = {
    ...item,
    status: 'pending',
    progress: 0,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  queue.push(newItem);
  await saveQueue(queue);
  return newItem;
};

export const removeFromQueue = async (id: string) => {
  const queue = await getSyncQueue();
  const updated = queue.filter(item => item.id !== id);
  await saveQueue(updated);
};

export const updateItemInQueue = async (
  id: string,
  updates: Partial<PendingMedia>
) => {
  const queue = await getSyncQueue();
  const updated = queue.map(item => (item.id === id ? { ...item, ...updates } : item));
  await saveQueue(updated);
};

export const clearCompletedItems = async () => {
  const queue = await getSyncQueue();
  const updated = queue.filter(item => item.status !== 'completed');
  await saveQueue(updated);
};

export const retryFailedItems = async () => {
  const queue = await getSyncQueue();
  const updated = queue.map(item =>
    item.status === 'failed'
      ? { ...item, status: 'pending' as const, progress: 0, errorMessage: undefined }
      : item
  );
  await saveQueue(updated);
};

/**
 * Safely converts local URI to a Blob (with Base64 fallback for native Expo environments)
 */
const getBlobFromUri = async (uri: string): Promise<Blob> => {
  try {
    const response = await fetch(uri);
    return await response.blob();
  } catch (err) {
    // Native FileSystem Base64 Fallback
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray]);
  }
};

export type ProgressCallback = (
  itemId: string,
  progress: number,
  status: 'pending' | 'uploading' | 'completed' | 'failed',
  error?: string
) => void;

export const processSyncQueue = async (onProgress?: ProgressCallback) => {
  const queue = await getSyncQueue();
  const pendingItems = queue.filter(
    item => item.status === 'pending' || (item.status === 'failed' && item.retryCount < 3)
  );

  if (pendingItems.length === 0) return { success: true, count: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // 1. Verify local file existence
      const fileInfo = await FileSystem.getInfoAsync(item.localUri);
      if (!fileInfo.exists) {
        await updateItemInQueue(item.id, {
          status: 'failed',
          errorMessage: 'Local file missing',
        });
        if (onProgress) onProgress(item.id, 0, 'failed', 'Local file missing');
        failed++;
        continue;
      }

      // 2. Mark item as uploading
      await updateItemInQueue(item.id, {
        status: 'uploading',
        progress: 5,
        retryCount: item.retryCount + 1,
      });
      if (onProgress) onProgress(item.id, 5, 'uploading');

      // 3. Obtain Blob and create Storage reference
      const blob = await getBlobFromUri(item.localUri);
      const storageRef = ref(storage, `logs/${item.logId}/${item.fileName}`);

      // 4. Upload with uploadBytesResumable for real-time progress callbacks
      const uploadTask = uploadBytesResumable(storageRef, blob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          snapshot => {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            updateItemInQueue(item.id, { progress: pct });
            if (onProgress) onProgress(item.id, pct, 'uploading');
          },
          error => {
            reject(error);
          },
          () => {
            resolve();
          }
        );
      });

      // 5. Get Public Download URL
      const publicUrl = await getDownloadURL(storageRef);

      // 6. Update Firestore document
      const logRef = doc(db, 'agbelouve-farm-daily-logs', item.logId);
      if (item.type === 'video') {
        await updateDoc(logRef, { 'mediaUrls.video': publicUrl });
      } else if (item.type === 'voice') {
        await updateDoc(logRef, { 'mediaUrls.voice': publicUrl });
      } else {
        await updateDoc(logRef, { 'mediaUrls.photos': arrayUnion(publicUrl) });
      }

      // 7. Mark completed
      await updateItemInQueue(item.id, { status: 'completed', progress: 100 });
      if (onProgress) onProgress(item.id, 100, 'completed');
      processed++;
    } catch (err: any) {
      console.error('Error syncing item:', item.id, err);
      const errorMsg = err.message || 'Network error during upload';
      await updateItemInQueue(item.id, {
        status: 'failed',
        errorMessage: errorMsg,
      });
      if (onProgress) onProgress(item.id, item.progress, 'failed', errorMsg);
      failed++;
      // Stop loop if offline/network error occurs
      break;
    }
  }

  // Clean up completed items automatically after successful batch
  await clearCompletedItems();

  return { success: true, count: processed, failed };
};

