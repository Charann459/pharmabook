import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth.store';

export default function LogoutButton() {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);

    const handleLogout = async () => {
        await logout();
        router.replace('/(auth)/login');
    };

    return (
        <Pressable
            onPress={handleLogout}
            style={{
                borderRadius: 12,
                backgroundColor: '#0f172a',
                paddingHorizontal: 16,
                paddingVertical: 14,
            }}
        >
            <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                Logout
            </Text>
        </Pressable>
    );
}