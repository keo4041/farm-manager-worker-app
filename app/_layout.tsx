import './global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing]);

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
            Loading session... / Chargement...
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
        headerTitleStyle: { fontWeight: 'bold' } 
      }}>
        <Stack.Screen name="index" options={{ title: 'Agbelouve Farm Manager' }} />
        <Stack.Screen name="login" options={{ title: 'Login / Connexion', headerShown: false }} />
        <Stack.Screen name="register-tenant" options={{ title: 'Register Farm / Nouvelle Ferme' }} />
        <Stack.Screen name="team-management" options={{ title: 'Team Management / Équipe' }} />
        <Stack.Screen name="form-wizard" options={{ title: 'Daily Log / Rapport' }} />
        <Stack.Screen name="sync-status" options={{ title: 'Sync Status / Statut' }} />
      </Stack>
    </View>
  );
}

