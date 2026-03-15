import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useRole, useAuthStore } from '../../src/store/auth.store';
import { colors, fontSize, fontWeight } from '../../src/utils/theme';

export default function AppLayout() {
  const role   = useRole();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const isOwner      = role === 'owner';
  const isCashier    = role === 'cashier';
  const isInvManager = role === 'inv_manager';

  return (
    <Tabs
      screenOptions={{
        headerStyle:     { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle:{ fontWeight: fontWeight.bold },
        tabBarStyle:     styles.tabBar,
        tabBarActiveTintColor:   colors.navy,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* Home — owner only */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isOwner ? undefined : null, // null hides from non-owners
          tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} />,
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Billing — owner + cashier */}
      <Tabs.Screen
        name="billing/index"
        options={{
          title: 'Billing',
          href: (isOwner || isCashier) ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon label="🧾" color={color} />,
        }}
      />

      {/* Inventory — owner + inv_manager */}
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'Inventory',
          href: (isOwner || isInvManager) ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon label="💊" color={color} />,
        }}
      />

      {/* Reports — owner only */}
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon label="📊" color={color} />,
        }}
      />

      {/* Settings — owner only */}
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon label="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    paddingBottom: 8,
    height: 60,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  logoutBtn: {
    marginRight: 16,
  },
  logoutText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.sm,
  },
});
