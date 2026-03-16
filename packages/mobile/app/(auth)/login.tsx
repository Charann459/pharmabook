// packages/mobile/app/(auth)/login.tsx
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  // Pre-filling with the default seed credentials so you don't have to type it every time during testing!
  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('secret');

  // Grab the login action and loading state from your Zustand store
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleLogin = async () => {
    try {
      await login(email, password);
      // Success! The token is saved, and _layout.tsx will automatically redirect you to /(app)
    } catch (error: any) {
      // Show an error if the backend rejects the credentials
      alert(error?.message || 'Failed to login. Please check your credentials.');
    }
  };

  return (
    <View className="flex-1 justify-center px-8 bg-gray-50 dark:bg-gray-900">
      <View className="mb-10 items-center">
        <Text className="text-4xl font-bold text-blue-600 mb-2">PharmaBook</Text>
        <Text className="text-gray-500 text-lg">Manage your pharmacy anywhere</Text>
      </View>

      <View className="space-y-4">
        <TextInput
          className="w-full bg-white px-4 py-3 rounded-xl border border-gray-200 text-base"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
        />

        <TextInput
          className="w-full bg-white px-4 py-3 rounded-xl border border-gray-200 text-base mt-4"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center mt-6 shadow-sm flex-row justify-center ${isLoading ? 'bg-blue-400' : 'bg-blue-600'}`}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-lg">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}