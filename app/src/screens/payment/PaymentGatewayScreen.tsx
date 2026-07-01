import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentGateway'>;
type RoutePropType = RouteProp<RootStackParamList, 'PaymentGateway'>;

const TITLE_MAP: Record<string, string> = {
  upi: 'UPI Payment',
  card: 'Card Payment',
  netbanking: 'Net Banking',
  wallet: 'Wallet Payment',
};

const BANKS = [
  { id: 'sbi', name: 'State Bank of India', code: 'SBI' },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK' },
];

export default function PaymentGatewayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { method, planName, price } = route.params;

  // UPI state
  const [upiId, setUpiId] = useState('98765432100@paytm');

  // Card state
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // Net Banking state
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const handlePay = () => {
    navigation.navigate('PaymentSuccess', {
      planName,
      price,
      transactionId: 'TXN' + Date.now(),
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 4);
    if (cleaned.length >= 3) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2);
    }
    return cleaned;
  };

  const renderUPI = () => (
    <View style={styles.paymentContent}>
      {/* QR Code Placeholder */}
      <View style={styles.qrContainer}>
        <View style={styles.qrBox}>
          <Ionicons name="qr-code" size={120} color="#2563EB" />
        </View>
        <Text style={styles.scanText}>Scan & Pay</Text>
        <Text style={styles.scanSubText}>Open any UPI app and scan to pay</Text>
      </View>

      {/* OR Divider */}
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.orLine} />
      </View>

      {/* UPI ID Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>UPI ID</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="yourname@upi"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => Alert.alert('Copied', 'UPI ID copied to clipboard')}
          >
            <Ionicons name="copy-outline" size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount Row */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>₹{price}.00</Text>
      </View>
    </View>
  );

  const renderCard = () => (
    <View style={styles.paymentContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Card Number</Text>
        <TextInput
          style={styles.textInput}
          value={cardNumber}
          onChangeText={(t) => setCardNumber(formatCardNumber(t))}
          placeholder="XXXX XXXX XXXX XXXX"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          maxLength={19}
        />
      </View>

      <View style={styles.rowInputs}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Expiry</Text>
          <TextInput
            style={styles.textInput}
            value={expiry}
            onChangeText={(t) => setExpiry(formatExpiry(t))}
            placeholder="MM/YY"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>CVV</Text>
          <TextInput
            style={styles.textInput}
            value={cvv}
            onChangeText={setCvv}
            placeholder="• • •"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            maxLength={3}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Card Holder Name</Text>
        <TextInput
          style={styles.textInput}
          value={cardHolder}
          onChangeText={setCardHolder}
          placeholder="Name on card"
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>₹{price}.00</Text>
      </View>
    </View>
  );

  const renderNetBanking = () => (
    <View style={styles.paymentContent}>
      <Text style={styles.bankSectionTitle}>Select Your Bank</Text>
      {BANKS.map((bank, index) => (
        <React.Fragment key={bank.id}>
          <TouchableOpacity
            style={styles.bankRow}
            onPress={() => setSelectedBank(bank.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, selectedBank === bank.id && styles.radioSelected]}>
              {selectedBank === bank.id && <View style={styles.radioDot} />}
            </View>
            <View style={styles.bankInfo}>
              <Text style={styles.bankCode}>{bank.code}</Text>
              <Text style={styles.bankName}>{bank.name}</Text>
            </View>
          </TouchableOpacity>
          {index < BANKS.length - 1 && <View style={styles.bankDivider} />}
        </React.Fragment>
      ))}

      <View style={[styles.amountRow, { marginTop: 16 }]}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>₹{price}.00</Text>
      </View>
    </View>
  );

  const renderWallet = () => (
    <View style={styles.paymentContent}>
      <View style={styles.walletInfo}>
        <Ionicons name="wallet-outline" size={48} color="#D97706" />
        <Text style={styles.walletTitle}>Wallet Payment</Text>
        <Text style={styles.walletSubTitle}>You will be redirected to your wallet app to complete the payment.</Text>
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>₹{price}.00</Text>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (method) {
      case 'upi': return renderUPI();
      case 'card': return renderCard();
      case 'netbanking': return renderNetBanking();
      case 'wallet': return renderWallet();
      default: return renderUPI();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Your Payment</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Payment Card */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentCardTitle}>{TITLE_MAP[method] ?? 'Payment'}</Text>
          <View style={styles.cardDivider} />
          {renderContent()}
        </View>

        {/* Pay Button */}
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} activeOpacity={0.85}>
          <Text style={styles.payBtnText}>Pay ₹{price}.00</Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel Payment</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
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

  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  paymentCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  paymentContent: {
    gap: 16,
  },

  // UPI
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  qrBox: {
    width: 200,
    height: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  scanSubText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingRight: 12,
  },
  copyBtn: {
    padding: 4,
  },

  // Inputs
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  rowInputs: {
    flexDirection: 'row',
  },

  // Amount
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },

  // Net Banking
  bankSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  bankDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  bankInfo: {
    flex: 1,
  },
  bankCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  bankName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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

  // Wallet
  walletInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  walletSubTitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Buttons
  payBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 14,
    marginHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
