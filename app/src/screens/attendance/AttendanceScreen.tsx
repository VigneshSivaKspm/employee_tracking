import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAttendance } from '../../context/AttendanceContext';

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
    await punchIn();
  }

  async function handlePunchOut() {
    if (contextPunching) return;
    await punchOut();
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
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Blue Gradient Header ── */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Text style={styles.headerTitle}>Attendance</Text>
          <Text style={styles.headerDate}>{formatDateHeader(currentTime)}</Text>
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
                  colors={['#2563EB', '#1D4ED8']}
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  // Main card
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginTop: -60,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  centeredContent: {
    alignItems: 'center',
  },
  // Clock
  clockDisplay: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 1,
    marginTop: 8,
  },
  clockSubLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Location pill
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationPillVerified: {
    backgroundColor: '#DCFCE7',
  },
  locationPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  locationHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  // Punch button
  punchBtnWrapper: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  punchBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  punchBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Active state
  workingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 10,
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
    fontWeight: '600',
  },
  punchedInAtText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  workingTimer: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 2,
  },
  workingTimerLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Clocked out summary
  greatWorkText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  dayCompleteLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  summaryItemLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryItemValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  timelineIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  timelineConnector: {
    position: 'absolute',
    left: 17,
    top: 38,
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 120,
  },
  quickActionCardLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
});
