import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';

import { useMemo, useState } from 'react';

import { useAuthStore, useUser } from '../../../src/store/auth.store';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  radius,
} from '../../../src/utils/theme';

export default function SettingsScreen() {
  const user = useUser();
  const logout = useAuthStore((s) => s.logout);

  const isOwner = user?.role === 'owner';

  const [shopName, setShopName] = useState(user?.shop_name ?? '');
  const [gstNo, setGstNo] = useState('37ABCDE1234F1Z5');

  const lastSync = useMemo(() => {
    return new Date().toLocaleString();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name}</Text>

          <Text style={styles.role}>
            {user?.role.replace('_', ' ')} • {user?.shop_name}
          </Text>

          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {/* Shop Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shop Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Shop Name</Text>

          <TextInput
            value={shopName}
            onChangeText={setShopName}
            placeholder="Shop name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>GST Number</Text>

          <TextInput
            value={gstNo}
            onChangeText={setGstNo}
            placeholder="GST Number"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.disabledBtn} activeOpacity={0.9}>
          <Text style={styles.disabledBtnText}>
            Save Changes (API coming soon)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Staff Management */}
      {isOwner && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Staff Management</Text>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>OWNER</Text>
            </View>
          </View>

          <View style={styles.staffCard}>
            <Text style={styles.staffTitle}>Cashiers</Text>
            <Text style={styles.staffSub}>2 active staff members</Text>
          </View>

          <View style={styles.staffCard}>
            <Text style={styles.staffTitle}>Inventory Managers</Text>
            <Text style={styles.staffSub}>1 active inventory manager</Text>
          </View>

          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>
              Add Staff (coming soon)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Printer Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Printer Settings</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Connected Printer</Text>
          <Text style={styles.infoValue}>Not connected</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bluetooth Status</Text>
          <Text style={styles.infoValue}>Unavailable on web</Text>
        </View>

        <TouchableOpacity style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>
            BLE Printer Setup (later)
          </Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>v1.0.0</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Environment</Text>
          <Text style={styles.infoValue}>
            {process.env.EXPO_PUBLIC_ENV ?? 'development'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>API</Text>
          <Text style={styles.infoValue}>
            {process.env.EXPO_PUBLIC_API_URL}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Sync</Text>
          <Text style={styles.infoValue}>{lastSync}</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  profileCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },

  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },

  role: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textTransform: 'capitalize',
  },

  email: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.55)',
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },

  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  inputGroup: {
    marginBottom: spacing.lg,
  },

  label: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },

  disabledBtn: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  disabledBtnText: {
    color: colors.navy,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  badge: {
    backgroundColor: colors.navyLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },

  badgeText: {
    color: colors.navy,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  staffCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  staffTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  staffSub: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  secondaryBtnText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
    maxWidth: '55%',
    textAlign: 'right',
  },

  logoutBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  logoutText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
});