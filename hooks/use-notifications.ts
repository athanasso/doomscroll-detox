/**
 * useNotifications — schedules a nightly bedtime reminder
 * and a morning "shield lifted" notification.
 */
import type { Schedule } from "@/hooks/use-app-state";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

// Configure how notifications appear when the app is foregrounded.
// Wrapped in try/catch because expo-notifications is unavailable in Expo Go (SDK 53+).
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Running in Expo Go — notifications not supported
}

/**
 * Schedules two daily notifications based on the user's Doom Zone schedule:
 *   1. "Shield activating" — at schedule start
 *   2. "Good morning" — at schedule end
 *
 * Re-schedules whenever the schedule changes.
 */
export function useNotifications(
  schedule: Schedule,
  enabled: boolean,
  blockedAppCount: number,
) {
  const didSetup = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    (async () => {
      try {
        // Request permission (Android 13+ needs runtime permission)
        if (Platform.OS === "android") {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== "granted") return;
        }

        // Cancel previous scheduled notifications
        await Notifications.cancelAllScheduledNotificationsAsync();

        const appLabel =
          blockedAppCount === 1 ? "1 app" : `${blockedAppCount} apps`;

        // Schedule "Shield activating" notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🛡️ Shield Activating",
            body: `Your Doom Zone is starting — ${appLabel} blocked. Time to wind down and rest.`,
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: schedule.startHour,
            minute: schedule.startMinute,
          },
        });

        // Schedule "Good morning" notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "☀️ Good Morning",
            body: "Your shield is lifted. Have a great day!",
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: schedule.endHour,
            minute: schedule.endMinute,
          },
        });

        didSetup.current = true;
      } catch {
        // expo-notifications unavailable (e.g. Expo Go SDK 53+)
      }
    })();
  }, [schedule, enabled, blockedAppCount]);
}
