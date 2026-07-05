import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

/** Fallback when Android does not report navigation-bar inset (3-button nav). */
const ANDROID_NAV_BAR_MIN = 48;

export function getNavBottomInset(insetBottom: number): number {
  if (Platform.OS !== 'android') return insetBottom;
  return Math.max(insetBottom, ANDROID_NAV_BAR_MIN);
}

/** System navigation bar inset (Android back/home/recent area). */
export function useNavBottomInset(): number {
  const { bottom } = useSafeAreaInsets();
  return getNavBottomInset(bottom);
}

/** Scroll padding for screens inside the bottom tab navigator. */
export function useTabScreenBottomPadding(extra = 20): number {
  const tabBarHeight = useBottomTabBarHeight();
  return tabBarHeight + extra;
}

/** Scroll padding for full-screen stack routes (no tab bar). */
export function useStackScreenBottomPadding(extra = 24): number {
  return useNavBottomInset() + extra;
}

/** Tab bar layout values for AppNavigator. */
export function useTabBarLayout() {
  const bottomInset = useNavBottomInset();
  const contentHeight = 56;
  return {
    bottomInset,
    height: contentHeight + bottomInset,
    contentHeight,
  };
}
