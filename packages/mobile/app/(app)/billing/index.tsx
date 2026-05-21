import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { billsApi, medicinesApi, type Medicine } from '../../../src/services/api';
import { colors, fontSize, fontWeight, radius, spacing } from '../../../src/utils/theme';
import LogoutButton from '../../../src/components/LogoutButton';

type CartItem = {
  medicine: Medicine;
  qty: number;
};

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

const toNumber = (value: number | string | undefined | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMedicinePrice = (medicine: Medicine) => toNumber(medicine.mrp);
const getMedicineGstRate = (medicine: Medicine) => toNumber(medicine.gst_rate);

export default function BillingScreen() {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Medicine[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => {
      return sum + getMedicinePrice(item.medicine) * item.qty;
    }, 0);

    const gstAmount = cart.reduce((sum, item) => {
      const lineBase = getMedicinePrice(item.medicine) * item.qty;
      return sum + (lineBase * getMedicineGstRate(item.medicine)) / 100;
    }, 0);

    const discountAmount = Math.min(Math.max(toNumber(discount), 0), subtotal + gstAmount);
    const total = Math.max(subtotal + gstAmount - discountAmount, 0);

    return {
      subtotal,
      gstAmount,
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      discountAmount,
      total,
    };
  }, [cart, discount]);

  const searchMedicines = async () => {
    const q = search.trim();

    if (!q) {
      setResults([]);
      return;
    }

    try {
      setSearching(true);
      setMessage(null);

      const data = await medicinesApi.search(q);
      setResults(data);
    } catch (err) {
      setResults([]);
      setMessage(err instanceof Error ? err.message : 'Unable to search medicines.');
    } finally {
      setSearching(false);
    }
  };

  const addToCart = (medicine: Medicine) => {
    setCart((current) => {
      const existing = current.find((item) => item.medicine.id === medicine.id);

      if (existing) {
        return current.map((item) =>
          item.medicine.id === medicine.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...current, { medicine, qty: 1 }];
    });

    setMessage(`${medicine.name} added to cart.`);
  };

  const updateQty = (medicineId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.medicine.id === medicineId
            ? { ...item, qty: Math.max(item.qty + delta, 0) }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('0');
    setMessage(null);
  };

  const checkout = async () => {
    if (cart.length === 0) {
      setMessage('Add at least one medicine before checkout.');
      return;
    }

    try {
      setCheckingOut(true);
      setMessage(null);

      const bill = await billsApi.create({
        discount: totals.discountAmount,
        client_local_id: `mobile-${Date.now()}`,
        items: cart.map((item) => ({
          medicine_id: item.medicine.id,
          qty: item.qty,
          unit_price: getMedicinePrice(item.medicine),
          gst_rate: getMedicineGstRate(item.medicine),
        })),
      });

      clearCart();

      const successMessage = `Bill #${bill.bill_no} created successfully. Total ${formatCurrency(
        toNumber(bill.total)
      )}`;

      setMessage(successMessage);

      if (Platform.OS !== 'web') {
        Alert.alert('Checkout successful', successMessage);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>PharmaBook Mobile</Text>
            <Text style={styles.title}>Billing / POS</Text>
            <Text style={styles.subtitle}>
              Search medicines, add items to cart, apply discount, and checkout.
            </Text>
          </View>

          <View style={styles.logoutBox}>
            <LogoutButton />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Barcode Scanner</Text>
          <Text style={styles.mutedText}>
            Camera scanner is reserved for Android device testing. Use medicine search on laptop web.
          </Text>

          <Pressable style={styles.disabledButton} disabled>
            <Text style={styles.disabledButtonText}>Scanner placeholder</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Medicine Search</Text>

          <View style={styles.searchRow}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by medicine name"
              placeholderTextColor={colors.textLight}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={searchMedicines}
            />

            <Pressable
              onPress={searchMedicines}
              disabled={searching}
              style={[styles.primaryButton, searching && styles.buttonDisabled]}
            >
              {searching ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Search</Text>
              )}
            </Pressable>
          </View>

          {results.length > 0 ? (
            <View style={styles.resultsBox}>
              {results.map((medicine) => (
                <Pressable
                  key={medicine.id}
                  onPress={() => addToCart(medicine)}
                  style={styles.resultItem}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{medicine.name}</Text>
                    <Text style={styles.resultMeta}>
                      {medicine.category || 'General'} • GST {getMedicineGstRate(medicine)}%
                    </Text>
                  </View>

                  <Text style={styles.resultPrice}>{formatCurrency(getMedicinePrice(medicine))}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Search results will appear here.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cartHeader}>
            <Text style={styles.sectionTitle}>Cart</Text>

            {cart.length > 0 ? (
              <Pressable onPress={clearCart}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {cart.length === 0 ? (
            <Text style={styles.emptyText}>No medicines added yet.</Text>
          ) : (
            <FlatList
              data={cart}
              keyExtractor={(item) => item.medicine.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const price = getMedicinePrice(item.medicine);
                const lineTotal = price * item.qty;

                return (
                  <View style={styles.cartItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartName}>{item.medicine.name}</Text>
                      <Text style={styles.resultMeta}>
                        {formatCurrency(price)} × {item.qty} • GST{' '}
                        {getMedicineGstRate(item.medicine)}%
                      </Text>
                      <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text>
                    </View>

                    <View style={styles.qtyControls}>
                      <Pressable
                        onPress={() => updateQty(item.medicine.id, -1)}
                        style={styles.qtyButton}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </Pressable>

                      <Text style={styles.qtyText}>{item.qty}</Text>

                      <Pressable
                        onPress={() => updateQty(item.medicine.id, 1)}
                        style={styles.qtyButton}
                      >
                        <Text style={styles.qtyButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>CGST</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.cgst)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>SGST</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.sgst)}</Text>
          </View>

          <View style={styles.discountBox}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <TextInput
              value={discount}
              onChangeText={(value) => setDiscount(value.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.discountInput}
            />
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.total)}</Text>
          </View>

          {message ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={checkout}
            disabled={checkingOut || cart.length === 0}
            style={[
              styles.checkoutButton,
              (checkingOut || cart.length === 0) && styles.buttonDisabled,
            ]}
          >
            {checkingOut ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            )}
          </Pressable>

          <Text style={styles.offlineNote}>
            Offline WatermelonDB write, SYNC_PUSH queue, PRINT_JOB queue, and real barcode scanning
            will be connected during offline sync / hardware testing.
          </Text>
        </View>
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
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  mutedText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  disabledButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.navyLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  disabledButtonText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: fontWeight.bold,
  },
  searchRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
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
  resultMeta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  resultPrice: {
    color: colors.green,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cartItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  cartName: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  lineTotal: {
    marginTop: spacing.xs,
    color: colors.green,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  qtyText: {
    minWidth: 22,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  summaryRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  discountBox: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  discountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    backgroundColor: colors.surface,
  },
  totalRow: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  totalValue: {
    color: colors.green,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
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
  checkoutButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  offlineNote: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});