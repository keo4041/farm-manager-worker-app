import './global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

export default function Layout() {
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
        <Stack.Screen name="form-wizard" options={{ title: 'Daily Log / Rapport' }} />
        <Stack.Screen name="sync-status" options={{ title: 'Sync Status / Statut' }} />
      </Stack>
    </View>
  );
}
