import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useRole } from '../../src/store/auth.store';

const TabIcon = ({ label }: { label: string }) => {
  return <Text className="text-lg">{label}</Text>;
};

export default function AppTabsLayout() {
  const role = useRole();

  const isOwner = role === 'owner';
  const isCashier = role === 'cashier';
  const isInventoryManager = role === 'inventory_manager';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isOwner ? '/(app)' : null,
          tabBarIcon: () => <TabIcon label="🏠" />,
        }}
      />

      <Tabs.Screen
        name="billing/index"
        options={{
          title: 'Billing',
          href: isOwner || isCashier ? '/(app)/billing' : null,
          tabBarIcon: () => <TabIcon label="🧾" />,
        }}
      />

      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'Inventory',
          href: isOwner || isInventoryManager ? '/(app)/inventory' : null,
          tabBarIcon: () => <TabIcon label="📦" />,
        }}
      />

      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          href: isOwner ? '/(app)/reports' : null,
          tabBarIcon: () => <TabIcon label="📊" />,
        }}
      />

      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          href: isOwner ? '/(app)/settings' : null,
          tabBarIcon: () => <TabIcon label="⚙️" />,
        }}
      />
    </Tabs>
  );
}