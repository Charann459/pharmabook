import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '../../../src/utils/theme';
import LogoutButton from '../../../src/components/LogoutButton';

export default function BillingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Billing</Text>
      <Text style={styles.sub}>POS screen — coming next</Text>

      <View style={styles.logoutWrap}>
        <LogoutButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sub: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  logoutWrap: {
    marginTop: spacing.lg,
    width: '100%',
    maxWidth: 280,
  },
});