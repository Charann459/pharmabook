import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '../../src/store/auth.store';
import {
  billsApi,
  inventoryApi,
  reportsApi,
  type Bill,
  type InventoryItem,
} from '../../src/services/api';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/utils/theme';

type DashboardStats = {
  revenueToday: number;
  billsToday: number;
  lowStockCount: number;
  expiringCount: number;
};

type NotificationItem = {
  id: string;
  type: 'sale' | 'stock' | 'expiry' | 'info';
  title: string;
  message: string;
  ts: string;
};

const formatCurrency = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const toNumber = (value: number | string | undefined | null) => Number(value ?? 0);

const isToday = (dateString?: string) => {
  if (!dateString) return false;
  return new Date(dateString).toISOString().slice(0, 10) === todayIso();
};

export default function HomeScreen() {
  const user = useUser();

  const [stats, setStats] = useState<DashboardStats>({
    revenueToday: 0,
    billsToday: 0,
    lowStockCount: 0,
    expiringCount: 0,
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.role === 'owner';

  const loadDashboard = useCallback(async (showPullRefresh = false) => {
    try {
      if (showPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const [daily, lowStock, expiring, bills] = await Promise.all([
        reportsApi.daily(),
        inventoryApi.lowStock(),
        inventoryApi.expiring(30),
        billsApi.list(todayIso()),
      ]);

      const todayBills = Array.isArray(bills) ? bills.filter((bill) => isToday(bill.created_at)) : [];
      const lowStockItems = Array.isArray(lowStock) ? lowStock : [];
      const expiringItems = Array.isArray(expiring) ? expiring : [];

      const revenueToday = toNumber(daily?.summary?.revenue);
      const billsToday = Number(daily?.summary?.bill_count ?? todayBills.length);

      setStats({
        revenueToday,
        billsToday,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
      });

      setNotifications(buildNotifications(todayBills, lowStockItems, expiringItems));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadDashboard();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const roleLabel = useMemo(
    () => user?.role?.replace('_', ' ').toUpperCase() ?? 'USER',
    [user?.role]
  );

  if (!isOwner) {
    return (
      <View style={styles.centerPage}>
        <Text style={styles.blockedTitle}>Owner dashboard</Text>
        <Text style={styles.blockedText}>
          This dashboard is available only for owner accounts.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDashboard(true)}
          tintColor={colors.navy}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>PHARMABOOK MOBILE</Text>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Good morning, {user?.shop_name || 'PharmaBook'}</Text>

        <View style={styles.roleTag}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Unable to load dashboard</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboard()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatCard label="Revenue today" value={formatCurrency(stats.revenueToday)} hint="From daily sales" />
            <StatCard label="Bills today" value={String(stats.billsToday)} hint="Generated today" />
            <StatCard label="Low stock" value={String(stats.lowStockCount)} hint="Below threshold" />
            <StatCard label="Expiring soon" value={String(stats.expiringCount)} hint="Within 30 days" />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Recent notifications</Text>
                <Text style={styles.sectionSub}>Last 5 important updates</Text>
              </View>
              <Text style={styles.autoRefresh}>60s refresh</Text>
            </View>

            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>No notifications yet.</Text>
            ) : (
              notifications.map((item) => (
                <View key={item.id} style={styles.notificationRow}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconText}>{notificationIcon(item.type)}</Text>
                  </View>

                  <View style={styles.notificationBody}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationMessage}>{item.message}</Text>
                    <Text style={styles.notificationTime}>
                      {new Date(item.ts).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick actions</Text>

            <View style={styles.actionsGrid}>
              <QuickAction title="New Bill" subtitle="Open POS" onPress={() => router.push('/(app)/billing')} />
              <QuickAction title="Inventory" subtitle="Manage stock" onPress={() => router.push('/(app)/inventory')} />
              <QuickAction title="Reports" subtitle="View sales" onPress={() => router.push('/(app)/reports')} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getInventoryMedicineName(item: InventoryItem) {
  const possibleItem = item as InventoryItem & {
    medicine_name?: string;
    name?: string;
    medicine?: {
      name?: string;
    };
  };

  return (
    possibleItem.medicine_name ||
    possibleItem.name ||
    possibleItem.medicine?.name ||
    'Medicine'
  );
}

function getInventoryUpdatedAt(item: InventoryItem) {
  const possibleItem = item as InventoryItem & {
    updated_at?: string;
    created_at?: string;
  };

  return possibleItem.updated_at || possibleItem.created_at || item.expiry_date || new Date().toISOString();
}

function buildNotifications(
  bills: Bill[],
  lowStock: InventoryItem[],
  expiring: InventoryItem[]
): NotificationItem[] {
  const billNotifications = bills.slice(0, 2).map((bill) => ({
    id: `bill-${bill.id}`,
    type: 'sale' as const,
    title: `Bill #${bill.bill_no} created`,
    message: `Sale completed for ${formatCurrency(Number(bill.total || 0))}`,
    ts: bill.created_at,
  }));

  const lowStockNotifications = lowStock.slice(0, 2).map((item) => ({
    id: `low-${item.id}`,
    type: 'stock' as const,
    title: 'Low stock alert',
    message: `${getInventoryMedicineName(item)} has only ${item.qty} left`,
    ts: getInventoryUpdatedAt(item),
  }));

  const expiryNotifications = expiring.slice(0, 2).map((item) => ({
    id: `exp-${item.id}`,
    type: 'expiry' as const,
    title: 'Expiring soon',
    message: `${getInventoryMedicineName(item)} expires on ${new Date(item.expiry_date).toLocaleDateString()}`,
    ts: item.expiry_date,
  }));

  return [...billNotifications, ...lowStockNotifications, ...expiryNotifications]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 5);
}

function notificationIcon(type: NotificationItem['type']) {
  if (type === 'sale') return '₹';
  if (type === 'stock') return '!';
  if (type === 'expiry') return '⏳';
  return 'i';
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function QuickAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function DashboardSkeleton() {
  return (
    <View>
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={styles.skeletonCard}>
            <View style={styles.skeletonLineSmall} />
            <View style={styles.skeletonLineLarge} />
            <View style={styles.skeletonLineSmall} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <ActivityIndicator color={colors.navy} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.greenLight,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.white,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    color: colors.navyLight,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
  },
  roleText: {
    color: colors.navy,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  statHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  autoRefresh: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
  },

  notificationRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.navy,
    fontWeight: fontWeight.bold,
  },
  notificationBody: { flex: 1 },
  notificationTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  notificationMessage: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  notificationTime: {
    color: colors.textLight,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 180,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  actionTitle: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  actionSubtitle: {
    color: colors.navyLight,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  errorBox: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: fontWeight.bold,
  },

  skeletonCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  skeletonLineSmall: {
    width: '60%',
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
  },
  skeletonLineLarge: {
    width: '80%',
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
  },
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  centerPage: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  blockedTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  blockedText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});