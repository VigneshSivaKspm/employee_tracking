import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNavBottomInset, useTopInset } from '../../hooks/useBottomSpacing';
import {
  subscribeToMessages,
  subscribeToChatMeta,
  sendMessage,
  sendAttachmentMessage,
  markChatRead,
  type ChatMessage,
  type PendingAttachment,
} from '../../services/ChatService';
import { subscribeToPresence } from '../../services/PresenceService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ConversationRoute = RouteProp<RootStackParamList, 'ChatConversation'>;

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function lastSeenLabel(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'last seen just now';
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  return `last seen ${Math.floor(h / 24)}d ago`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatConversationScreen() {
  const headerTop = useTopInset(16);
  const bottomInset = useNavBottomInset();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ConversationRoute>();
  const { chatId, otherUserId, otherUserName } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastReadAt, setLastReadAt] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ online: boolean; lastSeen: string }>({ online: false, lastSeen: '' });
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = subscribeToMessages(chatId, list => {
      setMessages(list);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    const unsub = subscribeToChatMeta(chatId, meta => setLastReadAt(meta.lastReadAt));
    return unsub;
  }, [chatId]);

  useEffect(() => {
    const unsub = subscribeToPresence(otherUserId, setPresence);
    return unsub;
  }, [otherUserId]);

  useEffect(() => {
    if (user?.id) markChatRead(chatId, user.id).catch(() => undefined);
  }, [chatId, user?.id, messages.length]);

  const otherLastRead = lastReadAt[otherUserId];

  const handleSend = useCallback(async () => {
    if (!user || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await sendMessage(chatId, user.id, user.name, text);
    } finally {
      setSending(false);
    }
  }, [chatId, draft, sending, user]);

  const uploadAttachment = useCallback(
    async (attachment: PendingAttachment) => {
      if (!user) return;
      setUploading(true);
      try {
        await sendAttachmentMessage(chatId, user.id, user.name, attachment);
      } catch {
        Alert.alert('Upload Failed', 'Could not send this attachment. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [chatId, user],
  );

  async function handlePickCamera() {
    setAttachSheetVisible(false);
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera Access Needed', 'Allow camera access to take a photo or video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const kind = asset.type === 'video' ? 'video' : 'image';
    uploadAttachment({
      uri: asset.uri,
      name: asset.fileName || `${kind}_${Date.now()}.${kind === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: asset.fileSize,
      kind,
    });
  }

  async function handlePickGallery() {
    setAttachSheetVisible(false);
    const ImagePicker = await import('expo-image-picker');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Media Access Needed', 'Allow photo & video library access to share media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const kind = asset.type === 'video' ? 'video' : 'image';
    uploadAttachment({
      uri: asset.uri,
      name: asset.fileName || `${kind}_${Date.now()}.${kind === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: asset.fileSize,
      kind,
    });
  }

  async function handlePickDocument() {
    setAttachSheetVisible(false);
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    uploadAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size,
      kind: 'file',
    });
  }

  async function handleOpenFile(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could Not Open File', 'Try again or check your connection.');
    }
  }

  const presenceLabel = presence.online ? 'Online' : presence.lastSeen ? lastSeenLabel(presence.lastSeen) : '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerTop + 44 : 0}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerTop }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerAvatarWrap}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{otherUserName.slice(0, 1).toUpperCase()}</Text>
          </View>
          {presence.online && <View style={styles.headerOnlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{otherUserName}</Text>
          {!!presenceLabel && (
            <Text style={[styles.headerSubtitle, presence.online && styles.headerSubtitleOnline]}>{presenceLabel}</Text>
          )}
        </View>
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.id;
          const isRead = isMine && !!otherLastRead && otherLastRead >= item.createdAt;
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              {item.type === 'text' && (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
                </View>
              )}
              {item.type === 'image' && (
                <TouchableOpacity onPress={() => setPreviewImage(item.attachmentUrl!)} activeOpacity={0.85}>
                  <Image source={{ uri: item.attachmentUrl }} style={styles.imageBubble} resizeMode="cover" />
                </TouchableOpacity>
              )}
              {item.type === 'video' && (
                <TouchableOpacity
                  style={styles.videoBubble}
                  onPress={() => setPreviewVideo(item.attachmentUrl!)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play-circle" size={40} color="#FFFFFF" />
                  <Text style={styles.videoBubbleLabel}>Video · {formatBytes(item.attachmentSize)}</Text>
                </TouchableOpacity>
              )}
              {item.type === 'file' && (
                <TouchableOpacity
                  style={[styles.fileBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                  onPress={() => handleOpenFile(item.attachmentUrl!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="document-text" size={22} color={isMine ? '#FFFFFF' : '#2563EB'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileBubbleName, isMine && styles.bubbleTextMine]} numberOfLines={1}>
                      {item.attachmentName}
                    </Text>
                    <Text style={[styles.fileBubbleSize, isMine && { color: 'rgba(255,255,255,0.75)' }]}>
                      {formatBytes(item.attachmentSize)} · Tap to open
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <View style={styles.bubbleMetaRow}>
                <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
                {isMine && (
                  <Ionicons
                    name={isRead ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={isRead ? '#2563EB' : '#94A3B8'}
                  />
                )}
              </View>
            </View>
          );
        }}
      />

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.uploadingText}>Sending attachment...</Text>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <TouchableOpacity onPress={() => setAttachSheetVisible(true)} style={styles.attachBtn} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={26} color="#2563EB" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor="#94A3B8"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Attach action sheet */}
      <Modal visible={attachSheetVisible} transparent animationType="fade" onRequestClose={() => setAttachSheetVisible(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setAttachSheetVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 20) }]}>
            <TouchableOpacity style={styles.sheetRow} onPress={handlePickCamera} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="camera" size={20} color="#2563EB" />
              </View>
              <Text style={styles.sheetLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handlePickGallery} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="images" size={20} color="#16A34A" />
              </View>
              <Text style={styles.sheetLabel}>Photo & Video Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handlePickDocument} activeOpacity={0.7}>
              <View style={[styles.sheetIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="document" size={20} color="#EA580C" />
              </View>
              <Text style={styles.sheetLabel}>Document</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-screen image preview */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {!!previewImage && (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Full-screen video preview */}
      <Modal visible={!!previewVideo} transparent animationType="fade" onRequestClose={() => setPreviewVideo(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVideo(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {!!previewVideo && <VideoPreview uri={previewVideo} />}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    import('expo-av').then(mod => setComp(() => mod.Video));
  }, []);
  const videoRef = useRef<any>(null);
  const memoStyle = useMemo(() => styles.previewVideo, []);
  if (!Comp) return <ActivityIndicator color="#FFFFFF" />;
  const Video = Comp;
  return (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={memoStyle}
      useNativeControls
      resizeMode="contain"
      shouldPlay
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatarWrap: { position: 'relative', marginRight: 10 },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  headerOnlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#1E3A8A',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 1 },
  headerSubtitleOnline: { color: '#86EFAC' },

  bubbleRow: { marginBottom: 12, maxWidth: '78%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleText: { fontSize: 14, color: '#0F172A', lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  imageBubble: { width: 200, height: 200, borderRadius: 14 },
  videoBubble: {
    width: 200, height: 130, borderRadius: 14, backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  videoBubbleLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  fileBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, minWidth: 200, maxWidth: 260,
  },
  fileBubbleName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  fileBubbleSize: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },

  uploadingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#EFF6FF',
  },
  uploadingText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  attachBtn: { paddingBottom: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 14 },
  sheetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 1, padding: 8 },
  previewImage: { width: '100%', height: '80%' },
  previewVideo: { width: '100%', height: '50%' },
});
