import { Brand } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface GlowToggleProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  /** Active track color (defaults to accent) */
  activeColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

const TRACK_W = 56;
const TRACK_H = 30;
const THUMB_SIZE = 24;
const THUMB_TRAVEL = TRACK_W - THUMB_SIZE - 4; // 2px padding each side

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Custom toggle with a soft glow when active.
 */
export function GlowToggle({
  value,
  onValueChange,
  activeColor = Brand.accent,
  style,
  disabled = false,
}: GlowToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, { damping: 20, stiffness: 300 });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Brand.slateLight, activeColor],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const toggle = () => {
    if (!disabled) onValueChange(!value);
  };

  return (
    <View style={style}>
      <AnimatedPressable
        onPress={toggle}
        style={[styles.track, trackStyle]}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      >
        {/* Glow halo behind thumb */}
        <Animated.View
          style={[styles.glow, glowStyle, { backgroundColor: activeColor }]}
        />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  glow: {
    position: "absolute",
    width: THUMB_SIZE + 14,
    height: THUMB_SIZE + 14,
    borderRadius: (THUMB_SIZE + 14) / 2,
    right: -4,
    top: (TRACK_H - THUMB_SIZE - 14) / 2,
  },
});
