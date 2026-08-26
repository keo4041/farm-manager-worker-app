import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import {
  getUserProfile,
  getTenantDetails,
  getTenantUsers,
  addUserToTenant,
  UserProfile,
  Tenant,
  UserRole,
  AuthMethod,
} from '../lib/tenant';
import { useTranslation } from '../lib/i18n';

export default function TeamManagement() {
  const router = useRouter();
  const { t } = useTranslation();

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('username');
  const [newIdentifier, setNewIdentifier] = useState(''); // Email or Username
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('worker');
  const [addingUser, setAddingUser] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace('/login');
      return;
    }

    const profile = await getUserProfile(currentUser.uid);
    setCurrentProfile(profile);

    if (profile?.tenantId) {
      const tDetails = await getTenantDetails(profile.tenantId);
      setTenant(tDetails);

      const tUsers = await getTenantUsers(profile.tenantId);
      setUsers(tUsers);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = async () => {
    if (!newIdentifier.trim() || !newPassword.trim()) {
      Alert.alert(t('error'), t('enterEmailOrUsername'));
      return;
    }
    if (newPassword.trim().length < 6) {
      Alert.alert(t('error'), t('passwordMinLength'));
      return;
    }
    if (!tenant) return;

    setAddingUser(true);
    try {
      const isUsername = authMethod === 'username';
      await addUserToTenant(
        tenant.tenantId,
        newIdentifier.trim(),
        newPassword.trim(),
        newName.trim() || newIdentifier.trim(),
        newRole,
        isUsername
      );

      Alert.alert(
        t('success'),
        t('userAddedSuccess', {
          name: newName.trim() || newIdentifier.trim(),
          role: newRole.toUpperCase(),
        }) + (isUsername ? `\n${t('workerLoginHint', { code: tenant.farmCode })}` : '')
      );
      setModalVisible(false);
      setNewIdentifier('');
      setNewPassword('');
      setNewName('');
      await loadData();
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Error adding user');
    } finally {
      setAddingUser(false);
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 border-purple-600 text-purple-800';
      case 'admin':
        return 'bg-blue-100 border-blue-600 text-blue-800';
      case 'supervisor':
        return 'bg-amber-100 border-amber-600 text-amber-800';
      default:
        return 'bg-gray-100 border-gray-600 text-gray-800';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-4">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-xl font-bold mt-4">{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      {/* Header Info Card */}
      <View className="bg-black p-4 rounded-2xl mb-4 shadow-md">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-safety-yellow font-extrabold text-2xl">
              {tenant?.name || 'Farm Tenant'}
            </Text>
            <Text className="text-gray-300 font-bold text-xs mt-1">
              Owner: {tenant?.ownerEmail}
            </Text>
          </View>
          {/* Farm Code Badge */}
          {tenant?.farmCode && (
            <View className="bg-safety-yellow px-3 py-1.5 rounded-xl border border-black items-center">
              <Text className="text-black font-extrabold text-[10px] uppercase">{t('farmCode')}</Text>
              <Text className="text-black font-extrabold text-base tracking-widest">{tenant.farmCode}</Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-700">
          <Text className="text-gray-300 font-bold text-xs">
            Plan: {tenant?.license?.planType.toUpperCase() || 'UNLIMITED PREVIEW'}
          </Text>
          <Text className="text-safety-yellow font-extrabold text-xs">
            Users: {users.length} | Storage: {Math.round((tenant?.license?.currentStorageBytes || 0) / 1024)} KB
          </Text>
        </View>
      </View>

      {/* Action Bar */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-extrabold text-black">
          {t('teamTitle')} ({users.length})
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-safety-yellow px-4 py-3 rounded-xl border-2 border-black shadow"
        >
          <Text className="text-black font-extrabold text-sm">{t('addUser')}</Text>
        </TouchableOpacity>
      </View>

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={item => item.uid}
        renderItem={({ item }) => (
          <View className="border-2 border-gray-300 rounded-xl p-4 mb-3 bg-gray-50 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="font-extrabold text-lg text-black">{item.displayName || item.username || item.email}</Text>
              <View className="flex-row items-center mt-1">
                {item.authMethod === 'username' ? (
                  <View className="bg-green-100 px-2 py-0.5 rounded mr-2 border border-green-300">
                    <Text className="text-green-800 font-extrabold text-[10px]">USERNAME: {item.username}</Text>
                  </View>
                ) : (
                  <Text className="text-gray-600 text-xs mr-2">{item.email}</Text>
                )}
              </View>
            </View>
            <View className={`px-3 py-1 rounded-full border ${getRoleBadgeStyle(item.role)}`}>
              <Text className="font-extrabold text-xs uppercase">{item.role}</Text>
            </View>
          </View>
        )}
      />

      {/* Add User Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/80 justify-center items-center p-6"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            className="w-full"
          >
            <View className="bg-white rounded-2xl p-6 w-full border-4 border-black shadow-2xl">
              <Text className="text-2xl font-extrabold text-black mb-3">{t('addMemberModalTitle')}</Text>

              {/* Auth Method Switcher */}
              <Text className="font-bold text-gray-700 mb-1">{t('accountType')}</Text>
              <View className="flex-row mb-4 bg-gray-200 p-1 rounded-xl">
                <TouchableOpacity
                  onPress={() => setAuthMethod('username')}
                  className={`flex-1 py-2.5 items-center rounded-lg ${
                    authMethod === 'username' ? 'bg-black' : ''
                  }`}
                >
                  <Text
                    className={`font-extrabold text-xs ${
                      authMethod === 'username' ? 'text-safety-yellow' : 'text-gray-700'
                    }`}
                  >
                    {t('usernameNoEmail')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAuthMethod('email')}
                  className={`flex-1 py-2.5 items-center rounded-lg ${
                    authMethod === 'email' ? 'bg-black' : ''
                  }`}
                >
                  <Text
                    className={`font-extrabold text-xs ${
                      authMethod === 'email' ? 'text-safety-yellow' : 'text-gray-700'
                    }`}
                  >
                    {t('emailAddress')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text className="font-bold text-gray-700 mb-1">{t('fullName')}</Text>
              <TextInput
                className="border-2 border-gray-400 p-3 text-lg font-bold mb-3 rounded-lg bg-white"
                placeholder="e.g. Koffi Mensah"
                value={newName}
                onChangeText={setNewName}
              />

              {authMethod === 'username' ? (
                <View className="mb-3">
                  <Text className="font-bold text-gray-700 mb-1">{t('usernameLabel')}</Text>
                  <TextInput
                    className="border-2 border-gray-400 p-3 text-lg font-bold rounded-lg bg-white"
                    placeholder={t('usernamePlaceholder')}
                    value={newIdentifier}
                    onChangeText={setNewIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text className="text-gray-500 text-xs mt-1">
                    {t('workerLoginHint', { code: tenant?.farmCode || '' })}
                  </Text>
                </View>
              ) : (
                <View className="mb-3">
                  <Text className="font-bold text-gray-700 mb-1">{t('emailAddress')} *</Text>
                  <TextInput
                    className="border-2 border-gray-400 p-3 text-lg font-bold rounded-lg bg-white"
                    placeholder="worker@farm.com"
                    value={newIdentifier}
                    onChangeText={setNewIdentifier}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              <Text className="font-bold text-gray-700 mb-1">{t('password')} *</Text>
              <TextInput
                className="border-2 border-gray-400 p-3 text-lg font-bold mb-4 rounded-lg bg-white"
                placeholder="••••••••"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <Text className="font-bold text-gray-700 mb-2">{t('selectRole')}</Text>
              <View className="flex-row justify-between mb-6">
                {(['admin', 'supervisor', 'worker'] as UserRole[]).map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setNewRole(r)}
                    className={`flex-1 py-3 items-center mx-1 rounded-lg border-2 ${
                      newRole === r ? 'bg-safety-yellow border-black' : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <Text className="font-extrabold text-xs uppercase">{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row space-x-3">
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="flex-1 bg-gray-300 py-4 rounded-xl items-center mr-2"
                >
                  <Text className="font-bold text-black">{t('cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddMember}
                  disabled={addingUser}
                  className="flex-1 bg-black py-4 rounded-xl items-center ml-2"
                >
                  {addingUser ? (
                    <ActivityIndicator color="#FFCC00" size="small" />
                  ) : (
                    <Text className="font-extrabold text-safety-yellow">{t('saveUser')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
