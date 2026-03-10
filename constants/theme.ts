/**
 * Doomscroll Detox — Theme & Colors
 * Deep midnight blues, slate grays, and soft glow accents.
 */

import { Platform } from "react-native";

// ── Brand palette ──────────────────────────────────────────────
export const Brand = {
  /** Primary background */
  midnight: "#0f172a",
  /** Card / surface */
  slate: "#1e293b",
  /** Elevated surface */
  slateLight: "#334155",
  /** Muted text */
  muted: "#94a3b8",
  /** Primary text */
  text: "#e2e8f0",
  /** Bright text */
  textBright: "#f8fafc",
  /** Accent – calming indigo glow */
  accent: "#818cf8",
  /** Accent variant */
  accentSoft: "#6366f1",
  /** Success / positive */
  success: "#34d399",
  /** Warning / caution */
  warning: "#fbbf24",
  /** Danger / blocking */
  danger: "#f87171",
  /** Glass border */
  glassBorder: "rgba(148,163,184,0.15)",
  /** Glass background */
  glass: "rgba(30,41,59,0.65)",
} as const;

// ── Legacy theme support ──────────────────────────────────────
const tintColorLight = "#0a7ea4";
const tintColorDark = "#818cf8";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Brand.text,
    background: Brand.midnight,
    tint: tintColorDark,
    icon: Brand.muted,
    tabIconDefault: Brand.muted,
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
