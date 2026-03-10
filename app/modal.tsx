/**
 * Breathing Exercise Modal – Doomscroll Detox
 *
 * Full-screen "Nudge" overlay that forces a 10-second breathing exercise
 * before the user can dismiss. This is the intervention shown when a user
 * tries to open a blocked app (mocked via a button on the Dashboard).
 */
import { Brand } from "@/constants/theme";
import { useRouter } from "expo-router";
import { Wind, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const EXERCISE_SECONDS = 10;
const BREATHE_CYCLE_MS = 4000; // 4 s in, 4 s out

export default function BreathingModal() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(EXERCISE_SECONDS);
  const [phase, setPhase] = useState<"inhale" | "exhale">("inhale");
  const canDismiss = secondsLeft <= 0;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown
  useEffect(() => {
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // Breathing phase toggle
  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p === "inhale" ? "exhale" : "inhale"));
    }, BREATHE_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  // Animated circle scale
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.35, {
          duration: BREATHE_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: BREATHE_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const circleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.overlay}>
      {/* Breathing circle */}
      <Animated.View style={[styles.circle, circleAnim]}>
        <Wind size={36} color={Brand.textBright} />
      </Animated.View>

      <Text style={styles.phaseText}>
        {phase === "inhale" ? "Breathe in…" : "Breathe out…"}
      </Text>

      <Text style={styles.timer}>
        {canDismiss ? "Well done" : `${secondsLeft}s remaining`}
      </Text>

      <Text style={styles.message}>
        It looks like you&apos;re trying to open a blocked app.{"\n"}
        Take a moment to breathe before deciding.
      </Text>

      {/* Dismiss button (only active after timer ends) */}
      <Pressable
        disabled={!canDismiss}
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.dismissBtn,
          !canDismiss && styles.dismissBtnDisabled,
          pressed && canDismiss && { opacity: 0.8 },
        ]}
      >
        <X size={18} color={canDismiss ? "#fff" : Brand.muted} />
        <Text
          style={[styles.dismissText, !canDismiss && { color: Brand.muted }]}
        >
          {canDismiss ? "Close & Stay Calm" : "Please wait…"}
        </Text>
      </Pressable>

      {/*
       * NATIVE INTEGRATION
       * ──────────────────
       * After the breathing exercise completes, the AccessibilityService
       * keeps the user on the home screen. This modal is shown by the
       * service before redirecting via GLOBAL_ACTION_HOME / GLOBAL_ACTION_BACK.
       */}
    </View>
  );
}

const CIRCLE_SIZE = 160;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Brand.midnight,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: Brand.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    // soft glow
    shadowColor: Brand.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 10,
  },
  phaseText: {
    fontSize: 22,
    fontWeight: "600",
    color: Brand.textBright,
    marginBottom: 8,
  },
  timer: {
    fontSize: 16,
    color: Brand.accent,
    fontWeight: "500",
    marginBottom: 20,
    fontVariant: ["tabular-nums"],
  },
  message: {
    fontSize: 14,
    color: Brand.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  dismissBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Brand.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  dismissBtnDisabled: {
    backgroundColor: Brand.slateLight,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
