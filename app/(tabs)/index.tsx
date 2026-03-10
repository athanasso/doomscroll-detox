/**
 * Dashboard (Home) – Doomscroll Detox
 *
 * Shows a countdown to the next Bedtime Block and a Quick Shield toggle.
 * The tone is calm & non-judgmental.
 */
import { GlassCard } from "@/components/glass-card";
import { GlowToggle } from "@/components/glow-toggle";
import { Brand } from "@/constants/theme";
import { useAppCtx } from "@/contexts/app-state-context";
import {
  hasNativeModule,
  hasUsageStatsPermission,
  isAccessibilityEnabled,
  isBatteryOptimized,
  openAccessibilitySettings,
  openUsageStatsSettings,
  requestIgnoreBatteryOptimizations,
} from "@/modules/doomscroll-native";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Moon,
  Shield,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  AppState as RNAppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ── helpers ────────────────────────────────────────────────────
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function secondsUntilBedtime(startHour: number, startMinute: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(startHour, startMinute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
}

function fmtCountdown(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h: pad(h), m: pad(m), s: pad(s) };
}

// ── component ──────────────────────────────────────────────────
export default function DashboardScreen() {
  const { state, setQuickShield } = useAppCtx();

  // Track whether the accessibility service is enabled
  const [serviceOk, setServiceOk] = useState(true);
  const [usageOk, setUsageOk] = useState(true);
  const [batteryOk, setBatteryOk] = useState(true);

  useEffect(() => {
    const check = () => {
      isAccessibilityEnabled()
        .then(setServiceOk)
        .catch(() => {});
      hasUsageStatsPermission()
        .then(setUsageOk)
        .catch(() => {});
      isBatteryOptimized()
        .then((optimized) => setBatteryOk(!optimized))
        .catch(() => {});
    };
    check();
    const sub = RNAppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => sub.remove();
  }, []);

  // Live countdown
  const [remaining, setRemaining] = useState(
    secondsUntilBedtime(state.schedule.startHour, state.schedule.startMinute),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(
        secondsUntilBedtime(
          state.schedule.startHour,
          state.schedule.startMinute,
        ),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [state.schedule]);

  const { h, m, s } = fmtCountdown(remaining);

  const activeCount = state.blockedApps.filter((a) => a.enabled).length;
  const activeApps = state.blockedApps.filter((a) => a.enabled);

  // Pulsing indicator for shield-active banner
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (state.quickShield) {
      pulse.value = withRepeat(withTiming(0.3, { duration: 1200 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [state.quickShield, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Moon size={28} color={Brand.accent} />
          <Text style={styles.title}>Doomscroll Detox</Text>
        </View>

        <Text style={styles.subtitle}>Your calm space before sleep.</Text>

        {/* Permission warnings (only shown in dev builds where the native module exists) */}
        {hasNativeModule && !serviceOk && (
          <Pressable onPress={() => openAccessibilitySettings()}>
            <GlassCard style={styles.warningCard}>
              <View style={styles.warningRow}>
                <AlertTriangle size={20} color={Brand.warning} />
                <View style={styles.warningText}>
                  <Text style={styles.warningTitle}>Accessibility Service</Text>
                  <Text style={styles.warningDesc}>
                    Tap to enable the Accessibility Service so Doomscroll Detox
                    can block apps during your Doom Zone.
                  </Text>
                </View>
                <ChevronRight size={16} color={Brand.muted} />
              </View>
            </GlassCard>
          </Pressable>
        )}

        {hasNativeModule && !usageOk && (
          <Pressable onPress={() => openUsageStatsSettings()}>
            <GlassCard style={styles.warningCard}>
              <View style={styles.warningRow}>
                <AlertTriangle size={20} color={Brand.warning} />
                <View style={styles.warningText}>
                  <Text style={styles.warningTitle}>Usage Access</Text>
                  <Text style={styles.warningDesc}>
                    Tap to grant usage access so the app can detect which apps
                    are in the foreground.
                  </Text>
                </View>
                <ChevronRight size={16} color={Brand.muted} />
              </View>
            </GlassCard>
          </Pressable>
        )}

        {hasNativeModule && !batteryOk && (
          <Pressable onPress={() => requestIgnoreBatteryOptimizations()}>
            <GlassCard style={styles.warningCard}>
              <View style={styles.warningRow}>
                <AlertTriangle size={20} color={Brand.warning} />
                <View style={styles.warningText}>
                  <Text style={styles.warningTitle}>Battery Optimization</Text>
                  <Text style={styles.warningDesc}>
                    Tap to disable battery optimization so the blocking service
                    stays active in the background.
                  </Text>
                </View>
                <ChevronRight size={16} color={Brand.muted} />
              </View>
            </GlassCard>
          </Pressable>
        )}

        {/* Countdown card */}
        <GlassCard style={styles.countdownCard}>
          <Text style={styles.cardLabel}>Next Bedtime Block in</Text>
          <View style={styles.timerRow}>
            <TimerDigit label="HRS" value={h} />
            <Text style={styles.colon}>:</Text>
            <TimerDigit label="MIN" value={m} />
            <Text style={styles.colon}>:</Text>
            <TimerDigit label="SEC" value={s} />
          </View>
          <Text style={styles.scheduleHint}>
            {state.use24h
              ? `${pad(state.schedule.startHour)}:${pad(state.schedule.startMinute)}`
              : `${state.schedule.startHour % 12 === 0 ? 12 : state.schedule.startHour % 12}:${pad(state.schedule.startMinute)} ${state.schedule.startHour >= 12 ? "PM" : "AM"}`}
            {" \u2013 "}
            {state.use24h
              ? `${pad(state.schedule.endHour)}:${pad(state.schedule.endMinute)}`
              : `${state.schedule.endHour % 12 === 0 ? 12 : state.schedule.endHour % 12}:${pad(state.schedule.endMinute)} ${state.schedule.endHour >= 12 ? "PM" : "AM"}`}
          </Text>
        </GlassCard>

        {/* Quick Shield */}
        <GlassCard
          style={[
            styles.shieldCard,
            state.quickShield && styles.shieldCardActive,
          ]}
        >
          <View style={styles.shieldRow}>
            <Shield
              size={24}
              color={state.quickShield ? Brand.success : Brand.muted}
            />
            <View style={styles.shieldText}>
              <Text style={styles.shieldTitle}>Quick Shield</Text>
              <Text style={styles.shieldDesc}>
                {state.quickShield
                  ? "All feeds are blocked right now"
                  : "Block all feeds immediately"}
              </Text>
            </View>
            <GlowToggle
              value={state.quickShield}
              onValueChange={setQuickShield}
              activeColor={Brand.success}
            />
          </View>

          {/* Active shield details */}
          {state.quickShield && activeApps.length > 0 && (
            <View style={styles.shieldActive}>
              <View style={styles.shieldActiveHeader}>
                <Animated.View style={[styles.pulseDot, pulseStyle]} />
                <Text style={styles.shieldActiveLabel}>SHIELD ACTIVE</Text>
              </View>
              <Text style={styles.shieldActiveApps}>
                {activeApps.map((a) => a.name).join(" \u2022 ")}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Stats snapshot */}
        <GlassCard style={styles.statCard}>
          <View style={styles.statRow}>
            <View>
              <Text style={styles.statValue}>{activeCount}</Text>
              <Text style={styles.statLabel}>Apps shielded</Text>
            </View>
            <View>
              <Text style={styles.statValue}>
                {state.weeklySaved.reduce((a, b) => a + b, 0)}
              </Text>
              <Text style={styles.statLabel}>Min saved this week</Text>
            </View>
          </View>
        </GlassCard>

        {/* Status footer */}
        <View style={styles.statusRow}>
          <Clock size={14} color={Brand.muted} />
          <Text style={styles.statusText}>
            {serviceOk && usageOk && batteryOk
              ? `Blocking ${activeCount} app${activeCount === 1 ? "" : "s"} during Doom Zone`
              : "Grant all permissions above to start blocking"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── small sub-component ────────────────────────────────────────
function TimerDigit({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.digitBox}>
      <Text style={styles.digitValue}>{value}</Text>
      <Text style={styles.digitLabel}>{label}</Text>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.midnight },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: "700", color: Brand.textBright },
  subtitle: { fontSize: 14, color: Brand.muted, marginBottom: 24 },

  // Countdown
  countdownCard: { marginBottom: 16, alignItems: "center" as const },
  cardLabel: {
    fontSize: 13,
    color: Brand.muted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colon: {
    fontSize: 36,
    fontWeight: "300",
    color: Brand.accent,
    marginTop: -6,
  },
  digitBox: { alignItems: "center" as const },
  digitValue: {
    fontSize: 44,
    fontWeight: "700",
    color: Brand.textBright,
    fontVariant: ["tabular-nums"],
  },
  digitLabel: {
    fontSize: 10,
    color: Brand.muted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  scheduleHint: { fontSize: 12, color: Brand.muted, marginTop: 14 },

  // Shield
  shieldCard: { marginBottom: 16 },
  shieldCardActive: { borderWidth: 1, borderColor: Brand.success },
  shieldRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  shieldText: { flex: 1 },
  shieldTitle: { fontSize: 16, fontWeight: "600", color: Brand.textBright },
  shieldDesc: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  shieldActive: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.glassBorder,
  },
  shieldActiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.success,
  },
  shieldActiveLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Brand.success,
    letterSpacing: 1.5,
  },
  shieldActiveApps: {
    fontSize: 13,
    color: Brand.text,
    lineHeight: 20,
  },

  // Stats
  statCard: { marginBottom: 20 },
  statRow: { flexDirection: "row", justifyContent: "space-around" },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: Brand.accent,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
    color: Brand.muted,
    textAlign: "center",
    marginTop: 2,
  },

  // Nudge button
  nudgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Brand.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    padding: 16,
  },
  nudgeBtnText: {
    flex: 1,
    fontSize: 14,
    color: Brand.warning,
    fontWeight: "500",
  },

  // Warning banner
  warningCard: { marginBottom: 16, borderWidth: 1, borderColor: Brand.warning },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  warningText: { flex: 1 },
  warningTitle: { fontSize: 14, fontWeight: "600", color: Brand.warning },
  warningDesc: {
    fontSize: 12,
    color: Brand.muted,
    marginTop: 2,
    lineHeight: 18,
  },

  // Status footer
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  statusText: { fontSize: 13, color: Brand.muted },
});
