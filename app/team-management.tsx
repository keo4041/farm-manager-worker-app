import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
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
} from '../lib/tenant';

export default function TeamManagement() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
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
    if (!newEmail.trim() || !newPassword.trim()) {
      Alert.alert('Error / Erreur', 'Email and password are required.');
      return;
    }
    if (!tenant) return;

    setAddingUser(true);
    try {
      await addUserToTenant(
        tenant.tenantId,
        newEmail.trim(),
        newPassword.trim(),
        newName.trim() || newEmail.split('@')[0],
        newRole
      );

      Alert.alert('Success / Succès', `User ${newEmail} added as ${newRole.toUpperCase()}!`);
      setModalVisible(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error Adding User', err.message);
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
        <Text className="text-xl font-bold mt-4">Loading Team & License Data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      {/* Header Info Card */}
      <View className="bg-black p-4 rounded-2xl mb-4 shadow-md">
        <Text className="text-safety-yellow font-extrabold text-2xl">
          {tenant?.name || 'Farm Tenant'}
        </Text>
        <Text className="text-white font-bold text-sm mt-1">
          Owner: {tenant?.ownerEmail}
        </Text>
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
        <Text className="text-2xl font-extrabold text-black">Team Members ({users.length})</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-safety-yellow px-4 py-3 rounded-xl border-2 border-black shadow"
        >
          <Text className="text-black font-extrabold text-sm">+ ADD USER</Text>
        </TouchableOpacity>
      </View>

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={item => item.uid}
        renderItem={({ item }) => (
          <View className="border-2 border-gray-300 rounded-xl p-4 mb-3 bg-gray-50 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="font-extrabold text-lg text-black">{item.displayName || item.email}</Text>
              <Text className="text-gray-600 text-xs">{item.email}</Text>
            </View>
            <View className={`px-3 py-1 rounded-full border ${getRoleBadgeStyle(item.role)}`}>
              <Text className="font-extrabold text-xs uppercase">{item.role}</Text>
            </View>
          </View>
        )}
      />

      {/* Add User Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center items-center p-6">
          <View className="bg-white rounded-2xl p-6 w-full border-4 border-black shadow-2xl">
            <Text className="text-2xl font-extrabold text-black mb-4">Add Team Member</Text>

            <Text className="font-bold text-gray-700 mb-1">Full Name</Text>
            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-3 rounded-lg"
              placeholder="e.g. Koffi Mensah"
              value={newName}
              onChangeText={setNewName}
            />

            <Text className="font-bold text-gray-700 mb-1">Email Address *</Text>
            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-3 rounded-lg"
              placeholder="worker@farm.com"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text className="font-bold text-gray-700 mb-1">Password *</Text>
            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-4 rounded-lg"
              placeholder="••••••••"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Text className="font-bold text-gray-700 mb-2">Select Role / Rôle</Text>
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
                className="flex-1 bg-gray-300 py-4 rounded-xl items-center"
              >
                <Text className="font-bold text-black">CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddMember}
                disabled={addingUser}
                className="flex-1 bg-black py-4 rounded-xl items-center"
              >
                {addingUser ? (
                  <ActivityIndicator color="#FFCC00" size="small" />
                ) : (
                  <Text className="font-extrabold text-safety-yellow">SAVE USER</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
