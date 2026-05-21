import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  inventoryApi,
  medicinesApi,
  type InventoryItem,
  type Medicine,
} from '../../../src/services/api';
import { colors, fontSize, fontWeight, radius, spacing } from '../../../src/utils/theme';
import LogoutButton from '../../../src/components/LogoutButton';

type FilterKey = 'all' | 'low' | 'expiring';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low Stock' },
  { key: 'expiring', label: 'Expiring' },
];

const toNumber = (value: number | string | undefined | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (date: string) => {
  if (!date) return 'No expiry';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const daysUntil = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  parsed.setHours(0, 0, 0, 0);

  return Math.ceil((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const isLowStock = (item: InventoryItem) => {
  return toNumber(item.qty) <= toNumber(item.low_stock_threshold);
};

const isExpiringSoon = (item: InventoryItem) => {
  const days = daysUntil(item.expiry_date);
  return days >= 0 && days <= 30;
};

export default function InventoryScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineResults, setMedicineResults] = useState<Medicine[]>([]);
  const [medicineSearching, setMedicineSearching] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  const [qty, setQty] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [threshold, setThreshold] = useState('10');
  const [saving, setSaving] = useState(false);

  const visibleItems = useMemo(() => {
    if (filter === 'low') return items.filter(isLowStock);
    if (filter === 'expiring') return items.filter(isExpiringSoon);
    return items;
  }, [filter, items]);

  const loadInventory = async (nextFilter = filter) => {
    try {
      setMessage(null);

      let data: InventoryItem[];

      if (nextFilter === 'low') {
        data = await inventoryApi.lowStock();
      } else if (nextFilter === 'expiring') {
        data = await inventoryApi.expiring(30);
      } else {
        data = await inventoryApi.list();
      }

      setItems(data);
    } catch (err) {
      setItems([]);
      setMessage(err instanceof Error ? err.message : 'Unable to load inventory.');
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadInventory(filter);
      setLoading(false);
    };

    run();
  }, []);

  const changeFilter = async (nextFilter: FilterKey) => {
    setFilter(nextFilter);
    setLoading(true);
    await loadInventory(nextFilter);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadInventory(filter);
    setRefreshing(false);
  };

  const searchMedicines = async () => {
    const q = medicineQuery.trim();

    if (!q) {
      setMedicineResults([]);
      return;
    }

    try {
      setMedicineSearching(true);
      setMessage(null);

      const data = await medicinesApi.search(q);
      setMedicineResults(data);
    } catch (err) {
      setMedicineResults([]);
      setMessage(err instanceof Error ? err.message : 'Unable to search medicines.');
    } finally {
      setMedicineSearching(false);
    }
  };

  const resetAddForm = () => {
    setMedicineQuery('');
    setMedicineResults([]);
    setSelectedMedicine(null);
    setQty('');
    setBatchNo('');
    setExpiryDate('');
    setThreshold('10');
  };

  const addStock = async () => {
    if (!selectedMedicine) {
      setMessage('Search and select a medicine first.');
      return;
    }

    const parsedQty = Math.floor(toNumber(qty));
    const parsedThreshold = Math.floor(toNumber(threshold || 10));

    if (parsedQty <= 0) {
      setMessage('Quantity must be greater than 0.');
      return;
    }

    if (!batchNo.trim()) {
      setMessage('Batch number is required.');
      return;
    }

    if (!expiryDate.trim()) {
      setMessage('Expiry date is required. Use YYYY-MM-DD format.');
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      await inventoryApi.addStock({
        medicine_id: selectedMedicine.id,
        qty: parsedQty,
        batch_no: batchNo.trim(),
        expiry_date: expiryDate.trim(),
        low_stock_threshold: parsedThreshold > 0 ? parsedThreshold : 10,
      });

      resetAddForm();
      setShowAddForm(false);
      await loadInventory(filter);

      const successMessage = 'Stock added successfully.';

      setMessage(successMessage);

      if (Platform.OS !== 'web') {
        Alert.alert('Inventory updated', successMessage);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to add stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>PharmaBook Mobile</Text>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>
              View stock, track low quantity items, and monitor expiring batches.
            </Text>
          </View>

          <View style={styles.logoutBox}>
            <LogoutButton />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.sectionTitle}>Stock List</Text>
              <Text style={styles.mutedText}>
                Showing {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
              </Text>
            </View>

            <Pressable
              onPress={() => setShowAddForm((current) => !current)}
              style={styles.fabButton}
            >
              <Text style={styles.fabText}>{showAddForm ? 'Close' : '+ Add Stock'}</Text>
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((item) => {
              const active = filter === item.key;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => changeFilter(item.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.green} />
              <Text style={styles.mutedText}>Loading inventory...</Text>
            </View>
          ) : visibleItems.length === 0 ? (
            <Text style={styles.emptyText}>No inventory items found.</Text>
          ) : (
            <FlatList
              data={visibleItems}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const low = isLowStock(item);
                const expiring = isExpiringSoon(item);

                return (
                  <View style={styles.inventoryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        Batch {item.batch_no || 'N/A'} • {item.category || 'General'}
                      </Text>
                      <Text style={styles.itemMeta}>Barcode {item.barcode || 'N/A'}</Text>

                      <View style={styles.badgeRow}>
                        <View style={[styles.qtyBadge, low && styles.qtyBadgeDanger]}>
                          <Text style={[styles.qtyBadgeText, low && styles.qtyBadgeDangerText]}>
                            Qty {item.qty}
                          </Text>
                        </View>

                        <View style={[styles.expiryBadge, expiring && styles.expiryBadgeWarning]}>
                          <Text
                            style={[
                              styles.expiryBadgeText,
                              expiring && styles.expiryBadgeWarningText,
                            ]}
                          >
                            Exp {formatDate(item.expiry_date)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {showAddForm ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add Stock</Text>
            <Text style={styles.mutedText}>
              Scanner will be connected during device testing. For now, search medicine and add
              batch details manually.
            </Text>

            <View style={styles.searchBox}>
              <TextInput
                value={medicineQuery}
                onChangeText={setMedicineQuery}
                placeholder="Search medicine name"
                placeholderTextColor={colors.textLight}
                style={styles.input}
                returnKeyType="search"
                onSubmitEditing={searchMedicines}
              />

              <Pressable
                onPress={searchMedicines}
                disabled={medicineSearching}
                style={[styles.primaryButton, medicineSearching && styles.buttonDisabled]}
              >
                {medicineSearching ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Search</Text>
                )}
              </Pressable>
            </View>

            {selectedMedicine ? (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedLabel}>Selected medicine</Text>
                <Text style={styles.selectedName}>{selectedMedicine.name}</Text>
                <Text style={styles.itemMeta}>
                  Barcode {selectedMedicine.barcode || 'N/A'} • GST {selectedMedicine.gst_rate}%
                </Text>
              </View>
            ) : null}

            {medicineResults.length > 0 ? (
              <View style={styles.resultsBox}>
                {medicineResults.map((medicine) => (
                  <Pressable
                    key={medicine.id}
                    onPress={() => {
                      setSelectedMedicine(medicine);
                      setMedicineResults([]);
                      setMedicineQuery(medicine.name);
                    }}
                    style={styles.resultItem}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{medicine.name}</Text>
                      <Text style={styles.itemMeta}>
                        {medicine.category || 'General'} • Barcode {medicine.barcode || 'N/A'}
                      </Text>
                    </View>

                    <Text style={styles.selectText}>Select</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextInput
              value={qty}
              onChangeText={(value) => setQty(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Quantity"
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />

            <TextInput
              value={batchNo}
              onChangeText={setBatchNo}
              placeholder="Batch number"
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />

            <TextInput
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder="Expiry date YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />

            <TextInput
              value={threshold}
              onChangeText={(value) => setThreshold(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Low stock threshold"
              placeholderTextColor={colors.textLight}
              style={styles.input}
            />

            <Pressable
              onPress={addStock}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Submit Stock</Text>
              )}
            </Pressable>

            <Text style={styles.offlineNote}>
              WatermelonDB local-first write, offline sync queue, scan-to-add, and device
              notification testing can be completed in the advanced mobile inventory issue.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  kicker: {
    color: colors.greenLight,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.white,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.navyLight,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  logoutBox: {
    maxWidth: 220,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.lg,
  },
  topRow: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  mutedText: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  fabButton: {
    borderRadius: radius.md,
    backgroundColor: colors.green,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  fabText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  filterRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  filterTextActive: {
    color: colors.green,
  },
  messageBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    padding: spacing.md,
  },
  messageText: {
    color: colors.green,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  loadingBox: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    marginTop: spacing.lg,
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  inventoryRow: {
    paddingVertical: spacing.md,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  itemMeta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  badgeRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  qtyBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.greenLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  qtyBadgeDanger: {
    backgroundColor: colors.dangerLight,
  },
  qtyBadgeText: {
    color: colors.green,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  qtyBadgeDangerText: {
    color: colors.danger,
  },
  expiryBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.navyLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  expiryBadgeWarning: {
    backgroundColor: colors.warningLight,
  },
  expiryBadgeText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  expiryBadgeWarningText: {
    color: colors.warning,
  },
  searchBox: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  selectedBox: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    padding: spacing.md,
  },
  selectedLabel: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectedName: {
    marginTop: spacing.xs,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  resultsBox: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultItem: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  resultName: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  selectText: {
    color: colors.green,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  offlineNote: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});