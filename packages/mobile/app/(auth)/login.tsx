import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/services/api';
import { getMobileDefaultRouteForRole, useAuthStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('secret123');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);

      const user = await login(email.trim(), password);

      router.replace(getMobileDefaultRouteForRole(user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        return;
      }

      setError('Login failed. Please check your backend connection and credentials.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-100"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-6">
        <View className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Text className="text-xs font-bold uppercase tracking-[4px] text-emerald-500">
            PharmaBook
          </Text>

          <Text className="mt-4 text-3xl font-black text-slate-950">Login</Text>

          <Text className="mt-2 text-sm text-slate-500">
            Sign in to access mobile dashboard, billing, inventory, and reports.
          </Text>

          {error ? (
            <View className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="text-sm font-semibold text-red-700">{error}</Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Text className="text-sm font-bold text-slate-700">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="owner@example.com"
              className="mt-2 rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-950"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm font-bold text-slate-700">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="secret123"
              className="mt-2 rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-950"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            className={`mt-6 rounded-xl px-5 py-4 ${isLoading ? 'bg-emerald-300' : 'bg-emerald-500'
              }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center text-sm font-bold text-white">Login</Text>
            )}
          </Pressable>

          <Text className="mt-4 text-center text-xs text-slate-400">
            Owner, cashier, and inventory manager roles route automatically.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}