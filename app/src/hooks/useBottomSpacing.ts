import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

/** Fallback when Android does not report navigation-bar inset (3-button nav). */
const ANDROID_NAV_BAR_MIN = 48;

/** Fallback when edge-to-edge Android reports zero top inset (status bar / cutout). */
const ANDROID_STATUS_BAR_MIN = 28;

function getAndroidStatusBarHeight(): number {
  return RNStatusBar.currentHeight ?? ANDROID_STATUS_BAR_MIN;
}

/** Reliable top inset for headers (Android edge-to-edge often reports 0). */
export function getTopInset(insetTop: number): number {
  if (Platform.OS !== 'android') return insetTop;

  const statusBar = getAndroidStatusBarHeight();
  return Math.max(insetTop, statusBar);
}

/** Top safe-area padding plus optional extra spacing for screen headers. */
export function useTopInset(extra = 0): number {
  const { top } = useSafeAreaInsets();
  return getTopInset(top) + extra;
}

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
