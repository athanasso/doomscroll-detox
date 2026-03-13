import {
  getWeeklyUsage,
  syncBlockedApps,
  syncSchedule,
  isAccessibilityEnabled,
  hasUsageStatsPermission,
} from "@/modules/doomscroll-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────
export interface BlockedApp {
  id: string;
  name: string;
  /** Android package name, e.g. "com.instagram.android" */
  packageName: string;
  /** Block entire app, or block Reels/Shorts/feed tabs only */
  blockMode: "full" | "feed";
  enabled: boolean;
  allowFriendReels?: boolean;
  antiScrollEnabled?: boolean;
  antiScrollSeconds?: number;
  antiScrollWarningSeconds?: number;
}

export interface Schedule {
  /** 24-h hour, e.g. 22 = 10 PM */
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface AppState {
  quickShield: boolean;
  blockedApps: BlockedApp[];
  schedule: Schedule;
  /** Use 24-hour clock format (default: true) */
  use24h: boolean;
  /** Daily minutes saved – array (Mon→Sun), updated from real usage when possible */
  weeklySaved: number[];
  /** Whether onboarding has been completed */
  onboardingDone: boolean;
}

// ── Well-known package names ───────────────────────────────────
export const KNOWN_PACKAGES: Record<string, string> = {
  tiktok: "com.zhiliaoapp.musically",
  instagram: "com.instagram.android",
  youtube: "com.google.android.youtube",
  facebook: "com.facebook.katana",
};

// ── Brand colours for well-known apps ──────────────────────────
// Keyed by app id AND package name so custom-added apps also match.
export const APP_COLORS: Record<string, string> = {
  tiktok: "#69c9d0",
  "com.zhiliaoapp.musically": "#69c9d0",
  instagram: "#e1306c",
  "com.instagram.android": "#e1306c",
  youtube: "#ff0000",
  "com.google.android.youtube": "#ff0000",
  facebook: "#1877f2",
  "com.facebook.katana": "#1877f2",
  // Additional well-known apps
  reddit: "#ff4500",
  "com.reddit.frontpage": "#ff4500",
  twitter: "#1da1f2",
  "com.twitter.android": "#1da1f2",
  x: "#000000",
  snapchat: "#fffc00",
  "com.snapchat.android": "#fffc00",
  pinterest: "#e60023",
  "com.pinterest": "#e60023",
  linkedin: "#0a66c2",
  "com.linkedin.android": "#0a66c2",
  twitch: "#9146ff",
  "tv.twitch.android.app": "#9146ff",
  discord: "#5865f2",
  "com.discord": "#5865f2",
  telegram: "#26a5e4",
  "org.telegram.messenger": "#26a5e4",
  whatsapp: "#25d366",
  "com.whatsapp": "#25d366",
  threads: "#000000",
  "com.instagram.barcelona": "#000000",
  bluesky: "#0085ff",
  "xyz.blueskyweb.app": "#0085ff",
};

// ── Defaults ───────────────────────────────────────────────────
const DEFAULT_APPS: BlockedApp[] = [
  {
    id: "tiktok",
    name: "TikTok",
    packageName: KNOWN_PACKAGES.tiktok,
    blockMode: "full",
    enabled: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    packageName: KNOWN_PACKAGES.instagram,
    blockMode: "feed",
    enabled: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    packageName: KNOWN_PACKAGES.youtube,
    blockMode: "feed",
    enabled: false,
  },
  {
    id: "facebook",
    name: "Facebook",
    packageName: KNOWN_PACKAGES.facebook,
    blockMode: "full",
    enabled: false,
  },
];

const DEFAULT_SCHEDULE: Schedule = {
  startHour: 22,
  startMinute: 0,
  endHour: 7,
  endMinute: 0,
};

const DEFAULT_WEEKLY: number[] = [42, 55, 38, 61, 47, 70, 33];

const STORAGE_KEY = "@doomscroll_detox_state";

const DEFAULT_STATE: AppState = {
  quickShield: false,
  blockedApps: DEFAULT_APPS,
  schedule: DEFAULT_SCHEDULE,
  use24h: true,
  weeklySaved: DEFAULT_WEEKLY,
  onboardingDone: false,
};

// ── Hook ───────────────────────────────────────────────────────
export function useAppState() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const isMounted = useRef(true);

  // Load from AsyncStorage on mount
  useEffect(() => {
    isMounted.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        let hydratedState = { ...DEFAULT_STATE };
        if (raw) {
          hydratedState = { ...DEFAULT_STATE, ...JSON.parse(raw) };
        }
        
        // Anti-Backup Dirty Reinstall Protection:
        // If the system Google Drive auto-backup instantly restored our state
        // on a fresh install, `onboardingDone` might be true even though Android
        // wiped the real system permissions! We must query natively to confirm.
        if (hydratedState.onboardingDone) {
          const a11y = await isAccessibilityEnabled();
          const usage = await hasUsageStatsPermission();
          if (!a11y || !usage) {
             hydratedState.onboardingDone = false;
          }
        }
        
        if (isMounted.current) {
          setState(hydratedState);
        }
      } catch {
        // use defaults on crash
      } finally {
        if (isMounted.current) setLoaded(true);
      }
    })();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Persist whenever state changes (after initial load)
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // ── Updaters ───────────────────────────────────────────────
  const setQuickShield = useCallback(
    (v: boolean) => setState((s) => ({ ...s, quickShield: v })),
    [],
  );

  const setAppAllowFriendReels = useCallback(
    (id: string, allow: boolean) =>
      setState((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.id === id ? { ...a, allowFriendReels: allow } : a,
        ),
      })),
    [],
  );

  const setAppAntiScroll = useCallback(
    (id: string, enabled: boolean, seconds?: number, warningSeconds?: number) =>
      setState((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.id === id ? { 
            ...a, 
            antiScrollEnabled: enabled, 
            antiScrollSeconds: seconds ?? a.antiScrollSeconds ?? 300, 
            antiScrollWarningSeconds: warningSeconds ?? a.antiScrollWarningSeconds ?? 10 
          } : a,
        ),
      })),
    [],
  );

  const toggleApp = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.id === id ? { ...a, enabled: !a.enabled } : a,
        ),
      })),
    [],
  );

  const setAppBlockMode = useCallback(
    (id: string, mode: "full" | "feed") =>
      setState((s) => ({
        ...s,
        blockedApps: s.blockedApps.map((a) =>
          a.id === id ? { ...a, blockMode: mode } : a,
        ),
      })),
    [],
  );

  const setSchedule = useCallback(
    (schedule: Schedule) => setState((s) => ({ ...s, schedule })),
    [],
  );

  const setUse24h = useCallback(
    (v: boolean) => setState((s) => ({ ...s, use24h: v })),
    [],
  );

  const addApp = useCallback(
    (app: BlockedApp) =>
      setState((s) => {
        // Prevent duplicates based on packageName
        if (s.blockedApps.some((a) => a.packageName === app.packageName))
          return s;
        return { ...s, blockedApps: [...s.blockedApps, app] };
      }),
    [],
  );

  const removeApp = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        blockedApps: s.blockedApps.filter((a) => a.id !== id),
      })),
    [],
  );

  const setOnboardingDone = useCallback(
    (v: boolean) => setState((s) => ({ ...s, onboardingDone: v })),
    [],
  );

  // ── Sync blocked apps to native module whenever relevant state changes ──
  useEffect(() => {
    if (!loaded) return;
    // Pass quickShield as the "active" flag — the native AccessibilityService
    // independently checks the schedule from SharedPreferences, so we don't need
    // to compute isInDoomZone here (which wouldn't re-trigger at schedule boundaries).
    const shouldBlock = state.quickShield;

    const fullPkgs = state.blockedApps
      .filter((a) => a.enabled && a.blockMode === "full" && !a.antiScrollEnabled)
      .map((a) => a.packageName);
    const feedPkgs = state.blockedApps
      .filter((a) => a.enabled && a.blockMode === "feed" && !a.antiScrollEnabled)
      .map((a) => a.packageName);

    const allowFriendPkgs = state.blockedApps
      .filter((a) => a.enabled && a.allowFriendReels)
      .map((a) => a.packageName);

    const antiScrollConfig: Record<string, { s: number, w: number }> = {};
    state.blockedApps.forEach((a) => {
      if (a.enabled && a.antiScrollEnabled && a.antiScrollSeconds != null && a.antiScrollWarningSeconds != null) {
        antiScrollConfig[a.packageName] = { s: a.antiScrollSeconds, w: a.antiScrollWarningSeconds };
      }
    });

    // Only sync if onboarding is actually finished, preventing service starts before permissions
    if (!state.onboardingDone) return;
    
    syncBlockedApps(fullPkgs, feedPkgs, shouldBlock, allowFriendPkgs, JSON.stringify(antiScrollConfig)).catch(() => {});
  }, [state.blockedApps, state.quickShield, state.schedule, state.onboardingDone, loaded]);

  // ── Sync schedule to native so the AccessibilityService can check time ──
  useEffect(() => {
    if (!loaded) return;
    const startMinutes =
      state.schedule.startHour * 60 + state.schedule.startMinute;
    const endMinutes = state.schedule.endHour * 60 + state.schedule.endMinute;
    syncSchedule(startMinutes, endMinutes).catch(() => {});
  }, [state.schedule, loaded]);

  // ── Fetch real usage stats periodically ─────────────────────
  useEffect(() => {
    if (!loaded) return;
    const allPkgs = state.blockedApps.map((a) => a.packageName);
    if (allPkgs.length === 0) return;

    const fetchUsage = () => {
      getWeeklyUsage(allPkgs)
        .then((usage) => {
          if (usage && usage.length === 7) {
            setState((s) => ({ ...s, weeklySaved: usage }));
          }
        })
        .catch(() => {});
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [loaded, state.blockedApps]);

  return {
    state,
    loaded,
    setQuickShield,
    setAppAllowFriendReels,
    setAppAntiScroll,
    toggleApp,
    setAppBlockMode,
    setSchedule,
    setUse24h,
    addApp,
    removeApp,
    setOnboardingDone,
  };
}
