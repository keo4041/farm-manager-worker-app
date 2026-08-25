import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('manager@agbelouve.com');
  const [password, setPassword] = useState('password123'); // Hardcoded default based on request
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-4xl font-extrabold text-black mb-12 text-center">FARM MANAGER</Text>
      
      {error ? <Text className="text-red-500 font-bold mb-4">{error}</Text> : null}

      <TextInput
        className="border-4 border-black p-4 text-2xl font-bold mb-6"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        className="border-4 border-black p-4 text-2xl font-bold mb-10"
        placeholder="Password / Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        className="bg-black w-full rounded items-center justify-center p-6 shadow-lg mb-4"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFCC00" size="large" />
        ) : (
          <Text className="text-safety-yellow font-extrabold text-3xl text-center">
            LOGIN / CONNEXION
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-gray-200 border-2 border-black w-full rounded items-center justify-center p-4 mt-2"
        onPress={() => router.push('/register-tenant')}
      >
        <Text className="text-black font-extrabold text-lg text-center">
          Register New Farm Tenant / Créer une Ferme
        </Text>
      </TouchableOpacity>
    </View>
  );
}

