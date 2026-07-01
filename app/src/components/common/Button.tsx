import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { BorderRadius } from '../../theme/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border: string }> = {
  primary:   { bg: '#2563EB',  text: '#FFFFFF', border: 'transparent' },
  secondary: { bg: '#F1F5F9',  text: '#1E293B', border: '#E2E8F0' },
  danger:    { bg: '#DC2626',  text: '#FFFFFF', border: 'transparent' },
  ghost:     { bg: 'transparent', text: '#2563EB', border: 'transparent' },
  outline:   { bg: 'transparent', text: '#2563EB', border: '#2563EB' },
};

const SIZE_STYLES: Record<Size, { paddingV: number; paddingH: number; fontSize: number; borderRadius: number }> = {
  sm: { paddingV: 8,  paddingH: 14, fontSize: 13, borderRadius: BorderRadius.sm },
  md: { paddingV: 13, paddingH: 20, fontSize: 15, borderRadius: BorderRadius.md },
  lg: { paddingV: 17, paddingH: 28, fontSize: 16, borderRadius: BorderRadius.lg },
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  labelStyle,
  fullWidth = false,
}: Props) {
  const vs = VARIANT_STYLES[variant];
  const ss = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.78}
      style={[
        styles.btn,
        {
          backgroundColor: vs.bg,
          borderColor: vs.border,
          paddingVertical: ss.paddingV,
          paddingHorizontal: ss.paddingH,
          borderRadius: ss.borderRadius,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : (
        <Text style={[styles.label, { color: vs.text, fontSize: ss.fontSize }, labelStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
