import './global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { startNetworkSyncListener } from '../lib/sync';
import { useTranslation } from '../lib/i18n';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const { currentLanguage, changeLanguage, isFrench } = useTranslation();

  // 1. Listen for Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing]);

  // 2. Start Background Network Sync Listener
  useEffect(() => {
    const unsubNet = startNetworkSyncListener((syncedCount) => {
      console.log(`[Auto-Sync] Background upload completed: ${syncedCount} media items synced.`);
    });
    return () => unsubNet();
  }, []);

  // 3. Centralized Route Guard
  useEffect(() => {
    if (initializing) return;

    const firstSegment = segments[0] as string | undefined;
    const isAuthRoute = firstSegment === 'login' || firstSegment === 'register-tenant';

    if (!user && !isAuthRoute) {
      // Unauthenticated user attempting to access protected route -> redirect to login
      router.replace('/login');
    } else if (user && isAuthRoute) {
      // Authenticated user on auth screen -> redirect to home dashboard
      router.replace('/');
    }
  }, [user, initializing, segments]);

  const LanguageHeaderButton = () => (
    <TouchableOpacity
      onPress={() => changeLanguage(isFrench ? 'en' : 'fr')}
      className="bg-black px-2.5 py-1 rounded-lg border border-black flex-row items-center mr-2"
    >
      <Text className="text-safety-yellow font-extrabold text-xs">
        {isFrench ? '🇫🇷 FR' : '🇺🇸 EN'}
      </Text>
    </TouchableOpacity>
  );

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="dark" />
        <View className="items-center">
          <View className="w-16 h-16 bg-safety-yellow rounded-2xl border-4 border-black items-center justify-center mb-4 shadow-lg">
            <ActivityIndicator size="large" color="#000000" />
          </View>
          <Text className="text-xl font-extrabold text-black tracking-wider">
            AGBELOUVE FARM
          </Text>
          <Text className="text-xs font-bold text-gray-500 mt-1">
            {isFrench ? 'Chargement de la session...' : 'Loading session...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ 
        headerStyle: { backgroundColor: '#FFCC00' },
        headerTintColor: '#000000',
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => <LanguageHeaderButton />
      }}>
        <Stack.Screen name="index" options={{ title: 'Agbelouve Farm Manager' }} />
        <Stack.Screen name="login" options={{ title: isFrench ? 'Connexion' : 'Login', headerShown: false }} />
        <Stack.Screen name="register-tenant" options={{ title: isFrench ? 'Nouvelle Ferme' : 'Register Farm' }} />
        <Stack.Screen name="team-management" options={{ title: isFrench ? 'Équipe & Accès' : 'Team Management' }} />
        <Stack.Screen name="admin-reports" options={{ title: isFrench ? 'Rapports & Journaux' : 'Reports & Logs' }} />
        <Stack.Screen name="form-wizard" options={{ title: isFrench ? 'Rapport de Quart' : 'Shift Daily Log' }} />
        <Stack.Screen name="sync-status" options={{ title: isFrench ? 'File de Synchronisation' : 'Sync Status' }} />
      </Stack>
    </View>
  );
}

