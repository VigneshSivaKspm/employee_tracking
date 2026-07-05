import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTopInset } from '../../hooks/useBottomSpacing';
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentSuccess'>;
type RoutePropType = RouteProp<RootStackParamList, 'PaymentSuccess'>;

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}

function DetailRow({ label, value, last }: DetailRowProps) {
  return (
    <>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <View style={styles.detailValueContainer}>{typeof value === 'string' ? <Text style={styles.detailValue}>{value}</Text> : value}</View>
      </View>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { planName, price, transactionId } = route.params;
  const topInset = useTopInset(16);

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Checkmark Circle */}
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark-circle" size={60} color="#16A34A" />
        </View>

        {/* Success Text */}
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <Text style={styles.successSubTitle}>
          Your payment has been completed successfully.
        </Text>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <DetailRow
            label="Plan Name"
            value={<Text style={styles.planNameValue}>{planName}</Text>}
          />
          <DetailRow
            label="Amount"
            value={<Text style={styles.amountValue}>₹{price}.00</Text>}
          />
          <DetailRow
            label="Transaction ID"
            value={<Text style={styles.txnId}>{transactionId}</Text>}
          />
          <DetailRow
            label="Date"
            value={formatDate(new Date())}
          />
          <DetailRow
            label="Status"
            value={
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Success</Text>
              </View>
            }
            last
          />
        </View>

        {/* Back to Home Button */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={handleBackToHome}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },

  // Checkmark
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DCFCE7',
    borderWidth: 3,
    borderColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Titles
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 24,
    textAlign: 'center',
  },
  successSubTitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  detailValueContainer: {
    flex: 1.5,
    alignItems: 'flex-end',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    textAlign: 'right',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  // Specific value styles
  planNameValue: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 15,
    color: '#16A34A',
    fontWeight: '800',
    textAlign: 'right',
  },
  txnId: {
    fontSize: 12,
    color: '#1E293B',
    fontFamily: 'monospace',
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusPillText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
  },

  // Button
  homeBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  homeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
