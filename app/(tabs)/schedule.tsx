/**
 * Schedule Screen – Doomscroll Detox
 *
 * Time-picker for the "Doom Zone" (e.g. 10:00 PM – 7:00 AM).
 * Uses a simple scroll-wheel style hour/minute picker built
 * entirely with React Native primitives.
 */
import { GlassCard } from "@/components/glass-card";
import { GlowToggle } from "@/components/glow-toggle";
import { Brand } from "@/constants/theme";
import { useAppCtx } from "@/contexts/app-state-context";
import { AlarmClock, Check } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// ── time formatting helper ─────────────────────────────────────
function formatTime(h: number, m: number, use24h: boolean) {
  if (use24h) return `${pad(h)}:${pad(m)}`;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${pad(m)} ${period}`;
}

export default function ScheduleScreen() {
  const { state, setSchedule, setUse24h } = useAppCtx();

  const [startHour, setStartHour] = useState(state.schedule.startHour);
  const [startMinute, setStartMinute] = useState(state.schedule.startMinute);
  const [endHour, setEndHour] = useState(state.schedule.endHour);
  const [endMinute, setEndMinute] = useState(state.schedule.endMinute);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSchedule({ startHour, startMinute, endHour, endMinute });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <AlarmClock size={26} color={Brand.accent} />
          <Text style={styles.heading}>Doom Zone</Text>
        </View>
        <Text style={styles.sub}>
          Set the hours when your shield activates automatically.
        </Text>

        {/* 24h / 12h toggle */}
        <GlassCard style={styles.card}>
          <View style={styles.formatRow}>
            <Text style={styles.formatLabel}>24-hour clock</Text>
            <GlowToggle
              value={state.use24h}
              onValueChange={setUse24h}
              activeColor={Brand.accent}
            />
          </View>
        </GlassCard>

        {/* Start time */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>Block starts at</Text>
          <Text style={styles.preview}>
            {formatTime(startHour, startMinute, state.use24h)}
          </Text>
          <View style={styles.pickerRow}>
            <PickerWheel
              data={HOURS}
              value={startHour}
              onChange={setStartHour}
              format={(v) => pad(v)}
            />
            <Text style={styles.colon}>:</Text>
            <PickerWheel
              data={MINUTES}
              value={startMinute}
              onChange={setStartMinute}
              format={(v) => pad(v)}
            />
          </View>
        </GlassCard>

        {/* End time */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>Block ends at</Text>
          <Text style={styles.preview}>
            {formatTime(endHour, endMinute, state.use24h)}
          </Text>
          <View style={styles.pickerRow}>
            <PickerWheel
              data={HOURS}
              value={endHour}
              onChange={setEndHour}
              format={(v) => pad(v)}
            />
            <Text style={styles.colon}>:</Text>
            <PickerWheel
              data={MINUTES}
              value={endMinute}
              onChange={setEndMinute}
              format={(v) => pad(v)}
            />
          </View>
        </GlassCard>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.8 },
            saved && { backgroundColor: Brand.success },
          ]}
        >
          {saved ? <Check size={18} color="#fff" /> : null}
          <Text style={styles.saveBtnText}>
            {saved ? "Saved!" : "Save Schedule"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Minimal horizontal picker ──────────────────────────────────
function PickerWheel({
  data,
  value,
  onChange,
  format,
}: {
  data: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wheelContent}
    >
      {data.map((item) => {
        const active = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[styles.wheelItem, active && styles.wheelItemActive]}
          >
            <Text style={[styles.wheelText, active && styles.wheelTextActive]}>
              {format(item)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── styles ─────────────────────────────────────────────────────
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
  card: { marginBottom: 18 },
  label: {
    fontSize: 13,
    color: Brand.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  preview: {
    fontSize: 28,
    fontWeight: "700",
    color: Brand.accent,
    marginBottom: 12,
  },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  colon: { fontSize: 22, color: Brand.muted, fontWeight: "600" },
  wheelContent: { gap: 6, paddingVertical: 4 },
  wheelItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Brand.glassBorder,
  },
  wheelItemActive: {
    backgroundColor: Brand.accent,
    borderColor: Brand.accent,
  },
  wheelText: {
    fontSize: 16,
    color: Brand.muted,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  wheelTextActive: { color: "#fff" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Brand.accent,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  formatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formatLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Brand.text,
  },
});
