import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  getCurrentBannerHeight,
  subscribeToBannerHeight,
} from './bannerHeight';

/**
 * The space an inline Gleap banner takes at the top of the screen, measured
 * from the top edge (the banner covers the status bar). 0 while no inline
 * banner is shown; floating banners float above the app and stay at 0.
 */
export function useGleapBannerHeight(): number {
  const [height, setHeight] = useState(getCurrentBannerHeight);
  useEffect(() => {
    setHeight(getCurrentBannerHeight());
    return subscribeToBannerHeight(setHeight);
  }, []);
  return height;
}

const areaStyle: ViewStyle = { flex: 1 };

export type GleapBannerAreaProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How long the content takes to move, in ms. Default 250. */
  duration?: number;
};

/**
 * Keeps its children below an inline Gleap banner, like inline banners on the
 * web: while one is shown, the content moves down by the banner's height
 * instead of being covered, and back up when it closes. Floating banners still
 * float above the app. Wrap the whole app (around your navigation container).
 *
 * The banner covers the status bar. If your screens add the top safe-area
 * inset themselves (SafeAreaView, React Navigation headers), subtract the
 * banner height from it, see the README.
 */
export function GleapBannerArea({
  children,
  style,
  duration = 250,
}: GleapBannerAreaProps) {
  const height = useGleapBannerHeight();
  const paddingTop = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.timing(paddingTop, {
      toValue: height,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [height, duration, paddingTop]);

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[areaStyle, { paddingTop }, style]}>
      {children}
    </Animated.View>
  );
}
