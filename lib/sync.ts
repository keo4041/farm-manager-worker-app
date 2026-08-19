import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { storage, db } from './firebase';

export interface PendingMedia {
  id: string;
  logId: string;
  localUri: string;
  type: 'photo' | 'video' | 'voice';
  fileName: string;
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

export const addToQueue = async (media: PendingMedia) => {
  const queue = await getSyncQueue();
  queue.push(media);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
};

export const removeFromQueue = async (id: string) => {
  const queue = await getSyncQueue();
  const updated = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updated));
};

export const processSyncQueue = async () => {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { success: true, count: 0 };
  
  let processed = 0;
  for (const item of queue) {
    try {
      // Read file info
      const fileInfo = await FileSystem.getInfoAsync(item.localUri);
      if (!fileInfo.exists) {
         // file missing, remove from queue
         await removeFromQueue(item.id);
         continue;
      }
      
      const response = await fetch(item.localUri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, `logs/${item.logId}/${item.fileName}`);
      await uploadBytes(storageRef, blob);
      const publicUrl = await getDownloadURL(storageRef);
      
      // Update firestore document corresponding to logId
      const logRef = doc(db, 'agbelouve-farm-daily-logs', item.logId);
      
      if (item.type === 'video') {
         await updateDoc(logRef, { 'mediaUrls.video': publicUrl });
      } else if (item.type === 'voice') {
         await updateDoc(logRef, { 'mediaUrls.voice': publicUrl });
      } else {
         await updateDoc(logRef, { 'mediaUrls.photos': arrayUnion(publicUrl) });
      }
      
      await removeFromQueue(item.id);
      processed++;
    } catch (err) {
      console.error('Error syncing item:', item.id, err);
      // break out, probably network issue
      break; 
    }
  }
  return { success: true, count: processed };
};
