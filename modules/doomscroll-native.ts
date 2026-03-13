/**
 * JS bridge to the DoomscrollModule native Android module.
 *
 * On non-Android platforms (web, iOS) every method is a safe no-op / returns
 * sensible defaults so the app never crashes.
 */
import { Linking, NativeModules, Platform } from "react-native";

interface InstalledApp {
  packageName: string;
  name: string;
}

// Shape of the native module (or stubs)
interface NativeModType {
  syncBlockedApps: (
    fullPkgs: string[],
    feedPkgs: string[],
    active: boolean,
    allowFriendPkgs: string[],
    antiScrollConfigJson: string,
  ) => Promise<boolean>;
  isAccessibilityEnabled: () => Promise<boolean>;
  openAccessibilitySettings: () => Promise<boolean>;
  hasUsageStatsPermission: () => Promise<boolean>;
  openUsageStatsSettings: () => Promise<boolean>;
  getWeeklyUsage: (packageNames: string[]) => Promise<number[]>;
  getAppIcon: (packageName: string, sizePx: number) => Promise<string | null>;
  getInstalledApps: () => Promise<InstalledApp[]>;
  syncSchedule: (startMinutes: number, endMinutes: number) => Promise<boolean>;
  isBatteryOptimized: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations: () => Promise<boolean>;
}

// Stubs used when the native module is unavailable (Expo Go, non-Android)
const STUBS: NativeModType = {
  syncBlockedApps: async () => true,
  isAccessibilityEnabled: async () => false,
  openAccessibilitySettings: async () => {
    // Fallback: open Android Accessibility Settings via Linking
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS");
    }
    return false;
  },
  hasUsageStatsPermission: async () => false,
  openUsageStatsSettings: async () => {
    // Fallback: open Android Usage Access Settings via Linking
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS");
    }
    return false;
  },
  getWeeklyUsage: async () => [0, 0, 0, 0, 0, 0, 0],
  getAppIcon: async () => null,
  getInstalledApps: async () => [],
  syncSchedule: async () => true,
  isBatteryOptimized: async () => false,
  requestIgnoreBatteryOptimizations: async () => false,
};

// NativeModules.DoomscrollModule is null in Expo Go even on Android,
// so we always fall back to stubs when it's not available.
export const hasNativeModule =
  Platform.OS === "android" && NativeModules.DoomscrollModule != null;

const NativeMod: NativeModType = hasNativeModule
  ? (NativeModules.DoomscrollModule as NativeModType)
  : STUBS;

// ── Public API ────────────────────────────────────────────────

export async function syncBlockedApps(
  fullPackages: string[],
  feedPackages: string[],
  active: boolean,
  allowFriendPkgs: string[],
  antiScrollConfigJson: string,
): Promise<void> {
  await NativeMod.syncBlockedApps(fullPackages, feedPackages, active, allowFriendPkgs, antiScrollConfigJson);
}

export async function isAccessibilityEnabled(): Promise<boolean> {
  return NativeMod.isAccessibilityEnabled();
}

export async function openAccessibilitySettings(): Promise<void> {
  await NativeMod.openAccessibilitySettings();
}

export async function hasUsageStatsPermission(): Promise<boolean> {
  return NativeMod.hasUsageStatsPermission();
}

export async function openUsageStatsSettings(): Promise<void> {
  await NativeMod.openUsageStatsSettings();
}

export async function getWeeklyUsage(
  packageNames: string[],
): Promise<number[]> {
  return NativeMod.getWeeklyUsage(packageNames);
}

export async function getAppIcon(
  packageName: string,
  sizePx = 96,
): Promise<string | null> {
  return NativeMod.getAppIcon(packageName, sizePx);
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  const apps = await NativeMod.getInstalledApps();
  // Sort alphabetically
  return [...apps].sort((a, b) => a.name.localeCompare(b.name));
}

export async function syncSchedule(
  startMinutes: number,
  endMinutes: number,
): Promise<void> {
  await NativeMod.syncSchedule(startMinutes, endMinutes);
}

export async function isBatteryOptimized(): Promise<boolean> {
  return NativeMod.isBatteryOptimized();
}

export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  await NativeMod.requestIgnoreBatteryOptimizations();
}
