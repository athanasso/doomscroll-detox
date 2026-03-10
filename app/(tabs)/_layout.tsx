/**
 * Tab Layout – Doomscroll Detox
 *
 * Four tabs: Dashboard, Apps, Schedule, Stats
 * Dark-mode first with the Brand palette.
 */
import { HapticTab } from "@/components/haptic-tab";
import { Brand } from "@/constants/theme";
import { Tabs } from "expo-router";
import { AlarmClock, BarChart3, Home, Smartphone } from "lucide-react-native";
import React from "react";
import { StyleSheet } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Brand.accent,
        tabBarInactiveTintColor: Brand.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Apps",
          tabBarIcon: ({ color, size }) => (
            <Smartphone size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <AlarmClock size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Brand.slate,
    borderTopColor: Brand.glassBorder,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
