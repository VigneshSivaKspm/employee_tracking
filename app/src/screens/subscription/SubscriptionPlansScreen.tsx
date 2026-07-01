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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  SubscriptionPlans: undefined;
  PaymentMethod: { planId: string; planName: string; price: number };
  PaymentGateway: { method: 'upi' | 'card' | 'netbanking' | 'wallet'; planName: string; price: number };
  PaymentSuccess: { planName: string; price: number; transactionId: string };
  Main: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SubscriptionPlans'>;

const MONTHLY_PRICES = { basic: 99, premium: 199 };
const YEARLY_PRICES = { basic: 79, premium: 159 };

const BASIC_FEATURES = [
  'Standard support',
  'Basic analytics',
  'Leave management',
];

const PREMIUM_FEATURES = [
  'Standard support',
  'Basic analytics',
  'Leave management',
  'Advanced analytics',
  'Priority support',
  'Export reports',
  'Ad-free experience',
];

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const currentPlan = 'basic'; // mock: user is on basic

  const prices = billing === 'monthly' ? MONTHLY_PRICES : YEARLY_PRICES;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Plan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Billing Toggle */}
        <View style={styles.toggleCard}>
          <TouchableOpacity
            style={[styles.toggleBtn, billing === 'monthly' && styles.toggleBtnActive]}
            onPress={() => setBilling('monthly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, billing === 'monthly' && styles.toggleTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, billing === 'yearly' && styles.toggleBtnActive]}
            onPress={() => setBilling('yearly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, billing === 'yearly' && styles.toggleTextActive]}>
              Yearly (Save 20%)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Basic Plan Card */}
        <View style={styles.planCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.badgeGray}>
              <Text style={styles.badgeGrayText}>Basic</Text>
            </View>
            {currentPlan === 'basic' && (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>₹{prices.basic}</Text>
            <Text style={styles.priceUnit}>/{billing === 'monthly' ? 'month' : 'mo'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureList}>
            {BASIC_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.outlinedBtn} activeOpacity={0.8}>
            <Text style={styles.outlinedBtnText}>Get Started</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Plan Card */}
        <View style={[styles.planCard, styles.premiumCard]}>
          {/* Popular Label */}
          <View style={styles.popularBanner}>
            <Text style={styles.popularBannerText}>MOST POPULAR</Text>
          </View>

          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }} />
            <View style={styles.badgeBlue}>
              <Text style={styles.badgeBlueText}>Premium</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>₹{prices.premium}</Text>
            <Text style={styles.priceUnit}>/{billing === 'monthly' ? 'month' : 'mo'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.filledBtn}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('PaymentMethod', {
                planId: 'premium',
                planName: 'Premium Plan',
                price: prices.premium,
              })
            }
          >
            <Text style={styles.filledBtnText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>

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

  // Toggle
  toggleCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#2563EB',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },

  // Plan cards
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumCard: {
    borderColor: '#2563EB',
    overflow: 'hidden',
  },
  popularBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    alignItems: 'center',
  },
  popularBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 4,
  },
  badgeGray: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeGrayText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeBlue: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeBlueText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  currentPlanBadge: {
    marginLeft: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentPlanText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
  },
  priceUnit: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },

  // Buttons
  outlinedBtn: {
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlinedBtnText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },
  filledBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
