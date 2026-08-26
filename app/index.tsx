import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSyncQueue, processSyncQueue } from '../lib/sync';
import { getUserProfile, getTenantDetails, UserProfile, Tenant } from '../lib/tenant';
import { useTranslation } from '../lib/i18n';

export default function Home() {
  const router = useRouter();
  const { t, isFrench } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const loadUserData = async (uid: string) => {
    try {
      const prof = await getUserProfile(uid);
      setUserProfile(prof);
      if (prof?.tenantId) {
        const tDetails = await getTenantDetails(prof.tenantId);
        setTenant(tDetails);
      }
    } catch (e) {
      console.error('Error loading user data:', e);
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadUserData(user.uid);
      } else {
        setUserProfile(null);
        setTenant(null);
      }
    });

    checkQueue();
    return unsubscribe;
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      t('logOutConfirmTitle'),
      t('logOutConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (err: any) {
              Alert.alert(t('error'), err.message);
            }
          },
        },
      ]
    );
  };

  const isManagementRole = userProfile?.role === 'owner' || userProfile?.role === 'admin';
  const canViewReports = userProfile?.role === 'owner' || userProfile?.role === 'admin' || userProfile?.role === 'supervisor';

  return (
    <ScrollView className="flex-1 bg-white p-4">
      {/* Tenant Header & User Role Badge */}
      <View className="bg-black p-4 rounded-2xl mb-4 border-2 border-safety-yellow shadow-md">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-safety-yellow font-extrabold text-2xl">
              {tenant?.name || 'Agbelouve Farm Manager'}
            </Text>
            <Text className="text-white font-bold text-xs mt-1">
              {userProfile?.displayName || userProfile?.email || t('workerPortal')}
            </Text>
          </View>

          {userProfile?.role && (
            <View className="bg-safety-yellow px-3 py-1 rounded-full border border-black ml-2">
              <Text className="text-black font-extrabold text-xs uppercase">{userProfile.role}</Text>
            </View>
          )}
        </View>

        {tenant?.farmCode ? (
          <View className="mt-3 pt-3 border-t border-gray-800 flex-row items-center justify-between">
            <Text className="text-gray-400 font-bold text-xs uppercase">{t('farmCode')}:</Text>
            <View className="bg-gray-800 px-3 py-1 rounded-md border border-safety-yellow">
              <Text className="text-safety-yellow font-extrabold text-sm tracking-wider">
                {tenant.farmCode}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Sync Status Banner */}
      <View className="flex-row items-center justify-between bg-gray-100 rounded-xl p-4 mb-4 border-2 border-gray-300">
        <View className="flex-row items-center space-x-2">
          <View className={`w-4 h-4 rounded-full ${pendingCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
          <Text className="text-black font-extrabold text-lg ml-2">
            {pendingCount > 0
              ? t('mediaPending', { count: pendingCount })
              : t('allMediaSynced')}
          </Text>
        </View>
        <Text className="text-xs font-bold text-gray-500">{t('offlineReady')}</Text>
      </View>

      {/* Role-Based Action Cards */}
      <View className="space-y-4 flex-col gap-4">
        {/* Reports & Logs Hub (Owner / Admin / Supervisor) */}
        {canViewReports && (
          <TouchableOpacity
            className="bg-black w-full rounded-2xl items-center justify-between p-5 shadow-lg flex-row border-2 border-safety-yellow"
            onPress={() => router.push('/admin-reports')}
          >
            <View className="flex-1 pr-2">
              <Text className="text-safety-yellow font-extrabold text-2xl">{t('reportsAndLogs')}</Text>
              <Text className="text-gray-300 font-bold text-xs mt-0.5">
                {t('reportsSubtitle')}
              </Text>
            </View>
            <View className="bg-safety-yellow px-3 py-2 rounded-xl border border-black">
              <Text className="text-black font-extrabold text-xs">{t('viewHub')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Owner / Admin Team Management Access */}
        {isManagementRole && (
          <TouchableOpacity
            className="bg-purple-900 w-full rounded-2xl items-center justify-between p-5 shadow-lg flex-row border-2 border-black"
            onPress={() => router.push('/team-management')}
          >
            <View className="flex-1 pr-2">
              <Text className="text-white font-extrabold text-2xl">{t('teamManagement')}</Text>
              <Text className="text-purple-200 font-bold text-xs mt-0.5">{t('teamSubtitle')}</Text>
            </View>
            <View className="bg-safety-yellow px-3 py-2 rounded-xl">
              <Text className="text-black font-extrabold text-xs">{t('usersAndQuotas')}</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          className="bg-safety-yellow w-full rounded-2xl items-center justify-center h-40 shadow-lg border-2 border-black"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'MORNING' } })}
        >
          <Text className="text-black font-extrabold text-3xl text-center px-4">
            {t('startMorningLog')}{"\n"}
            <Text className="text-xl font-bold">{t('startMorningLogSub')}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-black w-full rounded-2xl items-center justify-center h-40 shadow-lg"
          onPress={() => router.push({ pathname: '/form-wizard', params: { type: 'EVENING' } })}
        >
          <Text className="text-safety-yellow font-extrabold text-3xl text-center px-4">
            {t('startEveningLog')}{"\n"}
            <Text className="text-xl font-bold">{t('startEveningLogSub')}</Text>
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-gray-200 w-full rounded-xl items-center justify-between h-16 px-6 border-2 border-black flex-row"
          onPress={() => router.push('/sync-status')}
        >
          <Text className="text-black font-extrabold text-lg">{t('viewSyncQueue')}</Text>
          {pendingCount > 0 && (
            <View className="bg-amber-500 px-3 py-1 rounded-full">
              <Text className="text-white font-extrabold text-sm">{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Log Out Button */}
        <TouchableOpacity 
          className="bg-red-50 border-2 border-red-500 w-full rounded-xl items-center justify-center p-4 mb-8"
          onPress={handleSignOut}
        >
          <Text className="text-red-700 font-extrabold text-base">
            {t('logOut')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}


