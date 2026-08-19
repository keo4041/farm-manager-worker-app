import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { getSyncQueue, processSyncQueue, PendingMedia } from '../lib/sync';

export default function SyncStatus() {
  const [queue, setQueue] = useState<PendingMedia[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState('');

  const loadQueue = async () => {
    const q = await getSyncQueue();
    setQueue(q);
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResult('');
    const res = await processSyncQueue();
    setResult(`Synced ${res.count} items.`);
    await loadQueue();
    setSyncing(false);
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-3xl font-extrabold text-black mb-6">Items Pending Sync: {queue.length}</Text>
      
      <TouchableOpacity 
        className="bg-safety-yellow w-full rounded-xl items-center justify-center p-6 shadow-md mb-6"
        onPress={handleSync}
        disabled={syncing || queue.length === 0}
      >
        {syncing ? (
          <ActivityIndicator color="#000" size="large" />
        ) : (
          <Text className="text-black font-extrabold text-2xl">
            SYNC NOW / SYNCHRONISER
          </Text>
        )}
      </TouchableOpacity>

      {result ? <Text className="font-bold text-green-700 mb-4">{result}</Text> : null}

      <FlatList 
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="border-b-2 border-gray-300 py-4">
            <Text className="font-bold text-lg">Type: {item.type.toUpperCase()}</Text>
            <Text className="text-gray-600">File: {item.fileName}</Text>
            <Text className="text-gray-600 text-xs">Log ID: {item.logId}</Text>
          </View>
        )}
      />
    </View>
  );
}
