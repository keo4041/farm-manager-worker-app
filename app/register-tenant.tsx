import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createTenantAccount, NewTeamMemberInput } from '../lib/tenant';
import { useTranslation } from '../lib/i18n';

export default function RegisterTenant() {
  const router = useRouter();
  const { t } = useTranslation();

  // Tenant & Owner Info
  const [farmName, setFarmName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  // Initial Team Members Setup
  const [teamMembers, setTeamMembers] = useState<NewTeamMemberInput[]>([
    { email: '', username: '', password: '', displayName: '', role: 'admin', authMethod: 'email' },
    { email: '', username: '', password: '', displayName: '', role: 'supervisor', authMethod: 'email' },
    { email: '', username: '', password: '', displayName: '', role: 'worker', authMethod: 'username' },
  ]);

  const [loading, setLoading] = useState(false);

  const updateMember = (index: number, field: keyof NewTeamMemberInput, value: any) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleRegister = async () => {
    if (!farmName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) {
      Alert.alert(t('error'), t('enterEmailOrUsername'));
      return;
    }

    if (ownerPassword.trim().length < 6) {
      Alert.alert(t('error'), t('passwordMinLength'));
      return;
    }

    // Validate any populated team member passwords
    for (const m of teamMembers) {
      const hasId = m.authMethod === 'username' ? !!m.username?.trim() : !!m.email?.trim();
      if (hasId && m.password && m.password.trim().length < 6) {
        Alert.alert(t('error'), `${m.displayName || m.username || m.email}: ${t('passwordMinLength')}`);
        return;
      }
    }

    setLoading(true);
    try {
      // Filter valid team members with identifier & password filled
      const validTeam = teamMembers.filter(m => {
        const hasId = m.authMethod === 'username' ? !!m.username?.trim() : !!m.email?.trim();
        return hasId && !!m.password?.trim();
      });

      const { tenant } = await createTenantAccount(
        farmName.trim(),
        ownerEmail.trim(),
        ownerPassword.trim(),
        ownerName.trim() || 'Farm Owner',
        validTeam
      );

      Alert.alert(
        t('tenantCreatedTitle'),
        t('tenantCreatedMsg', { farmName: tenant.name, farmCode: tenant.farmCode }),
        [{ text: t('continue'), onPress: () => router.replace('/') }]
      );
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Registration failed');
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
        keyboardShouldPersistTaps="handled"
        className="flex-1 bg-white p-6"
      >
        <Text className="text-3xl font-extrabold text-black mb-1">{t('registerTitle')}</Text>
        <Text className="text-gray-600 font-bold mb-6">{t('registerSubtitle')}</Text>

        {/* Tenant Details */}
        <Text className="text-xl font-bold bg-black text-safety-yellow p-2 mb-4">
          {t('farmDetailsHeader')}
        </Text>

        <Text className="font-bold text-gray-700 mb-1 text-lg">{t('farmOrgName')}</Text>
        <TextInput
          className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl bg-white"
          placeholder={t('farmOrgPlaceholder')}
          value={farmName}
          onChangeText={setFarmName}
        />

        <Text className="font-bold text-gray-700 mb-1 text-lg">{t('ownerName')}</Text>
        <TextInput
          className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl bg-white"
          placeholder={t('ownerNamePlaceholder')}
          value={ownerName}
          onChangeText={setOwnerName}
        />

        <Text className="font-bold text-gray-700 mb-1 text-lg">{t('ownerEmail')}</Text>
        <TextInput
          className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl bg-white"
          placeholder="owner@agbelouve.com"
          value={ownerEmail}
          onChangeText={setOwnerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text className="font-bold text-gray-700 mb-1 text-lg">{t('ownerPassword')}</Text>
        <TextInput
          className="border-4 border-black p-4 text-xl font-bold mb-6 rounded-xl bg-white"
          placeholder="••••••••"
          value={ownerPassword}
          onChangeText={setOwnerPassword}
          secureTextEntry
        />

        {/* Initial Team Members (Optional) */}
        <Text className="text-xl font-bold bg-black text-safety-yellow p-2 mb-2">
          {t('initialTeamHeader')}
        </Text>
        <Text className="text-gray-500 font-bold mb-4">
          {t('initialTeamSubtitle')}
        </Text>

        {teamMembers.map((member, i) => (
          <View key={i} className="border-2 border-gray-300 p-4 rounded-xl mb-4 bg-gray-50">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-extrabold text-black text-lg capitalize">
                Role: {member.role.toUpperCase()}
              </Text>
              {/* Toggle Email vs Username */}
              <View className="flex-row bg-gray-200 rounded-lg p-1">
                <TouchableOpacity
                  onPress={() => updateMember(i, 'authMethod', 'email')}
                  className={`px-2 py-1 rounded ${member.authMethod === 'email' ? 'bg-black' : ''}`}
                >
                  <Text className={`font-extrabold text-xs ${member.authMethod === 'email' ? 'text-safety-yellow' : 'text-gray-700'}`}>
                    {t('emailAddress')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateMember(i, 'authMethod', 'username')}
                  className={`px-2 py-1 rounded ${member.authMethod === 'username' ? 'bg-black' : ''}`}
                >
                  <Text className={`font-extrabold text-xs ${member.authMethod === 'username' ? 'text-safety-yellow' : 'text-gray-700'}`}>
                    {t('usernameNoEmail')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
              placeholder={t('fullName')}
              value={member.displayName}
              onChangeText={val => updateMember(i, 'displayName', val)}
            />

            {member.authMethod === 'username' ? (
              <TextInput
                className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
                placeholder={t('usernamePlaceholder')}
                value={member.username}
                onChangeText={val => updateMember(i, 'username', val)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : (
              <TextInput
                className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
                placeholder={t('emailAddress')}
                value={member.email}
                onChangeText={val => updateMember(i, 'email', val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}

            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold bg-white rounded-lg"
              placeholder={t('password')}
              value={member.password}
              onChangeText={val => updateMember(i, 'password', val)}
              secureTextEntry
            />
          </View>
        ))}

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          className="bg-black py-6 items-center rounded-xl my-8 shadow-lg border-2 border-black"
        >
          {loading ? (
            <ActivityIndicator color="#FFCC00" size="large" />
          ) : (
            <Text className="text-safety-yellow font-extrabold text-2xl text-center">
              {t('createTenantBtn')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
