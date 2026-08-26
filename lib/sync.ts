import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { File } from 'expo-file-system';
import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';
import { ref, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { storage, db, auth } from './firebase';

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
let isSyncProcessing = false;

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

export type ProgressCallback = (
  itemId: string,
  progress: number,
  status: 'pending' | 'uploading' | 'completed' | 'failed',
  error?: string
) => void;

export const processSyncQueue = async (onProgress?: ProgressCallback) => {
  if (isSyncProcessing) {
    return { success: false, count: 0, failed: 0, reason: 'Sync already in progress' };
  }

  isSyncProcessing = true;
  try {
    const queue = await getSyncQueue();
    const pendingItems = queue.filter(
      item => item.status === 'pending' || (item.status === 'failed' && item.retryCount < 3)
    );

    if (pendingItems.length === 0) {
      isSyncProcessing = false;
      return { success: true, count: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
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

        // 3. Prepare tenant path, storage target, and authentication
        const tenantPath = item.tenantId ? `tenants/${item.tenantId}/` : '';
        const fullPath = `${tenantPath}logs/${item.logId}/${item.fileName}`;
        const storageRef = ref(storage, fullPath);
        const contentType = getContentType(item.type, item.fileName);

        let idToken: string | undefined;
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            idToken = await currentUser.getIdToken();
          }
        } catch (tokenErr) {
          console.warn('Could not get auth token for upload', tokenErr);
        }

        const bucket = storage.app.options.storageBucket || 'studio-9764494180-2cb45.firebasestorage.app';
        const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(fullPath)}`;

        const headers: Record<string, string> = {
          'Content-Type': contentType,
        };
        if (idToken) {
          headers['Authorization'] = `Firebase ${idToken}`;
        }

        // 4. Native binary streaming upload directly from filesystem to Firebase Storage
        const uploadTask = createUploadTask(
          uploadUrl,
          item.localUri,
          {
            headers,
            httpMethod: 'POST',
            uploadType: FileSystemUploadType.BINARY_CONTENT,
          },
          progress => {
            if (progress.totalBytesExpectedToSend > 0) {
              const pct = Math.round(
                (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100
              );
              updateItemInQueue(item.id, { progress: pct });
              if (onProgress) onProgress(item.id, pct, 'uploading');
            }
          }
        );

        const uploadResult = await uploadTask.uploadAsync();

        if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(
            `Upload failed (HTTP ${uploadResult?.status || 'Unknown'}): ${uploadResult?.body || 'No response'}`
          );
        }

        // 5. Obtain Public Download URL
        let publicUrl: string;
        try {
          publicUrl = await getDownloadURL(storageRef);
        } catch {
          try {
            const responseData = JSON.parse(uploadResult.body);
            const token = responseData.downloadTokens;
            if (token) {
              publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(fullPath)}?alt=media&token=${token}`;
            } else {
              publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(fullPath)}?alt=media`;
            }
          } catch (e: any) {
            throw new Error('Failed to resolve download URL: ' + e.message);
          }
        }

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
        // Stop loop if network error occurs
        break;
      }
    }

    // Clean up completed items automatically after successful batch
    await clearCompletedItems();

    return { success: true, count: processed, failed };
  } finally {
    isSyncProcessing = false;
  }
};

/**
 * Starts a background network listener that automatically syncs pending media
 * whenever Internet connectivity is restored. Returns an unsubscribe cleanup function.
 */
export const startNetworkSyncListener = (onSyncComplete?: (count: number) => void): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = state.isConnected && state.isInternetReachable !== false;
    if (isOnline && !isSyncProcessing) {
      getSyncQueue().then(queue => {
        const pending = queue.filter(item => item.status === 'pending' || item.status === 'failed');
        if (pending.length > 0) {
          processSyncQueue().then(res => {
            if (res.count > 0 && onSyncComplete) {
              onSyncComplete(res.count);
            }
          });
        }
      });
    }
  });

  return unsubscribe;
};
