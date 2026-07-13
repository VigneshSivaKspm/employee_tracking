import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenBottomPadding, useTopInset } from '../../hooks/useBottomSpacing';
import {
  getDeviceCallLogs,
  hasCallLogPermission,
  requestCallLogPermission,
  syncCallLogs,
  type CallLogEntry,
} from '../../services/CallLogService';
import {
  loadDeviceContacts,
  hasContactsPermission,
  requestContactsPermission,
  searchContacts,
  type AppContact,
} from '../../services/ContactsService';
import {
  placeCall,
  formatPhoneForDisplay,
  sanitizeDialInput,
  hasCallPhonePermission,
  requestCallPhonePermission,
} from '../../services/DialerService';
import { loadEmployeeDirectory, type EmployeeDirectoryEntry } from '../../services/ChatService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'keypad' | 'recents' | 'contacts' | 'directory';

const KEYPAD_ROWS: { digit: string; sub: string }[][] = [
  [{ digit: '1', sub: '' }, { digit: '2', sub: 'ABC' }, { digit: '3', sub: 'DEF' }],
  [{ digit: '4', sub: 'GHI' }, { digit: '5', sub: 'JKL' }, { digit: '6', sub: 'MNO' }],
  [{ digit: '7', sub: 'PQRS' }, { digit: '8', sub: 'TUV' }, { digit: '9', sub: 'WXYZ' }],
  [{ digit: '*', sub: '' }, { digit: '0', sub: '+' }, { digit: '#', sub: '' }],
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const CALL_TYPE_ICON: Record<CallLogEntry['type'], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  incoming: { icon: 'arrow-down-circle', color: '#16A34A' },
  outgoing: { icon: 'arrow-up-circle', color: '#2563EB' },
  missed: { icon: 'close-circle', color: '#DC2626' },
};

export default function DialerScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useTabScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('keypad');
  const [dialInput, setDialInput] = useState('');

  const [recents, setRecents] = useState<CallLogEntry[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [recentsPermission, setRecentsPermission] = useState<boolean | null>(null);
  const [recentsError, setRecentsError] = useState<string | null>(null);

  const [callPhoneGranted, setCallPhoneGranted] = useState<boolean | null>(null);

  const [contacts, setContacts] = useState<AppContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<boolean | null>(null);
  const [contactSearch, setContactSearch] = useState('');

  const [directory, setDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');

  const loadRecents = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setRecentsPermission(false);
      return;
    }
    setRecentsLoading(true);
    setRecentsError(null);
    try {
      const granted = await hasCallLogPermission();
      setRecentsPermission(granted);
      if (granted) {
        const logs = await getDeviceCallLogs();
        setRecents(logs.slice(0, 100));
      }
    } catch (e: any) {
      console.error('[DialerScreen] loadRecents failed', e);
      setRecentsError(e?.message || 'Could not load call history from this device.');
    } finally {
      setRecentsLoading(false);
    }
  }, []);

  const checkCallPhonePermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setCallPhoneGranted(false);
      return;
    }
    setCallPhoneGranted(await hasCallPhonePermission());
  }, []);

  const loadContacts = useCallback(async () => {
    if (Platform.OS === 'web') {
      setContactsPermission(false);
      return;
    }
    setContactsLoading(true);
    try {
      const granted = await hasContactsPermission();
      setContactsPermission(granted);
      if (granted) {
        const list = await loadDeviceContacts();
        setContacts(list);
      }
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(async () => {
    if (!user?.id || directory.length > 0) return;
    setDirectoryLoading(true);
    try {
      const list = await loadEmployeeDirectory(user.id);
      setDirectory(list.filter(e => e.phone));
    } finally {
      setDirectoryLoading(false);
    }
  }, [user?.id, directory.length]);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'keypad') checkCallPhonePermission();
      if (tab === 'recents') loadRecents();
      if (tab === 'contacts') loadContacts();
      if (tab === 'directory') loadDirectory();
    }, [tab, checkCallPhonePermission, loadRecents, loadContacts, loadDirectory]),
  );

  async function handleGrantCallLog() {
    const granted = await requestCallLogPermission();
    setRecentsPermission(granted);
    if (granted) {
      loadRecents();
    } else {
      Alert.alert(
        'Permission Needed',
        'Call log access was denied. If this keeps happening, Android has permanently blocked the prompt — enable it manually in Settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
      );
    }
  }

  async function handleGrantContacts() {
    const granted = await requestContactsPermission();
    setContactsPermission(granted);
    if (granted) {
      loadContacts();
    } else {
      Alert.alert(
        'Permission Needed',
        'Contacts access was denied. If this keeps happening, Android has permanently blocked the prompt — enable it manually in Settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
      );
    }
  }

  async function handleGrantCallPhone() {
    const granted = await requestCallPhonePermission();
    setCallPhoneGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permission Needed',
        'Direct dialing was denied, so calls will open the phone app instead. If this keeps happening, enable "Phone" permission manually in Settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
      );
    }
  }

  async function handleCall(number: string) {
    const clean = sanitizeDialInput(number);
    if (!clean) return;
    try {
      const result = await placeCall(clean, user?.id, user?.name);
      if (!result.success) {
        Alert.alert('Call Failed', 'Could not place the call on this device.');
      }
    } catch {
      Alert.alert('Call Failed', 'Could not place the call on this device.');
    }
  }

  async function handleSyncCallLogs() {
    if (!user) return;
    setRecentsLoading(true);
    try {
      await syncCallLogs(user.id, user.name);
      await loadRecents();
    } finally {
      setRecentsLoading(false);
    }
  }

  const filteredContacts = useMemo(() => searchContacts(contacts, contactSearch), [contacts, contactSearch]);

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(e => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q));
  }, [directory, directorySearch]);

  const todayStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayCalls = recents.filter(r => new Date(r.timestamp).toDateString() === todayStr);
    const totalDurationSec = todayCalls.reduce((sum, r) => sum + r.duration, 0);
    const missed = todayCalls.filter(r => r.type === 'missed').length;
    return { count: todayCalls.length, totalMinutes: Math.round(totalDurationSec / 60), missed };
  }, [recents]);

  function pressKey(key: string) {
    setDialInput(prev => prev + key);
  }

  function backspace() {
    setDialInput(prev => prev.slice(0, -1));
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <View style={styles.headerTopRow}>
          {navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.headerTitle}>Calls</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.tabRow}>
          {(['keypad', 'recents', 'contacts', 'directory'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'keypad' ? 'Keypad' : t === 'recents' ? 'Recents' : t === 'contacts' ? 'Contacts' : 'Directory'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {tab === 'keypad' && (
        <View style={[styles.keypadContainer, { paddingBottom: bottomPadding }]}>
          {callPhoneGranted === false && Platform.OS === 'android' && (
            <TouchableOpacity style={styles.directDialBanner} onPress={handleGrantCallPhone} activeOpacity={0.8}>
              <Ionicons name="call-outline" size={16} color="#B45309" />
              <Text style={styles.directDialBannerText}>
                Calls currently open your phone's dialer app. Tap to enable direct in-app calling.
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#B45309" />
            </TouchableOpacity>
          )}
          <View style={styles.dialDisplay}>
            <TextInput
              style={styles.dialInput}
              value={dialInput}
              onChangeText={t => setDialInput(sanitizeDialInput(t))}
              placeholder="Enter number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
            {dialInput.length > 0 && (
              <TouchableOpacity onPress={backspace} style={styles.backspaceBtn} activeOpacity={0.7}>
                <Ionicons name="backspace-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.keypadGrid}>
            {KEYPAD_ROWS.map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map(k => (
                  <TouchableOpacity
                    key={k.digit}
                    style={styles.keypadKey}
                    onPress={() => pressKey(k.digit)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.keypadDigit}>{k.digit}</Text>
                    {!!k.sub && <Text style={styles.keypadSub}>{k.sub}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.callBtn, !dialInput && styles.callBtnDisabled]}
            onPress={() => handleCall(dialInput)}
            disabled={!dialInput}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {tab === 'recents' && (
        <View style={{ flex: 1 }}>
          {recentsPermission === false ? (
            <PermissionPrompt
              icon="call-outline"
              title={Platform.OS !== 'android' ? 'Call history unavailable' : 'Call log access needed'}
              message={
                Platform.OS !== 'android'
                  ? 'Call history sync is only available on Android company devices.'
                  : 'Allow access to view and sync your call history.'
              }
              actionLabel={Platform.OS === 'android' ? 'Grant Access' : undefined}
              onAction={Platform.OS === 'android' ? handleGrantCallLog : undefined}
            />
          ) : recentsError && recents.length === 0 ? (
            <PermissionPrompt
              icon="warning-outline"
              title="Couldn't load call history"
              message={recentsError}
              actionLabel="Try Again"
              onAction={loadRecents}
            />
          ) : recentsLoading && recents.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
          ) : (
            <FlatList
              data={recents}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 8 }}
              refreshing={recentsLoading}
              onRefresh={handleSyncCallLogs}
              ListHeaderComponent={
                <>
                  {recents.length > 0 && (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{todayStats.count}</Text>
                        <Text style={styles.statLabel}>Calls Today</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{todayStats.totalMinutes}m</Text>
                        <Text style={styles.statLabel}>Talk Time</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, todayStats.missed > 0 && { color: '#DC2626' }]}>
                          {todayStats.missed}
                        </Text>
                        <Text style={styles.statLabel}>Missed</Text>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity style={styles.syncRow} onPress={handleSyncCallLogs} activeOpacity={0.7}>
                    <Ionicons name="sync-outline" size={14} color="#2563EB" />
                    <Text style={styles.syncRowText}>Sync call history</Text>
                  </TouchableOpacity>
                </>
              }
              ListEmptyComponent={<Text style={styles.emptyText}>No recent calls.</Text>}
              renderItem={({ item }) => {
                const meta = CALL_TYPE_ICON[item.type];
                return (
                  <TouchableOpacity style={styles.recentRow} onPress={() => handleCall(item.number)} activeOpacity={0.7}>
                    <Ionicons name={meta.icon} size={22} color={meta.color} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentNumber}>{formatPhoneForDisplay(item.number)}</Text>
                      <Text style={styles.recentMeta}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)} · {timeAgo(item.timestamp)}
                        {item.duration > 0 ? ` · ${Math.ceil(item.duration / 60)} min` : ''}
                      </Text>
                    </View>
                    <Ionicons name="call-outline" size={20} color="#2563EB" />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {tab === 'contacts' && (
        <View style={{ flex: 1 }}>
          {contactsPermission === false ? (
            <PermissionPrompt
              icon="people-outline"
              title="Contacts access needed"
              message="Allow access to call your contacts directly from WorkForce."
              actionLabel="Grant Access"
              onAction={handleGrantContacts}
            />
          ) : (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  value={contactSearch}
                  onChangeText={setContactSearch}
                  placeholder="Search contacts"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {contactsLoading && contacts.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
              ) : (
                <FlatList
                  data={filteredContacts}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingBottom: bottomPadding }}
                  ListEmptyComponent={<Text style={styles.emptyText}>No contacts found.</Text>}
                  renderItem={({ item }) => (
                    <View style={styles.contactRow}>
                      <View style={styles.contactAvatar}>
                        <Text style={styles.contactAvatarText}>{item.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{item.name}</Text>
                        <Text style={styles.recentMeta}>{formatPhoneForDisplay(item.phoneNumbers[0])}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleCall(item.phoneNumbers[0])} style={styles.contactCallBtn} activeOpacity={0.7}>
                        <Ionicons name="call" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </>
          )}
        </View>
      )}

      {tab === 'directory' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              value={directorySearch}
              onChangeText={setDirectorySearch}
              placeholder="Search employees"
              placeholderTextColor="#94A3B8"
            />
          </View>
          {directoryLoading && directory.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
          ) : (
            <FlatList
              data={filteredDirectory}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: bottomPadding }}
              ListEmptyComponent={<Text style={styles.emptyText}>No employees found.</Text>}
              renderItem={({ item }) => (
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.recentMeta}>{item.designation || item.department}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleCall(item.phone)} style={styles.contactCallBtn} activeOpacity={0.7}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

function PermissionPrompt({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.permissionPrompt}>
      <View style={styles.permissionIconCircle}>
        <Ionicons name={icon} size={30} color="#2563EB" />
      </View>
      <Text style={styles.permissionTitle}>{title}</Text>
      <Text style={styles.permissionMessage}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.permissionBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.permissionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    marginTop: 16,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  tabBtnTextActive: { color: '#1E3A8A' },

  // Keypad
  keypadContainer: { flex: 1, alignItems: 'center', paddingTop: 20 },
  directDialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'stretch',
  },
  directDialBannerText: { flex: 1, fontSize: 11, color: '#B45309', fontWeight: '600' },
  dialDisplay: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 24, marginBottom: 16 },
  dialInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#0F172A', textAlign: 'center', padding: 0 },
  backspaceBtn: { padding: 8, position: 'absolute', right: 24 },
  keypadGrid: { width: '100%', paddingHorizontal: 32 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  keypadDigit: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  keypadSub: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginTop: 1 },
  callBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  callBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },

  // Recents
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, backgroundColor: '#E2E8F0' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  syncRowText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  recentNumber: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  recentMeta: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 13, fontWeight: '500' },

  // Contacts
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: { fontSize: 14, fontWeight: '800', color: '#2563EB' },
  contactName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  contactCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Permission prompt
  permissionPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6, textAlign: 'center' },
  permissionMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  permissionBtn: { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
