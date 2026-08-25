import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSyncQueue, processSyncQueue, PendingMedia } from '../lib/sync';

export default function Home() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  const checkQueue = async () => {
    const queue = await getSyncQueue();
    const pending = queue.filter(item => item.status !== 'completed').length;
    setPendingCount(pending);

    // Auto-sync in background if queue items are present
    if (pending > 0) {
      processSyncQueue().then(() => {
        getSyncQueue().then(q => {
          setPendingCount(q.filter(item => item.status !== 'completed').length);
        });
      });
    }
  };

  useEffect(() => {
    checkQueue();
  }, []);

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-row items-center justify-between bg-gray-100 rounded-xl p-4 mb-6 border-2 border-gray-300">
        <View className="flex-row items-center space-x-2">
          <View className={`w-4 h-4 rounded-full ${pendingCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
          <Text className="text-black font-extrabold text-lg ml-2">
            {pendingCount > 0 ? `${pendingCount} Media Item(s) Pending` : 'All Media Synced'}
          </Text>
        </View>
        <Text className="text-xs font-bold text-gray-500">Offline Ready</Text>
      </View>

      <View className="flex-1 justify-center space-y-6 flex-col gap-6">
        <TouchableOpacity 
          className="bg-safety-yellow w-full rounded-2xl items-center justify-center h-48 shadow-lg border-2 border-black"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'MORNING' } })}
        >
          <Text className="text-black font-extrabold text-3xl text-center px-4">
            START MORNING LOG{"\n"}
            <Text className="text-xl font-bold">Démarrer le rapport du matin</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-black w-full rounded-2xl items-center justify-center h-48 shadow-lg"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'EVENING' } })}
        >
          <Text className="text-safety-yellow font-extrabold text-3xl text-center px-4">
            START EVENING LOG{"\n"}
            <Text className="text-xl font-bold">Démarrer le rapport du soir</Text>
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-gray-200 w-full rounded-xl items-center justify-between h-16 px-6 border-2 border-black flex-row mt-4"
          onPress={() => router.push('/sync-status')}
        >
          <Text className="text-black font-extrabold text-lg">View Sync Queue / File d'attente</Text>
          {pendingCount > 0 && (
            <View className="bg-amber-500 px-3 py-1 rounded-full">
              <Text className="text-white font-extrabold text-sm">{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

