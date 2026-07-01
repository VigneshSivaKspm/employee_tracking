import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void } | { label: string; onPress: () => void };
  gradient?: boolean;
}

export default function ScreenHeader({ title, subtitle, onBack, rightAction, gradient = true }: Props) {
  const insets = useSafeAreaInsets();

  const content = (
    <View style={[styles.inner, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity
        onPress={onBack}
        style={[styles.sideBtn, !onBack && styles.invisible]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {rightAction ? (
        <TouchableOpacity onPress={rightAction.onPress} style={styles.sideBtn}>
          {'icon' in rightAction ? (
            <Ionicons name={(rightAction as any).icon} size={22} color="#FFFFFF" />
          ) : (
            <Text style={styles.rightLabel}>{(rightAction as any).label}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.sideBtn} />
      )}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.header}>
        {content}
      </LinearGradient>
    );
  }

  return <View style={[styles.header, { backgroundColor: '#2563EB' }]}>{content}</View>;
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  sideBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invisible: {
    opacity: 0,
  },
  rightLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
