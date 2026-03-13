/**
 * Onboarding – Doomscroll Detox
 *
 * Walks the user through enabling the two Android permissions
 * required for the app to function:
 *
 *   1. Accessibility Service – lets us detect foreground apps & block them
 *   2. Usage Stats Access  – lets us read real usage data for the stats screen
 *
 * Both open the system Settings page; we poll for changes when the
 * user returns.
 */
import { GlassCard } from "@/components/glass-card";
import { Brand } from "@/constants/theme";
import { useAppCtx } from "@/contexts/app-state-context";
import {
  hasUsageStatsPermission,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  openUsageStatsSettings,
  isBatteryOptimized,
  requestIgnoreBatteryOptimizations,
} from "@/modules/doomscroll-native";
import { useRouter } from "expo-router";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Moon,
  Shield,
  Battery,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  AppState as RNAppState,
  StyleSheet,
  Text,
  View,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OnboardingScreen() {
  const { setOnboardingDone } = useAppCtx();
  const router = useRouter();

  const [a11yOk, setA11yOk] = useState(false);
  const [usageOk, setUsageOk] = useState(false);
  const [batteryOk, setBatteryOk] = useState(false);
  const [step, setStep] = useState(1);

  // Check permission status
  const refresh = useCallback(async () => {
    const [a, u, optimized] = await Promise.all([
      isAccessibilityEnabled(),
      hasUsageStatsPermission(),
      isBatteryOptimized(),
    ]);
    setA11yOk(a);
    setUsageOk(u);
    setBatteryOk(!optimized);
  }, []);

  // Poll when app comes to foreground (user returning from Settings)
  useEffect(() => {
    refresh();
    const sub = RNAppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const allDone = a11yOk && usageOk && batteryOk;

  const finish = useCallback(async () => {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: "Notification Permission",
            message: "Doomscroll Detox needs this to keep its blocking service alive and show you when it's active.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
      } catch (err) {}
    }

    setOnboardingDone(true);
    router.replace("/(tabs)");
  }, [setOnboardingDone, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Moon size={36} color={Brand.accent} />
          <Text style={styles.title}>Welcome to{"\n"}Doomscroll Detox</Text>
          <Text style={styles.subtitle}>
            We need three permissions to aggressively protect your sleep. Tap each card to configure Settings, then come back here.
          </Text>
        </View>

        {step === 1 ? (
          <>
            {/* Step 1 – Accessibility */}
            <PermissionCard
              icon={<Shield size={24} color={a11yOk ? Brand.success : Brand.accent} />}
              title="Accessibility Service"
              description="Detects when you open a blocked app and redirects you to a calming breathing exercise."
              granted={a11yOk}
              onPress={() => openAccessibilitySettings()}
            />

            {/* Step 2 – Usage Stats */}
            <PermissionCard
              icon={<BarChart3 size={24} color={usageOk ? Brand.success : Brand.accent} />}
              title="Usage Stats Access"
              description="Reads how much time you spend on social apps so your Stats screen shows real data."
              granted={usageOk}
              onPress={() => openUsageStatsSettings()}
            />

            {/* Step 3 – Battery */}
            <PermissionCard
              icon={<Battery size={24} color={batteryOk ? Brand.success : Brand.accent} />}
              title="Ignore Battery Limits"
              description="Prevents Android from killing the blocking service while you sleep overnight."
              granted={batteryOk}
              onPress={() => requestIgnoreBatteryOptimizations()}
            />
          </>
        ) : (
          <View style={styles.guideContainer}>
            <Text style={styles.guideHeader}>How it works</Text>
            
            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>🛡️ Quick Shield & Bedtime</Text>
              <Text style={styles.guideItemDesc}>Instantly block all distracting feeds, or set an automatic Bedtime Block schedule.</Text>
            </View>
            
            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>💬 Allowed Friends</Text>
              <Text style={styles.guideItemDesc}>Need to reply to a friend? Only allow reels or messages sent directly to your DMs.</Text>
            </View>
            
            <View style={styles.guideItem}>
              <Text style={styles.guideItemTitle}>⏳ Anti-Scroll Limits</Text>
              <Text style={styles.guideItemDesc}>Give yourself 1-30 minutes of scrolling before the app kicks you out to breathe.</Text>
            </View>
          </View>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Continue / Skip */}
        <Pressable
          onPress={() => {
            if (step === 1) {
              setStep(2);
            } else {
              finish();
            }
          }}
          style={({ pressed }) => [
            styles.continueBtn,
            (step === 2 || allDone) && styles.continueBtnReady,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.continueText, (step === 2 || allDone) && styles.continueTextReady]}>
            {step === 1 ? (allDone ? "Next" : "Skip for now") : "Let\u2019s Go!"}
          </Text>
        </Pressable>

        {step === 1 && !allDone && (
          <Text style={styles.skipHint}>
            You can grant permissions later from the app&apos;s settings.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Permission card ────────────────────────────────────────────
function PermissionCard({
  icon,
  title,
  description,
  granted,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  granted: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={granted ? undefined : onPress} disabled={granted}>
      <GlassCard style={[styles.permCard, granted && styles.permCardGranted]}>
        <View style={styles.permRow}>
          {icon}
          <View style={styles.permText}>
            <Text style={styles.permTitle}>{title}</Text>
            <Text style={styles.permDesc}>{description}</Text>
          </View>
          {granted ? (
            <CheckCircle2 size={22} color={Brand.success} />
          ) : (
            <ChevronRight size={22} color={Brand.muted} />
          )}
        </View>
      </GlassCard>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.midnight },
  container: { flexGrow: 1, padding: 24 },
  header: { alignItems: "center", marginBottom: 32, marginTop: 24 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Brand.textBright,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.muted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  permCard: { marginBottom: 14 },
  permCardGranted: { borderWidth: 1, borderColor: Brand.success },
  permRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  permText: { flex: 1 },
  permTitle: { fontSize: 16, fontWeight: "600", color: Brand.textBright },
  permDesc: { fontSize: 12, color: Brand.muted, marginTop: 4, lineHeight: 18 },

  continueBtn: {
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Brand.slateLight,
    marginTop: 12,
  },
  continueBtnReady: {
    backgroundColor: Brand.accent,
  },
  continueText: {
    fontSize: 17,
    fontWeight: "700",
    color: Brand.muted,
  },
  continueTextReady: {
    color: "#fff",
  },
  skipHint: {
    fontSize: 12,
    color: Brand.muted,
    textAlign: "center",
    marginTop: 12,
  },
  spacer: {
    flexGrow: 1,
    minHeight: 20,
  },
  guideContainer: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  guideHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: Brand.textBright,
    marginBottom: 16,
  },
  guideItem: {
    marginBottom: 16,
  },
  guideItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Brand.textBright,
    marginBottom: 4,
  },
  guideItemDesc: {
    fontSize: 13,
    color: Brand.muted,
    lineHeight: 18,
  },
});
