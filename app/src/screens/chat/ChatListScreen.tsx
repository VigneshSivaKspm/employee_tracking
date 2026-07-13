import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
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
  subscribeToChats,
  loadChatContacts,
  getOrCreateChat,
  type ChatSummary,
  type EmployeeDirectoryEntry,
} from '../../services/ChatService';
import { subscribeToPresence } from '../../services/PresenceService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function PresenceDot({ userId }: { userId: string }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const unsub = subscribeToPresence(userId, state => setOnline(state.online));
    return unsub;
  }, [userId]);
  if (!online) return null;
  return <View style={styles.onlineDot} />;
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ChatListScreen() {
  const headerTop = useTopInset(16);
  const bottomPadding = useTabScreenBottomPadding();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [directory, setDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [creatingChatFor, setCreatingChatFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToChats(user.id, list => {
      setChats(list);
      setLoading(false);
    });
    return unsub;
  }, [user?.id]);

  const isAdmin = user?.role === 'branch_admin' || user?.role === 'super_admin';
  const contactNoun = isAdmin ? 'employee' : 'branch admin';

  const openPicker = useCallback(async () => {
    setPickerVisible(true);
    if (directory.length === 0 && user) {
      setDirectoryLoading(true);
      try {
        const list = await loadChatContacts(user);
        setDirectory(list);
      } finally {
        setDirectoryLoading(false);
      }
    }
  }, [directory.length, user]);

  async function handlePickEmployee(entry: EmployeeDirectoryEntry) {
    if (!user) return;
    setCreatingChatFor(entry.id);
    try {
      const chatId = await getOrCreateChat(user.id, user.name, entry.id, entry.name);
      setPickerVisible(false);
      setDirectorySearch('');
      navigation.navigate('ChatConversation', { chatId, otherUserId: entry.id, otherUserName: entry.name });
    } finally {
      setCreatingChatFor(null);
    }
  }

  function openChat(chat: ChatSummary) {
    navigation.navigate('ChatConversation', {
      chatId: chat.id,
      otherUserId: chat.otherUserId,
      otherUserName: chat.otherUserName,
    });
  }

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(e => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q));
  }, [directory, directorySearch]);

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
          <Text style={styles.headerTitle}>Chat</Text>
          <TouchableOpacity onPress={openPicker} style={styles.newChatBtn} activeOpacity={0.75}>
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>Tap the compose icon to message a {contactNoun}.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatRow} onPress={() => openChat(item)} activeOpacity={0.7}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.otherUserName)}</Text>
                </View>
                <PresenceDot userId={item.otherUserId} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatName}>{item.otherUserName}</Text>
                <Text style={[styles.chatPreview, item.hasUnread && styles.chatPreviewUnread]} numberOfLines={1}>
                  {item.lastMessage || 'Say hello 👋'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.chatTime}>{timeAgo(item.lastMessageAt)}</Text>
                {item.hasUnread && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerContainer}>
          <View style={[styles.pickerHeader, { paddingTop: headerTop }]}>
            <Text style={styles.pickerTitle}>{isAdmin ? 'Message Employee' : 'Message Branch Admin'}</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.pickerCloseBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              value={directorySearch}
              onChangeText={setDirectorySearch}
              placeholder={`Search ${contactNoun}s`}
              placeholderTextColor="#94A3B8"
            />
          </View>
          {directoryLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
          ) : (
            <FlatList
              data={filteredDirectory}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isAdmin ? 'No employees found in your branch yet.' : 'No branch admin has been assigned yet. Contact HR.'}
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.directoryRow}
                  onPress={() => handlePickEmployee(item)}
                  disabled={!!creatingChatFor}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chatName}>{item.name}</Text>
                    <Text style={styles.chatPreview}>{item.designation || item.department}</Text>
                  </View>
                  {creatingChatFor === item.id && <ActivityIndicator size="small" color="#2563EB" />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatRow: {
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
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  chatPreview: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  chatPreviewUnread: { color: '#0F172A', fontWeight: '700' },
  chatTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6, fontWeight: '500' },

  // New chat picker modal
  pickerContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  pickerCloseBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
});
