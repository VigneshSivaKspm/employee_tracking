import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ANNOUNCEMENTS: Record<string, {
  id: string; title: string; category: string; date: string; body: string;
}> = {
  '1': {
    id: '1',
    title: 'Team Meeting Tomorrow',
    category: 'General',
    date: '24 Jun 2026 – 10:30 AM',
    body: `Don't forget the important team meeting tomorrow at 11:00 AM in the Conference Room.

We will discuss the project updates, new tasks and deadlines. Please come prepared with your weekly progress report.

Agenda:
• Project status update
• Q3 planning
• Team announcements
• Q&A session

Please be on time. Refreshments will be provided.`,
  },
  '2': {
    id: '2',
    title: 'Leave Approved',
    category: 'Leave',
    date: '24 Jun 2026 – 09:00 AM',
    body: `Your leave request has been approved by your manager John Manager.

Leave Details:
• Type: Casual Leave
• Date: 25 Jun 2026
• Duration: 1 Day
• Status: Approved

Please ensure that your pending tasks are delegated before your leave date.`,
  },
  '3': {
    id: '3',
    title: 'New Announcement',
    category: 'HR',
    date: '23 Jun 2026 – 03:00 PM',
    body: `We are excited to announce that the company picnic is scheduled for 30th June 2026!

Venue: City Park, Bangalore
Time: 10:00 AM – 5:00 PM

Activities planned:
• Team building games
• BBQ lunch
• Music and entertainment
• Prize distributions

Family members are welcome to join. Please RSVP by 27th June.`,
  },
  '4': {
    id: '4',
    title: 'Salary Slip',
    category: 'Finance',
    date: '22 Jun 2026 – 06:00 PM',
    body: `Your salary slip for the month of June 2026 is now available in the HR portal.

You can download it from your profile under Documents section.

If you have any queries regarding your salary, please reach out to the HR department at hr@company.com or call ext. 1234.`,
  },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  General: { bg: '#EFF6FF', text: '#2563EB' },
  Leave:   { bg: '#DCFCE7', text: '#16A34A' },
  HR:      { bg: '#FEF3C7', text: '#D97706' },
  Finance: { bg: '#EDE9FE', text: '#7C3AED' },
};

interface Props {
  route: { params: { announcementId: string } };
}

export default function AnnouncementDetailsScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { announcementId } = route.params;
  const item = ANNOUNCEMENTS[announcementId] ?? ANNOUNCEMENTS['1'];
  const catColor = CATEGORY_COLORS[item.category] ?? { bg: '#F1F5F9', text: '#64748B' };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Announcement</Text>
          <View style={styles.backBtn} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image placeholder */}
        <View style={styles.imagePlaceholder}>
          <View style={styles.imagePlaceholderInner}>
            <Ionicons name="megaphone-outline" size={56} color="#2563EB" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
            <Text style={[styles.categoryBadgeText, { color: catColor.text }]}>{item.category}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.body}>{item.body}</Text>
        </View>
      </ScrollView>

      {/* Got It Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.gotItBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.gotItBtnText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  imagePlaceholder: {
    margin: 16,
    height: 200,
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePlaceholderInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16 },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#1E293B', lineHeight: 30, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  dateText: { fontSize: 13, color: '#64748B' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 16 },
  body: { fontSize: 15, color: '#64748B', lineHeight: 26 },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  gotItBtn: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
