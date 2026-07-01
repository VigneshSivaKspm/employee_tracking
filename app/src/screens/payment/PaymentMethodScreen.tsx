import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  SubscriptionPlans: undefined;
  PaymentMethod: { planId: string; planName: string; price: number };
  PaymentGateway: { method: 'upi' | 'card' | 'netbanking' | 'wallet'; planName: string; price: number };
  PaymentSuccess: { planName: string; price: number; transactionId: string };
  Main: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentMethod'>;
type RoutePropType = RouteProp<RootStackParamList, 'PaymentMethod'>;

type PaymentMethodId = 'upi' | 'card' | 'netbanking' | 'wallet';

interface PaymentOption {
  id: PaymentMethodId;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  description: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'upi',
    icon: 'qr-code-outline',
    iconBg: '#EFF6FF',
    label: 'UPI',
    description: 'Pay using any UPI app',
  },
  {
    id: 'card',
    icon: 'card-outline',
    iconBg: '#F5F3FF',
    label: 'Credit / Debit Card',
    description: 'Visa, Mastercard, Rupay',
  },
  {
    id: 'netbanking',
    icon: 'business-outline',
    iconBg: '#F0FDF4',
    label: 'Net Banking',
    description: 'All major banks',
  },
  {
    id: 'wallet',
    icon: 'wallet-outline',
    iconBg: '#FFF7ED',
    label: 'Wallets',
    description: 'Paytm, PhonePe, etc.',
  },
];

const ICON_COLORS: Record<PaymentMethodId, string> = {
  upi: '#2563EB',
  card: '#7C3AED',
  netbanking: '#16A34A',
  wallet: '#D97706',
};

export default function PaymentMethodScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { planName, price } = route.params;

  const [selected, setSelected] = useState<PaymentMethodId>('upi');

  const handleContinue = () => {
    navigation.navigate('PaymentGateway', {
      method: selected,
      planName,
      price,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Method</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Amount Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{planName}</Text>
            <Text style={styles.summaryPrice}>₹{price}/month</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{price}.00</Text>
          </View>
        </View>

        {/* Payment Method Section */}
        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        <View style={styles.methodsCard}>
          {PAYMENT_OPTIONS.map((option, index) => (
            <React.Fragment key={option.id}>
              <TouchableOpacity
                style={styles.methodRow}
                onPress={() => setSelected(option.id)}
                activeOpacity={0.7}
              >
                {/* Radio */}
                <View style={[styles.radio, selected === option.id && styles.radioSelected]}>
                  {selected === option.id && <View style={styles.radioDot} />}
                </View>

                {/* Icon */}
                <View style={[styles.iconCircle, { backgroundColor: option.iconBg }]}>
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={ICON_COLORS[option.id]}
                  />
                </View>

                {/* Labels */}
                <View style={styles.methodInfo}>
                  <Text style={styles.methodLabel}>{option.label}</Text>
                  <Text style={styles.methodDesc}>{option.description}</Text>
                </View>

                {/* Chevron */}
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {index < PAYMENT_OPTIONS.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  header: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: { width: 36 },
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  summaryPrice: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 17,
    color: '#1E293B',
    fontWeight: '800',
  },

  // Methods
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  methodsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: 72,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#2563EB',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  methodDesc: {
    fontSize: 13,
    color: '#64748B',
  },

  // Footer
  footer: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
  },
  continueBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
