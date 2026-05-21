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
import { useUser } from '../../../src/store/auth.store';
import {
  reportsApi,
  type DailyReport,
  type TopMedicineReport,
} from '../../../src/services/api';
import { colors, spacing, fontSize, fontWeight, radius } from '../../../src/utils/theme';

type Period = 'today' | 'week' | 'month';

type ReportSummary = {
  revenue: number;
  billCount: number;
  gstCollected: number;
  avgBillValue: number;
};

type ChartPoint = {
  label: string;
  revenue: number;
  bills: number;
};

type GstRow = {
  rate: string;
  taxable: number;
  cgst: number;
  sgst: number;
  totalGst: number;
};

const formatCurrency = (value: number | string | undefined | null) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

const toNumber = (value: number | string | undefined | null) => Number(value ?? 0);

const todayIso = () => new Date().toISOString().slice(0, 10);

const getMonthParams = () => {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  return monday.toISOString().slice(0, 10);
};

export default function ReportsScreen() {
  const user = useUser();

  const [period, setPeriod] = useState<Period>('today');
  const [summary, setSummary] = useState<ReportSummary>({
    revenue: 0,
    billCount: 0,
    gstCollected: 0,
    avgBillValue: 0,
  });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [topMedicines, setTopMedicines] = useState<TopMedicineReport['medicines']>([]);
  const [gstRows, setGstRows] = useState<GstRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.role === 'owner';

  const loadReports = useCallback(
    async (showPullRefresh = false) => {
      try {
        if (showPullRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const monthParams = getMonthParams();

        const [report, top, gst] = await Promise.all([
          getReportByPeriod(period),
          reportsApi.topMedicines(period, 5),
          reportsApi.gstSummary(monthParams.year, monthParams.month),
        ]);

        setSummary(normalizeSummary(report));
        setChartData(normalizeChart(period, report));
        setTopMedicines(Array.isArray(top?.medicines) ? top.medicines : []);
        setGstRows(normalizeGstRows(gst));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadReports();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadReports]);

  const maxRevenue = useMemo(
    () => Math.max(...chartData.map((item) => item.revenue), 1),
    [chartData]
  );

  if (!isOwner) {
    return (
      <View style={styles.centerPage}>
        <Text style={styles.blockedTitle}>Owner reports</Text>
        <Text style={styles.blockedText}>
          Reports are available only for owner accounts.
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
          onRefresh={() => loadReports(true)}
          tintColor={colors.navy}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>SALES ANALYTICS</Text>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>
          Track revenue, GST, and top-selling medicines.
        </Text>
      </View>

      <View style={styles.periodTabs}>
        <PeriodButton label="Today" active={period === 'today'} onPress={() => setPeriod('today')} />
        <PeriodButton label="Week" active={period === 'week'} onPress={() => setPeriod('week')} />
        <PeriodButton label="Month" active={period === 'month'} onPress={() => setPeriod('month')} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Unable to load reports</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadReports()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.navy} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatCard label="Revenue" value={formatCurrency(summary.revenue)} />
            <StatCard label="Bills" value={String(summary.billCount)} />
            <StatCard label="GST collected" value={formatCurrency(summary.gstCollected)} />
            <StatCard label="Avg bill" value={formatCurrency(summary.avgBillValue)} />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Revenue chart</Text>
                <Text style={styles.sectionSub}>{periodLabel(period)} sales trend</Text>
              </View>
            </View>

            {chartData.length === 0 ? (
              <Text style={styles.emptyText}>No chart data available.</Text>
            ) : (
              <View style={styles.chartWrap}>
                {chartData.map((item) => {
                  const height = Math.max((item.revenue / maxRevenue) * 140, 8);

                  return (
                    <View key={item.label} style={styles.barItem}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height }]} />
                      </View>
                      <Text style={styles.barLabel}>{item.label}</Text>
                      <Text style={styles.barValue}>{formatCurrency(item.revenue)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top medicines</Text>
            <Text style={styles.sectionSub}>Best sellers for selected period</Text>

            {topMedicines.length === 0 ? (
              <Text style={styles.emptyText}>No top medicines yet.</Text>
            ) : (
              topMedicines.map((item, index) => (
                <View key={item.id} style={styles.medicineRow}>
                  <View style={styles.rankCircle}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>

                  <View style={styles.medicineBody}>
                    <Text style={styles.medicineName}>{item.name}</Text>
                    <Text style={styles.medicineMeta}>
                      {item.units_sold} units sold • {item.category}
                    </Text>
                  </View>

                  <Text style={styles.medicineRevenue}>{formatCurrency(item.revenue)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>GST summary</Text>
                <Text style={styles.sectionSub}>Breakdown by GST rate</Text>
              </View>

              <TouchableOpacity style={styles.csvButton} onPress={() => showCsvPreview(gstRows)}>
                <Text style={styles.csvButtonText}>CSV</Text>
              </TouchableOpacity>
            </View>

            {gstRows.length === 0 ? (
              <Text style={styles.emptyText}>No GST data available.</Text>
            ) : (
              gstRows.map((row) => (
                <View key={row.rate} style={styles.gstRow}>
                  <View>
                    <Text style={styles.gstRate}>{row.rate}</Text>
                    <Text style={styles.gstMeta}>Taxable {formatCurrency(row.taxable)}</Text>
                  </View>

                  <View style={styles.gstAmounts}>
                    <Text style={styles.gstAmount}>CGST {formatCurrency(row.cgst)}</Text>
                    <Text style={styles.gstAmount}>SGST {formatCurrency(row.sgst)}</Text>
                    <Text style={styles.gstTotal}>Total {formatCurrency(row.totalGst)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

async function getReportByPeriod(period: Period) {
  if (period === 'today') {
    return reportsApi.daily(todayIso());
  }

  if (period === 'week') {
    return reportsApi.weekly(getWeekStart());
  }

  const { year, month } = getMonthParams();
  return reportsApi.monthly(year, month);
}

function normalizeSummary(report: any): ReportSummary {
  const summary = report?.summary ?? report ?? {};

  const revenue =
    summary.revenue ??
    summary.total_revenue ??
    summary.total_sales ??
    summary.sales ??
    0;

  const billCount =
    summary.bill_count ??
    summary.bills ??
    summary.total_bills ??
    summary.billCount ??
    0;

  const gstCollected =
    summary.gst_collected ??
    summary.gst_amount ??
    summary.total_gst ??
    0;

  const avgBillValue =
    summary.avg_bill_value ??
    summary.average_bill_value ??
    (Number(billCount) > 0 ? Number(revenue) / Number(billCount) : 0);

  return {
    revenue: toNumber(revenue),
    billCount: toNumber(billCount),
    gstCollected: toNumber(gstCollected),
    avgBillValue: toNumber(avgBillValue),
  };
}

function normalizeChart(period: Period, report: any): ChartPoint[] {
  if (period === 'today') {
    const daily = report as DailyReport;

    if (Array.isArray(daily?.hourly)) {
      return daily.hourly.map((item) => ({
        label: `${String(item.hour).padStart(2, '0')}`,
        revenue: toNumber(item.revenue),
        bills: Number(item.bills || 0),
      }));
    }
  }

  const possibleSeries =
    report?.daily ??
    report?.days ??
    report?.weekly ??
    report?.months ??
    report?.series ??
    report?.chart ??
    [];

  if (Array.isArray(possibleSeries)) {
    return possibleSeries.map((item: any, index: number) => ({
      label:
        item.label ||
        item.date?.slice(5) ||
        item.day ||
        item.month ||
        String(index + 1),
      revenue: toNumber(item.revenue ?? item.total_revenue ?? item.sales),
      bills: Number(item.bills ?? item.bill_count ?? item.total_bills ?? 0),
    }));
  }

  return [];
}

function normalizeGstRows(gst: any): GstRow[] {
  const rows = gst?.rows ?? gst?.summary ?? gst?.rates ?? gst?.data ?? gst ?? [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((item: any) => {
    const rate = item.rate ?? item.gst_rate ?? item.tax_rate ?? 'GST';
    const totalGst = toNumber(item.total_gst ?? item.gst_amount ?? item.gst ?? 0);
    const cgst = toNumber(item.cgst ?? totalGst / 2);
    const sgst = toNumber(item.sgst ?? totalGst / 2);

    return {
      rate: `${rate}%`,
      taxable: toNumber(item.taxable ?? item.taxable_amount ?? item.subtotal ?? 0),
      cgst,
      sgst,
      totalGst: toNumber(item.total_gst ?? cgst + sgst),
    };
  });
}

function showCsvPreview(rows: GstRow[]) {
  const csv = [
    'Rate,Taxable,CGST,SGST,Total GST',
    ...rows.map((row) =>
      [row.rate, row.taxable, row.cgst, row.sgst, row.totalGst].join(',')
    ),
  ].join('\n');

  console.log('GST CSV\n', csv);
}

function periodLabel(period: Period) {
  if (period === 'today') return 'Today';
  if (period === 'week') return 'This week';
  return 'This month';
}

function PeriodButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.periodButton, active && styles.periodButtonActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.periodButtonText, active && styles.periodButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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

  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  periodButton: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.navy,
  },
  periodButtonText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  periodButtonTextActive: {
    color: colors.white,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
  },

  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    minHeight: 190,
    paddingTop: spacing.lg,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    height: 150,
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.navy,
    borderRadius: radius.full,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  barValue: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: fontWeight.bold,
  },

  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: colors.navy,
    fontWeight: fontWeight.bold,
  },
  medicineBody: {
    flex: 1,
  },
  medicineName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  medicineMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  medicineRevenue: {
    color: colors.green,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  gstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gstRate: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  gstMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  gstAmounts: {
    alignItems: 'flex-end',
  },
  gstAmount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  gstTotal: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },

  csvButton: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  csvButtonText: {
    color: colors.navy,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  loadingCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.md,
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