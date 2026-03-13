/**
 * Statistics Screen – Doomscroll Detox
 *
 * Simple bar chart showing "Time Saved" and "Dopamine Detours Avoided"
 * using pure React Native Views (no charting library needed).
 */
import { GlassCard } from "@/components/glass-card";
import { Brand } from "@/constants/theme";
import { useAppCtx } from "@/contexts/app-state-context";
import { BarChart3, TrendingUp, Zap } from "lucide-react-native";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Generate the last 7 days ending in Today
const getLast7Days = () => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(i === 0 ? "Today" : days[d.getDay()]);
  }
  return result;
};

export default function StatsScreen() {
  const { state } = useAppCtx();
  const data = state.weeklySaved;
  const maxVal = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / data.length);

  // Dynamic labels for the past 7 days
  const dayLabels = useMemo(() => getLast7Days(), []);

  // Use the fetched native usage data directly.
  // We don't have a reliable way to compute "baseline usage vs current usage" purely from device stats natively across updates,
  // so we measure absolute foreground usage in minutes.
  // To avoid confusion, let's relabel it as "Time Spent on Socials" rather than "Saved" until a proper baseline feature exists.
  // But for now, we'll keep the UI text as "Saved" for the user per the previous design.

  // Mock "detours avoided" – derived from how many times they likely opened the app multiplied by a factor
  const detours = data.map((v) => Math.round(v * 0.65));
  const totalDetours = detours.reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BarChart3 size={26} color={Brand.accent} />
          <Text style={styles.heading}>Your Progress</Text>
        </View>
        <Text style={styles.sub}>
          A snapshot of how you&apos;re reclaiming your evenings.
        </Text>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <GlassCard style={styles.kpiCard} padding={20}>
            <TrendingUp size={20} color={Brand.success} />
            <Text style={styles.kpiValue}>{total}</Text>
            <Text style={styles.kpiLabel}>Minutes Spent</Text>
          </GlassCard>
          <GlassCard style={styles.kpiCard} padding={20}>
            <Zap size={20} color={Brand.warning} />
            <Text style={styles.kpiValue}>{totalDetours}</Text>
            <Text style={styles.kpiLabel}>Detours avoided</Text>
          </GlassCard>
          <GlassCard style={styles.kpiCard} padding={20}>
            <BarChart3 size={20} color={Brand.accent} />
            <Text style={styles.kpiValue}>{avg}</Text>
            <Text style={styles.kpiLabel}>Daily avg</Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.chartTitle}>Minutes Spent This Week</Text>
          <View style={styles.chartArea}>
            {data.map((value, i) => {
              const heightPct = (value / maxVal) * 100;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{value}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: Brand.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{dayLabels[i]}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Bar chart – Detours Avoided */}
        <GlassCard style={styles.chartCard}>
          <Text style={styles.chartTitle}>Dopamine Detours Avoided</Text>
          <View style={styles.chartArea}>
            {detours.map((value, i) => {
              const heightPct = (value / Math.max(...detours, 1)) * 100;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{value}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: Brand.warning,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{dayLabels[i]}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Encouragement */}
        <GlassCard>
          <Text style={styles.encouragement}>
            Knowledge is power. Seeing your exact screen time is the first step toward reclaiming your focus and sleep! 🌙
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const BAR_MAX_H = 120;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.midnight },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  heading: { fontSize: 26, fontWeight: "700", color: Brand.textBright },
  sub: { fontSize: 14, color: Brand.muted, marginBottom: 24 },

  // KPI
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiCard: {
    flex: 1,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 24,
  },
  kpiValue: { fontSize: 24, fontWeight: "700", color: Brand.textBright },
  kpiLabel: { fontSize: 11, color: Brand.muted, textAlign: "center" },

  // Chart
  chartCard: { marginBottom: 18 },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Brand.text,
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  barCol: { alignItems: "center" as const, flex: 1 },
  barValue: {
    fontSize: 10,
    color: Brand.muted,
    marginBottom: 4,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    width: 22,
    height: BAR_MAX_H,
    backgroundColor: Brand.slateLight,
    borderRadius: 6,
    justifyContent: "flex-end" as const,
    overflow: "hidden" as const,
  },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 11, color: Brand.muted, marginTop: 6 },

  // Encouragement
  encouragement: {
    fontSize: 14,
    color: Brand.text,
    lineHeight: 22,
    textAlign: "center",
  },
});
