# Doomscroll Detox

A digital wellness Android app that helps you break the doomscrolling habit. Set a bedtime schedule or activate an instant shield to block distracting social media apps — with smart detection that can target just Reels, Shorts, and feeds while leaving messaging and profiles accessible.

Built with **React Native / Expo** and a custom **Android Accessibility Service**.

## Features

### Bedtime Schedule (Doom Zone)

Set a daily window (e.g. 00:00 – 07:00) during which blocking is active. The schedule is enforced natively — it works even if the app is closed or the phone is restarted. Times are displayed in 24-hour format.

When a block is active, the dashboard countdown switches from "Next Bedtime Block in" to **"Block ends in"** with a live countdown to the end time.

### Quick Shield

One-tap toggle on the dashboard to activate blocking immediately, outside of scheduled hours.

### Smart Blocking Modes

For TikTok, Instagram, YouTube, and Facebook you can choose between:

- **Block Entire App** — the app is completely inaccessible during the block window.
- **Block Reels / Shorts** — only the addictive feed screens are blocked. Messaging, profiles, search, and other sections remain usable.

All other apps added from the installed-apps list are always fully blocked.

### Per-App Detection

| App           | Feed-mode behaviour                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TikTok**    | Blocks by default; allows Inbox, Profile, and Settings screens. Home and Friends tabs are visually hidden with overlays.                                           |
| **Instagram** | Blocks the Reels tab and stories viewer; Reels tab is visually hidden. Home feed, DMs, Profile, and Search stay open. Stories tray is covered by a sticky overlay. |
| **YouTube**   | Blocks Shorts player and shelf; Shorts tab is visually hidden. Home, Subscriptions, Library allowed.                                                               |
| **Facebook**  | Blocks Reels and Watch; Video/Watch tab is visually hidden. Home and Notifications allowed.                                                                        |

### Tab Overlay System

Forbidden tabs (e.g. TikTok Home/Friends, Instagram Reels, YouTube Shorts, Facebook Video/Watch) are visually hidden using `TYPE_ACCESSIBILITY_OVERLAY` windows that cover the tab buttons in the bottom navigation bar. The overlays:

- Appear instantly when a feed-mode app opens (no-throttle 2s initial window with delayed re-scans)
- Reposition smoothly via `updateViewLayout()` instead of teardown/rebuild
- Track scroll events so the Instagram stories tray overlay follows the content
- Are verified with UsageStats before removal to avoid false removals from notifications or toasts

### Custom App Blocking

Add any installed app to the block list from the **Apps** tab. Search by name or package name. Custom apps are always fully blocked.

### Breathing Exercise

When you try to open a blocked app, a calming full-screen modal appears with:

- An animated breathing circle (expand / contract)
- A 10-second forced cooldown before you can dismiss
- A gentle, non-judgmental message

### Schedule Picker

The schedule screen uses circular horizontal pickers — scrolling past 23 wraps to 00 and vice versa, making overnight schedules easy to set.

### Stats & Progress

- Minutes saved this week (derived from real Android usage data)
- Dopamine detours avoided
- Daily average
- Per-day bar charts (Mon–Sun)

Requires **Usage Stats** permission for real data; shows zeros otherwise.

### Daily Notifications

- **Shield Activating** — notification when your Doom Zone starts
- **Good Morning** — notification when it ends

### Dashboard Warnings

The home screen checks and warns about missing permissions:

- Accessibility Service
- Usage Stats access
- Battery optimization exemption

Each warning links directly to the relevant system settings page.

## Architecture

```
React Native (Expo)
  ├── app/(tabs)/         UI screens (Dashboard, Apps, Schedule, Stats)
  ├── hooks/              State management, native sync, notifications
  ├── components/         Glassmorphic cards, glow toggles, icons
  └── modules/            Type-safe JS ↔ Native bridge

Android Native (Java)
  ├── AccessibilityService   Real-time UI tree scanning & feed detection
  ├── PollReceiver           1-second alarm fallback (survives process death)
  ├── ForegroundService      Keeps process alive, shows status notification
  └── NativeModule           Bridge for permissions, usage stats, app list
```

### Three-Layer Blocking

1. **AccessibilityService** — fires on every UI event, scans the full view tree with `getRootInActiveWindow()` to detect which screen the user is on. Instant response.
2. **PollReceiver** — manifest-registered `BroadcastReceiver` triggered by `AlarmManager` every second. Queries the foreground app via `UsageStatsManager`. Catches idle scenarios where no accessibility events fire. Only handles full-block apps.
3. **ForegroundService** — persistent notification that prevents Android from killing the process. Re-calls `startForeground()` every 3 seconds so the notification cannot be permanently dismissed on Android 13+. Displays count of blocked apps.

If the user is already inside a blocked app when bedtime activates, they are removed within ~1 second.

## Requirements

- Android device (not Expo Go — requires a development build)
- Android 5.0+ (API 21+)
- Permissions: Accessibility Service, Usage Stats access, battery optimization exemption

## Getting Started

### Install dependencies

```bash
npm install
```

### Build the Android app

```bash
npx expo prebuild --clean
npx expo run:android
```

The Expo plugin (`withDoomscrollService`) automatically:

- Copies native Java files into the Android project
- Registers the Accessibility Service, PollReceiver, and ForegroundService in the manifest
- Adds all required permissions
- Configures package visibility queries (Android 11+)

### Development

```bash
npx expo start
```

> **Note:** Blocking features require a real Android device with a development build. Expo Go does not support custom native modules.

### Generate Icons

```bash
node scripts/generate-icons.js
```

Generates all app icons (main, adaptive foreground/background/monochrome, favicon, splash) using the brand palette.

## Tech Stack

- **React Native 0.81** / **Expo SDK 54** with New Architecture enabled
- **Expo Router** (file-based routing with typed routes)
- **React Native Reanimated** for animations
- **AsyncStorage** for state persistence
- **Lucide** for icons
- **Sharp** (dev) for icon generation
- Custom Android native module (Java) with Expo config plugin

## Brand

| Token      | Value                     |
| ---------- | ------------------------- |
| Background | `#0f172a` (midnight blue) |
| Accent     | `#818cf8` (indigo)        |
| Danger     | `#f87171`                 |
| Success    | `#34d399`                 |
| Glass      | `rgba(30, 41, 59, 0.65)`  |

## License

MIT
