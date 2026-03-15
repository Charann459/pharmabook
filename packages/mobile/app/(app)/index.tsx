import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useUser } from '../../src/store/auth.store';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/utils/theme';

export default function HomeScreen() {
  const user = useUser();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Good morning,</Text>
        <Text style={styles.shopName}>{user?.shop_name}</Text>
      </View>

      <View style={styles.roleTag}>
        <Text style={styles.roleText}>{user?.role.replace('_', ' ').toUpperCase()}</Text>
      </View>

      <Text style={styles.placeholder}>
        Dashboard coming soon — billing, inventory and reports screens are next.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content:   { padding: spacing.xl },
  greeting:  { marginBottom: spacing.lg },
  greetingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  shopName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.navyLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  roleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.navy,
    letterSpacing: 0.5,
  },
  placeholder: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
