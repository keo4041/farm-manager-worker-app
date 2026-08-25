import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { createTenantAccount, UserRole, NewTeamMemberInput, AuthMethod } from '../lib/tenant';

export default function RegisterTenant() {
  const router = useRouter();

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
      Alert.alert('Error / Erreur', 'Please fill in Farm Name, Owner Email, and Password.');
      return;
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
        'Tenant Account Created! / Compte Créé!',
        `Welcome to ${farmName}!\n\nYour Farm Code is: ${tenant.farmCode}\n\nShare this Farm Code with your workers so they can log in using their username.`,
        [{ text: 'CONTINUE', onPress: () => router.replace('/') }]
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white p-6">
      <Text className="text-3xl font-extrabold text-black mb-2">REGISTER FARM TENANT</Text>
      <Text className="text-gray-600 font-bold mb-6">Créer une nouvelle ferme et compte propriétaire</Text>

      {/* Tenant Details */}
      <Text className="text-xl font-bold bg-black text-safety-yellow p-2 mb-4">FARM DETAILS / ADRESSE FERME</Text>

      <Text className="font-bold text-gray-700 mb-1 text-lg">Farm Organization Name *</Text>
      <TextInput
        className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl"
        placeholder="e.g. Agbelouve Teak & Livestock Farm"
        value={farmName}
        onChangeText={setFarmName}
      />

      <Text className="font-bold text-gray-700 mb-1 text-lg">Owner Name / Nom du Propriétaire</Text>
      <TextInput
        className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl"
        placeholder="e.g. Jean Dupont"
        value={ownerName}
        onChangeText={setOwnerName}
      />

      <Text className="font-bold text-gray-700 mb-1 text-lg">Owner Email *</Text>
      <TextInput
        className="border-4 border-black p-4 text-xl font-bold mb-4 rounded-xl"
        placeholder="owner@agbelouve.com"
        value={ownerEmail}
        onChangeText={setOwnerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text className="font-bold text-gray-700 mb-1 text-lg">Owner Password *</Text>
      <TextInput
        className="border-4 border-black p-4 text-xl font-bold mb-6 rounded-xl"
        placeholder="••••••••"
        value={ownerPassword}
        onChangeText={setOwnerPassword}
        secureTextEntry
      />

      {/* Initial Team Members (Optional) */}
      <Text className="text-xl font-bold bg-black text-safety-yellow p-2 mb-2">
        INITIAL TEAM MEMBERS (OPTIONAL)
      </Text>
      <Text className="text-gray-500 font-bold mb-4">
        You can pre-add Admins, Supervisors, or Workers with email or username.
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
                  EMAIL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateMember(i, 'authMethod', 'username')}
                className={`px-2 py-1 rounded ${member.authMethod === 'username' ? 'bg-black' : ''}`}
              >
                <Text className={`font-extrabold text-xs ${member.authMethod === 'username' ? 'text-safety-yellow' : 'text-gray-700'}`}>
                  USERNAME
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
            placeholder="Full Name / Nom Complet"
            value={member.displayName}
            onChangeText={val => updateMember(i, 'displayName', val)}
          />

          {member.authMethod === 'username' ? (
            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
              placeholder="Username / Nom d'utilisateur (e.g. koffi)"
              value={member.username}
              onChangeText={val => updateMember(i, 'username', val)}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <TextInput
              className="border-2 border-gray-400 p-3 text-lg font-bold mb-2 bg-white rounded-lg"
              placeholder="Email Address"
              value={member.email}
              onChangeText={val => updateMember(i, 'email', val)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}

          <TextInput
            className="border-2 border-gray-400 p-3 text-lg font-bold bg-white rounded-lg"
            placeholder="Initial Password / Mot de passe"
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
            CREATE TENANT ACCOUNT
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
