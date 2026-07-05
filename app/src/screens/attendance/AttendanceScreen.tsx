import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAttendance } from '../../context/AttendanceContext';
import { useStackScreenBottomPadding } from '../../hooks/useBottomSpacing';

type RootStackParamList = {
  Main: undefined;
  ApplyLeave: undefined;
  AttendanceHistory: undefined;
  Notifications: undefined;
  AnnouncementDetail: { announcementId: string };
  LeaveHistory: undefined;
  SubscriptionPlans: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime12(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${padTwo(h)}:${padTwo(m)}:${padTwo(s)} ${ampm}`;
}

function formatTime12Short(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${padTwo(h)}:${padTwo(m)} ${ampm}`;
}

function formatElapsed(seconds: number): string {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${padTwo(hh)}:${padTwo(mm)}:${padTwo(ss)}`;
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useStackScreenBottomPadding();
  const navigation = useNavigation<NavigationProp>();
  const { status, todayRecord, workingSeconds, isPunching: contextPunching, punchIn, punchOut, isWithinOffice: contextWithinOffice } = useAttendance();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLocating, setIsLocating] = useState(false);
  const [isWithinOffice, setIsWithinOffice] = useState(true);
  const [locationVerified, setLocationVerified] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate location check on mount
  useEffect(() => {
    setIsLocating(true);
    const t = setTimeout(() => {
      setIsLocating(false);
      setLocationVerified(true);
      setIsWithinOffice(true);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Pulse animation for "Currently Working" indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const isClockedIn = status === 'active';
  const isClockedOut = status === 'clocked_out';

  async function handlePunchIn() {
    if (contextPunching) return;
    try {
      await punchIn();
    } catch (err: any) {
      Alert.alert('Punch In Failed', err?.message || 'Could not record punch in. Please try again.');
    }
  }

  async function handlePunchOut() {
    if (contextPunching) return;
    try {
      await punchOut();
    } catch (err: any) {
      Alert.alert('Punch Out Failed', err?.message || 'Could not record punch out. Please try again.');
    }
  }

  // Today's timeline events
  const todayEvents: { time: string; label: string; icon: string; color: string }[] = [];
  if (todayRecord?.clockIn) {
    todayEvents.push({
      time: todayRecord.clockIn,
      label: 'Punched In',
      icon: 'log-in-outline',
      color: '#16A34A',
    });
  }
  if (todayRecord?.clockOut) {
    todayEvents.push({
      time: todayRecord.clockOut,
      label: 'Punched Out',
      icon: 'log-out-outline',
      color: '#DC2626',
    });
  }

  const LocationPill = () => {
    if (isLocating) {
      return (
        <View style={styles.locationPill}>
          <Ionicons name="location-outline" size={13} color="#64748B" />
          <Text style={styles.locationPillText}>Locating...</Text>
        </View>
      );
    }
    return (
      <View style={[styles.locationPill, styles.locationPillVerified]}>
        <Ionicons name="location-outline" size={13} color="#16A34A" />
        <Text style={[styles.locationPillText, { color: '#16A34A' }]}>
          Location Verified ✓
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerDate}>{formatDateHeader(currentTime)}</Text>
              <Text style={styles.headerTitle}>Attendance</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.notifBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Main Card ── */}
        <View style={styles.mainCard}>
          {!isClockedIn && !isClockedOut && (
            /* ── NOT CLOCKED IN ── */
            <View style={styles.centeredContent}>
              {/* Live Clock */}
              <Text style={styles.clockDisplay}>{formatTime12(currentTime)}</Text>
              <Text style={styles.clockSubLabel}>Current Time</Text>

              <View style={{ height: 20 }} />

              {/* Location pill */}
              <LocationPill />

              <Text style={styles.locationHint}>
                {locationVerified
                  ? isWithinOffice
                    ? 'You are in the office location'
                    : 'You are in remote location'
                  : 'Checking your location...'}
              </Text>

              <View style={{ height: 28 }} />

              {/* PUNCH IN button */}
              <TouchableOpacity
                style={styles.punchBtnWrapper}
                onPress={handlePunchIn}
                disabled={contextPunching}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#2563EB', '#1E40AF']}
                  style={styles.punchBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {contextPunching ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                      <Text style={styles.punchBtnText}>PUNCH IN</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {isClockedIn && (
            /* ── ACTIVE / CLOCKED IN ── */
            <View style={styles.centeredContent}>
              {/* Currently Working pill */}
              <View style={styles.workingPill}>
                <Animated.View
                  style={[styles.workingDot, { transform: [{ scale: pulseAnim }] }]}
                />
                <Text style={styles.workingPillText}>Currently Working</Text>
              </View>

              <Text style={styles.punchedInAtText}>
                Punched in at {todayRecord?.clockIn ?? '--:--'}
              </Text>

              {/* Live working timer */}
              <Text style={styles.workingTimer}>{formatElapsed(workingSeconds)}</Text>
              <Text style={styles.workingTimerLabel}>Working Time</Text>

              <View style={{ height: 20 }} />

              <LocationPill />

              <Text style={styles.locationHint}>
                {isWithinOffice ? 'You are in the office location' : 'You are in remote location'}
              </Text>

              <View style={{ height: 28 }} />

              {/* PUNCH OUT button */}
              <TouchableOpacity
                style={styles.punchBtnWrapper}
                onPress={handlePunchOut}
                disabled={contextPunching}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#DC2626', '#B91C1C']}
                  style={styles.punchBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {contextPunching ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                      <Text style={styles.punchBtnText}>PUNCH OUT</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {isClockedOut && (
            /* ── CLOCKED OUT / SUMMARY ── */
            <View style={styles.centeredContent}>
              <Text style={styles.greatWorkText}>Great work today! 🎉</Text>
              <Text style={styles.dayCompleteLabel}>Your shift is complete</Text>
              <View style={{ height: 24 }} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Ionicons name="log-in-outline" size={20} color="#16A34A" />
                  <Text style={styles.summaryItemLabel}>Punch In</Text>
                  <Text style={styles.summaryItemValue}>{todayRecord?.clockIn ?? '--:--'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                  <Text style={styles.summaryItemLabel}>Punch Out</Text>
                  <Text style={styles.summaryItemValue}>{todayRecord?.clockOut ?? '--:--'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="time-outline" size={20} color="#2563EB" />
                  <Text style={styles.summaryItemLabel}>Total Hours</Text>
                  <Text style={styles.summaryItemValue}>
                    {todayRecord?.totalHours ? `${todayRecord.totalHours.toFixed(1)}h` : '0h'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Today's Timeline ── */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Today's Timeline</Text>
          {todayEvents.length === 0 ? (
            <Text style={styles.emptyText}>No punches yet for today.</Text>
          ) : (
            todayEvents.map((event, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View style={[styles.timelineIconCircle, { backgroundColor: event.color + '20' }]}>
                  <Ionicons name={event.icon as any} size={16} color={event.color} />
                </View>
                {idx < todayEvents.length - 1 && <View style={styles.timelineConnector} />}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>{event.label}</Text>
                  <Text style={styles.timelineTime}>{event.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Quick Actions Row ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsRow}
        >
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('AttendanceHistory')}
          >
            <Ionicons name="calendar-outline" size={22} color="#2563EB" />
            <Text style={styles.quickActionCardLabel}>Attendance History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('ApplyLeave')}
          >
            <Ionicons name="document-text-outline" size={22} color="#16A34A" />
            <Text style={styles.quickActionCardLabel}>Apply Leave</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#D97706" />
            <Text style={styles.quickActionCardLabel}>Notifications</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerDecor2: {
    position: 'absolute',
    bottom: 10,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Main card
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginTop: -60,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  centeredContent: {
    alignItems: 'center',
  },

  // Clock
  clockDisplay: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
    marginTop: 8,
  },
  clockSubLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Location pill
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationPillVerified: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  locationPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  locationHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Punch button
  punchBtnWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  punchBtn: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  punchBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  // Active state
  workingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  workingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  workingPillText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '700',
  },
  punchedInAtText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    fontWeight: '500',
  },
  workingTimer: {
    fontSize: 46,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 2,
  },
  workingTimerLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Clocked out summary
  greatWorkText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  dayCompleteLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  summaryItemLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryItemValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },

  // Timeline
  timelineCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '500',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  timelineIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  timelineConnector: {
    position: 'absolute',
    left: 18,
    top: 40,
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  // Quick actions row
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickActionCardLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
  },
});
