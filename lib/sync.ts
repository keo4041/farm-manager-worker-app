import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { storage, db } from './firebase';

export interface PendingMedia {
  id: string;
  logId: string;
  tenantId?: string;
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
 * Determines MIME content type based on media type and file extension
 */
const getContentType = (type: 'photo' | 'video' | 'voice', fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (type === 'photo') {
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  } else if (type === 'video') {
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  } else if (type === 'voice') {
    if (lower.endsWith('.m4a')) return 'audio/m4a';
    if (lower.endsWith('.caf')) return 'audio/x-caf';
    if (lower.endsWith('.aac')) return 'audio/aac';
    return 'audio/mp4';
  }
  return 'application/octet-stream';
};

/**
 * Safely converts local URI to a Blob or Uint8Array for Firebase Storage upload.
 * In React Native, XMLHttpRequest with responseType = 'blob' is the standard way
 * to obtain a native Blob without hitting the "Creating blobs from 'ArrayBuffer'
 * and 'ArrayBufferView' are not supported" limitation.
 */
const getUploadDataFromUri = async (
  uri: string
): Promise<{ data: Blob | Uint8Array; cleanup?: () => void }> => {
  // Strategy 1: XMLHttpRequest with responseType = 'blob' (Standard React Native native blob module)
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.response) {
          resolve(xhr.response);
        } else {
          reject(new Error('XMLHttpRequest returned empty response'));
        }
      };
      xhr.onerror = (e) => {
        reject(new TypeError(`XHR blob conversion failed: ${e}`));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

    return {
      data: blob,
      cleanup: () => {
        try {
          (blob as any)?.close?.();
        } catch {
          // Ignore close errors
        }
      },
    };
  } catch (xhrErr) {
    // Strategy 2: Web / standard fetch fallback
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return {
        data: blob,
        cleanup: () => {
          try {
            (blob as any)?.close?.();
          } catch {}
        },
      };
    } catch (fetchErr) {
      // Strategy 3: Direct binary bytes from expo-file-system File API passed directly to uploadBytesResumable (without new Blob)
      try {
        const file = new File(uri);
        const bytes = await file.bytes();
        return { data: bytes };
      } catch (fileErr) {
        console.error('Error reading file for upload:', fileErr);
        throw fileErr;
      }
    }
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
    let uploadData: { data: Blob | Uint8Array; cleanup?: () => void } | null = null;
    try {
      // 1. Verify local file existence using new File API
      const file = new File(item.localUri);
      if (!file.exists) {
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

      // 3. Obtain upload payload and create Storage reference (tenant-isolated path)
      uploadData = await getUploadDataFromUri(item.localUri);
      const tenantPath = item.tenantId ? `tenants/${item.tenantId}/` : '';
      const storageRef = ref(storage, `${tenantPath}logs/${item.logId}/${item.fileName}`);
      const metadata = {
        contentType: getContentType(item.type, item.fileName),
      };

      // 4. Upload with uploadBytesResumable for real-time progress callbacks
      const uploadTask = uploadBytesResumable(storageRef, uploadData.data, metadata);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          snapshot => {
            if (snapshot.totalBytes > 0) {
              const pct = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              updateItemInQueue(item.id, { progress: pct });
              if (onProgress) onProgress(item.id, pct, 'uploading');
            }
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
    } finally {
      if (uploadData?.cleanup) {
        uploadData.cleanup();
      }
    }
  }

  // Clean up completed items automatically after successful batch
  await clearCompletedItems();

  return { success: true, count: processed, failed };
};
