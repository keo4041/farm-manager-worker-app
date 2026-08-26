import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import {
  getSyncQueue,
  processSyncQueue,
  retryFailedItems,
  clearCompletedItems,
  removeFromQueue,
  PendingMedia,
} from '../lib/sync';
import { useTranslation } from '../lib/i18n';

export default function SyncStatus() {
  const { t } = useTranslation();
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
    await retryFailedItems();
    const res = await processSyncQueue((_itemId, _progress, _status) => {
      loadQueue();
    });
    setResult(`Synced ${res.count} item(s). Failed: ${res.failed}`);
    await loadQueue();
    setSyncing(false);
  };

  const handleClearCompleted = async () => {
    await clearCompletedItems();
    await loadQueue();
  };

  const handleRemoveItem = async (id: string) => {
    await removeFromQueue(id);
    await loadQueue();
  };

  const getStatusBadge = (status: PendingMedia['status'], progress: number) => {
    switch (status) {
      case 'uploading':
        return (
          <View className="bg-blue-100 border border-blue-600 px-3 py-1 rounded-full">
            <Text className="text-blue-800 font-bold text-xs">UPLOADING {progress}%</Text>
          </View>
        );
      case 'completed':
        return (
          <View className="bg-green-100 border border-green-600 px-3 py-1 rounded-full">
            <Text className="text-green-800 font-bold text-xs">COMPLETED</Text>
          </View>
        );
      case 'failed':
        return (
          <View className="bg-red-100 border border-red-600 px-3 py-1 rounded-full">
            <Text className="text-red-800 font-bold text-xs">FAILED</Text>
          </View>
        );
      default:
        return (
          <View className="bg-yellow-100 border border-yellow-600 px-3 py-1 rounded-full">
            <Text className="text-yellow-800 font-bold text-xs">PENDING</Text>
          </View>
        );
    }
  };

  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  const failedCount = queue.filter(i => i.status === 'failed').length;

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-extrabold text-black">
          {t('syncQueueTitle')} ({queue.length})
        </Text>
        {queue.some(i => i.status === 'completed') && (
          <TouchableOpacity
            onPress={handleClearCompleted}
            className="bg-gray-200 px-3 py-2 rounded-lg"
          >
            <Text className="text-black font-bold text-xs">{t('clearCompleted')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        className={`w-full rounded-xl items-center justify-center p-5 shadow-md mb-6 ${
          syncing || queue.length === 0 ? 'bg-gray-300' : 'bg-safety-yellow border-2 border-black'
        }`}
        onPress={handleSync}
        disabled={syncing || queue.length === 0}
      >
        {syncing ? (
          <View className="flex-row items-center space-x-3">
            <ActivityIndicator color="#000" size="small" />
            <Text className="text-black font-extrabold text-xl ml-2">{t('uploadingMediaBtn')}</Text>
          </View>
        ) : (
          <Text className="text-black font-extrabold text-2xl">
            {failedCount > 0 ? t('retryAndSync', { count: failedCount }) : t('syncNow')}
          </Text>
        )}
      </TouchableOpacity>

      {result ? <Text className="font-bold text-green-700 mb-4">{result}</Text> : null}

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View className="border-2 border-gray-300 rounded-xl p-4 mb-3 bg-gray-50">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-extrabold text-lg text-black">
                {item.type.toUpperCase()}: {item.fileName}
              </Text>
              {getStatusBadge(item.status, item.progress)}
            </View>

            <Text className="text-gray-600 text-xs mb-2">Log ID: {item.logId}</Text>

            {item.status === 'uploading' && (
              <View className="w-full bg-gray-200 h-3 rounded-full overflow-hidden border border-gray-400 mb-2">
                <View
                  className="bg-blue-600 h-full"
                  style={{ width: `${item.progress}%` }}
                />
              </View>
            )}

            {item.errorMessage ? (
              <Text className="text-red-600 text-xs font-bold mb-2">
                Error: {item.errorMessage}
              </Text>
            ) : null}

            <View className="flex-row justify-end space-x-2">
              <TouchableOpacity
                onPress={() => handleRemoveItem(item.id)}
                className="bg-red-50 px-3 py-1.5 rounded-md border border-red-300"
              >
                <Text className="text-red-700 font-bold text-xs">{t('remove')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center p-8 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 mt-4">
            <Text className="text-gray-500 font-bold text-lg">{t('noPendingUploads')}</Text>
            <Text className="text-gray-400 text-sm mt-1">{t('allSyncedDesc')}</Text>
          </View>
        }
      />
    </View>
  );
}

