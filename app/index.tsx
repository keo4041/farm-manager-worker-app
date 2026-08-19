import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function Home() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-4">
      <View className="items-center justify-center bg-gray-200 rounded p-2 mb-6">
        <Text className="text-black font-bold text-lg">Sync Status: Offline / Hors ligne</Text>
      </View>

      <View className="flex-1 justify-center space-y-6 flex-col gap-6">
        <TouchableOpacity 
          className="bg-safety-yellow w-full rounded-2xl items-center justify-center h-48 shadow-lg"
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
          className="bg-gray-300 w-full rounded-xl items-center justify-center h-16 mt-4"
          onPress={() => router.push('/sync-status')}
        >
          <Text className="text-black font-bold text-lg">View Sync Queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
