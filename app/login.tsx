import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { lookupTenantByFarmCode, buildPseudoEmail } from '../lib/tenant';
import { useTranslation } from '../lib/i18n';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [farmCode, setFarmCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect login mode based on whether input contains '@'
  const isEmailMode = identifier.includes('@');
  const isUsernameMode = identifier.trim().length > 0 && !isEmailMode;

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError(t('enterEmailOrUsername'));
      return;
    }
    if (!password.trim()) {
      setError(t('enterPassword'));
      return;
    }
    if (password.trim().length < 6) {
      setError(t('passwordMinLength'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      let loginEmail = identifier.trim();

      // Username mode: Resolve Farm Code to tenant and build pseudo-email
      if (isUsernameMode) {
        if (!farmCode.trim()) {
          setError(t('enterFarmCode'));
          setLoading(false);
          return;
        }

        const tenant = await lookupTenantByFarmCode(farmCode.trim());
        if (!tenant) {
          setError(t('farmNotFound', { code: farmCode.trim().toUpperCase() }));
          setLoading(false);
          return;
        }

        loginEmail = buildPseudoEmail(identifier.trim(), tenant.tenantId);
      }

      await signInWithEmailAndPassword(auth, loginEmail, password);
      router.replace('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        setError(t('invalidCredentials'));
      } else {
        setError(err.message || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="bg-white p-6 justify-center"
      >
        <View className="items-center mb-8">
          <Text className="text-4xl font-extrabold text-black tracking-tight text-center">
            {t('appName')}
          </Text>
          <Text className="text-xl font-bold text-gray-700 tracking-widest text-center mt-1">
            {t('appSubtitle')}
          </Text>
          <View className="bg-safety-yellow px-3 py-1 rounded-full mt-2 border border-black">
            <Text className="font-extrabold text-xs text-black uppercase">{t('portalSubtitle')}</Text>
          </View>
        </View>

        {error ? (
          <View className="bg-red-100 border-2 border-red-500 rounded-xl p-4 mb-6">
            <Text className="text-red-700 font-bold text-base text-center">{error}</Text>
          </View>
        ) : null}

        {/* Primary Identifier Input (Email or Username) */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="font-extrabold text-gray-800 text-lg">
              {t('emailOrUsername')}
            </Text>
            {identifier.trim().length > 0 && (
              <View className={`px-2 py-0.5 rounded ${isEmailMode ? 'bg-blue-100' : 'bg-green-100'}`}>
                <Text className={`font-bold text-xs ${isEmailMode ? 'text-blue-800' : 'text-green-800'}`}>
                  {isEmailMode ? t('emailLoginBadge') : t('usernameLoginBadge')}
                </Text>
              </View>
            )}
          </View>
          <TextInput
            className="border-4 border-black p-4 text-xl font-bold rounded-xl bg-white"
            placeholder={t('emailPlaceholder')}
            value={identifier}
            onChangeText={text => {
              setIdentifier(text);
              if (error) setError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Conditional Farm Code Input (Appears when username is detected) */}
        {isUsernameMode && (
          <View className="mb-4 bg-amber-50 p-4 rounded-xl border-2 border-amber-400">
            <Text className="font-extrabold text-black text-lg mb-1">
              {t('farmCode')} *
            </Text>
            <Text className="text-gray-600 text-xs font-bold mb-2">
              {t('farmCodeRequiredHint')}
            </Text>
            <TextInput
              className="border-4 border-black p-4 text-xl font-extrabold rounded-xl bg-white uppercase tracking-widest text-center"
              placeholder={t('farmCodePlaceholder')}
              value={farmCode}
              onChangeText={text => {
                setFarmCode(text.toUpperCase());
                if (error) setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Password Input */}
        <View className="mb-6">
          <Text className="font-extrabold text-gray-800 text-lg mb-1">
            {t('password')} *
          </Text>
          <TextInput
            className="border-4 border-black p-4 text-xl font-bold rounded-xl bg-white"
            placeholder="••••••••"
            value={password}
            onChangeText={text => {
              setPassword(text);
              if (error) setError('');
            }}
            secureTextEntry
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity
          className="bg-black w-full rounded-xl items-center justify-center p-6 shadow-lg mb-4 border-2 border-black"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFCC00" size="large" />
          ) : (
            <Text className="text-safety-yellow font-extrabold text-2xl text-center tracking-wide">
              {t('loginTitle')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Register Tenant Link */}
        <TouchableOpacity
          className="bg-gray-100 border-2 border-black w-full rounded-xl items-center justify-center p-4 mt-2"
          onPress={() => router.push('/register-tenant')}
        >
          <Text className="text-black font-extrabold text-base text-center">
            {t('registerNewTenant')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
