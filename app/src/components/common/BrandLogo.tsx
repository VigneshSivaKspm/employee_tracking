import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { APP_NAME, APP_TAGLINE, LOGO } from '../../constants/brand';

const SIZES = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 72,
  xl: 96,
} as const;

type BrandLogoProps = {
  size?: keyof typeof SIZES;
  showName?: boolean;
  showTagline?: boolean;
  theme?: 'light' | 'dark';
  centered?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export default function BrandLogo({
  size = 'md',
  showName = false,
  showTagline = false,
  theme = 'dark',
  centered = false,
  style,
  imageStyle,
}: BrandLogoProps) {
  const dim = SIZES[size];
  const titleColor = theme === 'dark' ? '#FFFFFF' : '#1E293B';
  const taglineColor = theme === 'dark' ? 'rgba(255,255,255,0.75)' : '#64748B';

  return (
    <View style={[styles.row, centered && styles.centered, style]}>
      <Image
        source={LOGO}
        style={[
          styles.image,
          { width: dim, height: dim, borderRadius: dim * 0.22 },
          imageStyle,
        ]}
        resizeMode="contain"
      />
      {(showName || showTagline) && (
        <View style={[styles.textBlock, centered && styles.textBlockCentered]}>
          {showName && (
            <Text
              style={[
                styles.name,
                centered && styles.textCentered,
                { color: titleColor, fontSize: size === 'xl' ? 32 : size === 'lg' ? 24 : 18 },
              ]}
            >
              {APP_NAME}
            </Text>
          )}
          {showTagline && (
            <Text style={[styles.tagline, centered && styles.textCentered, { color: taglineColor }]}>
              {APP_TAGLINE}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function AuthHeaderLogo({ size = 56 }: { size?: number }) {
  return (
    <View style={styles.authHeaderLogo}>
      <Image
        source={LOGO}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  centered: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  image: {
    flexShrink: 0,
  },
  textBlock: {
    flexShrink: 1,
  },
  textBlockCentered: {
    alignItems: 'center',
  },
  textCentered: {
    textAlign: 'center',
  },
  name: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  authHeaderLogo: {
    alignItems: 'center',
    marginBottom: 16,
  },
});
