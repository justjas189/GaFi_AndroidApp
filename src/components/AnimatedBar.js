import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

/**
 * Gamified horizontal progress bar.
 *
 * Fills left → right by animating `transform: scaleX` (0 → 1) on the NATIVE
 * thread (useNativeDriver: true), so it stays at 60fps even when many bars
 * render inside a list. The fill is laid out at full width and anchored to the
 * left edge (transformOrigin: 'left'), then scaled — animating width directly
 * would force a layout pass on the JS thread every frame.
 *
 * `percent` is clamped to 0–100 so the bar can never invert (negative values)
 * or overflow its track (values past the target).
 *
 * Pass the existing track/fill StyleSheet entries via `trackStyle`/`fillStyle`
 * to keep each screen's look identical; `color` overrides the fill color.
 */
function AnimatedBar({
  percent,
  color,
  trackStyle,
  fillStyle,
  duration = 1000,
  style,
}) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamped / 100,
      duration,
      useNativeDriver: true,
    }).start();
  }, [clamped, duration, anim]);

  return (
    <View style={[trackStyle, style]}>
      <Animated.View
        style={[
          fillStyle,
          {
            width: '100%',
            alignSelf: 'flex-start',
            transformOrigin: 'left',
            transform: [{ scaleX: anim }],
            ...(color ? { backgroundColor: color } : null),
          },
        ]}
      />
    </View>
  );
}

export default React.memo(AnimatedBar);
