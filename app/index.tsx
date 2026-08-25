import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import { getSyncQueue, processSyncQueue } from '../lib/sync';
import { getUserProfile, getTenantDetails, UserProfile, Tenant } from '../lib/tenant';

export default function Home() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const loadUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      const prof = await getUserProfile(user.uid);
      setUserProfile(prof);
      if (prof?.tenantId) {
        const t = await getTenantDetails(prof.tenantId);
        setTenant(t);
      }
    }
  };

  const checkQueue = async () => {
    const queue = await getSyncQueue();
    const pending = queue.filter(item => item.status !== 'completed').length;
    setPendingCount(pending);

    if (pending > 0) {
      processSyncQueue().then(() => {
        getSyncQueue().then(q => {
          setPendingCount(q.filter(item => item.status !== 'completed').length);
        });
      });
    }
  };

  useEffect(() => {
    loadUserData();
    checkQueue();
  }, []);

  const isManagementRole = userProfile?.role === 'owner' || userProfile?.role === 'admin';

  return (
    <ScrollView className="flex-1 bg-white p-4">
      {/* Tenant Header & User Role Badge */}
      <View className="bg-black p-4 rounded-2xl mb-4 border-2 border-safety-yellow shadow-md flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-safety-yellow font-extrabold text-2xl">
            {tenant?.name || 'Agbelouve Farm Manager'}
          </Text>
          <Text className="text-white font-bold text-xs mt-1">
            {userProfile?.displayName || userProfile?.email || 'Worker Portal'}
          </Text>
        </View>

        {userProfile?.role && (
          <View className="bg-safety-yellow px-3 py-1 rounded-full border border-black ml-2">
            <Text className="text-black font-extrabold text-xs uppercase">{userProfile.role}</Text>
          </View>
        )}
      </View>

      {/* Sync Status Banner */}
      <View className="flex-row items-center justify-between bg-gray-100 rounded-xl p-4 mb-4 border-2 border-gray-300">
        <View className="flex-row items-center space-x-2">
          <View className={`w-4 h-4 rounded-full ${pendingCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
          <Text className="text-black font-extrabold text-lg ml-2">
            {pendingCount > 0 ? `${pendingCount} Media Item(s) Pending` : 'All Media Synced'}
          </Text>
        </View>
        <Text className="text-xs font-bold text-gray-500">Offline Ready</Text>
      </View>

      {/* Role-Based Action Cards */}
      <View className="space-y-4 flex-col gap-4">
        {/* Owner / Admin Management Access */}
        {isManagementRole && (
          <TouchableOpacity
            className="bg-purple-900 w-full rounded-2xl items-center justify-between p-6 shadow-lg flex-row border-2 border-black"
            onPress={() => router.push('/team-management')}
          >
            <View>
              <Text className="text-white font-extrabold text-2xl">TEAM MANAGEMENT</Text>
              <Text className="text-purple-200 font-bold text-sm">Manage Admins, Supervisors & Workers</Text>
            </View>
            <View className="bg-safety-yellow px-3 py-2 rounded-lg">
              <Text className="text-black font-extrabold text-xs">USERS & QUOTAS</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          className="bg-safety-yellow w-full rounded-2xl items-center justify-center h-40 shadow-lg border-2 border-black"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'MORNING' } })}
        >
          <Text className="text-black font-extrabold text-3xl text-center px-4">
            START MORNING LOG{"\n"}
            <Text className="text-xl font-bold">Démarrer le rapport du matin</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-black w-full rounded-2xl items-center justify-center h-40 shadow-lg"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'EVENING' } })}
        >
          <Text className="text-safety-yellow font-extrabold text-3xl text-center px-4">
            START EVENING LOG{"\n"}
            <Text className="text-xl font-bold">Démarrer le rapport du soir</Text>
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-gray-200 w-full rounded-xl items-center justify-between h-16 px-6 border-2 border-black flex-row mb-8"
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
    </ScrollView>
  );
}


