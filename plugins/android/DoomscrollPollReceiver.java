package com.doomscrolldetox;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * DoomscrollPollReceiver
 *
 * Manifest-registered BroadcastReceiver that fires every second via
 * AlarmManager. Because it's registered in the manifest (not dynamically),
 * it survives process death — Android will start the process to deliver
 * the broadcast even after MIUI kills the app.
 *
 * On each alarm:
 * 1) Acquire a short WakeLock so the CPU stays on
 * 2) Check UsageStats for the foreground app
 * 3) If it's blocked, launch HOME intent to kick the user out
 * 4) Schedule the next alarm
 */
public class DoomscrollPollReceiver extends BroadcastReceiver {

    private static final String TAG = "DoomscrollA11y";
    static final String ACTION_POLL = "com.doomscrolldetox.ACTION_POLL";
    private static final String PREFS_NAME = "DoomscrollDetoxPrefs";
    private static final long POLL_INTERVAL_MS = 5000;

    private static long pollCount = 0;
    private static long lastBlockTime = 0;
    private static final long BLOCK_COOLDOWN_MS = 500;

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            pollCount++;
            if (pollCount % 60 == 1) {
                Log.i(TAG, "PollReceiver #" + pollCount);
            }

            // Only do work and reschedule if blocking is active
            if (isBlockingActive(context)) {
                doCheck(context);
                scheduleNext(context);
            } else {
                // Blocking not active — stop polling to save battery.
                // Polling will be restarted when blocking is toggled on.
                if (pollCount % 60 == 1) {
                    Log.i(TAG, "PollReceiver: blocking not active, stopping alarm chain");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "PollReceiver error", e);
        }
    }

    private void doCheck(Context context) {

        String fg = queryCurrentForeground(context);
        if (fg == null || fg.isEmpty())
            return;
        if (isOurApp(context, fg))
            return;

        Set<String> blocked = getBlockedPackages(context);
        if (blocked.contains(fg)) {
            long now = System.currentTimeMillis();
            if (now - lastBlockTime < BLOCK_COOLDOWN_MS)
                return;
            lastBlockTime = now;

            Log.i(TAG, ">>> POLL-BLOCK " + fg);

            // Launch HOME intent — works without AccessibilityService
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(homeIntent);
        }
    }

    private String queryCurrentForeground(Context context) {
        try {
            UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null)
                return null;

            long now = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(now - 5000, now);
            if (events == null)
                return null;

            UsageEvents.Event ev = new UsageEvents.Event();
            String fg = null;

            while (events.hasNextEvent()) {
                events.getNextEvent(ev);
                int type = ev.getEventType();
                // 1 = MOVE_TO_FOREGROUND, 7 = ACTIVITY_RESUMED
                if (type == 1 || type == 7) {
                    fg = ev.getPackageName();
                }
            }
            return fg;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isBlockingActive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (prefs.getBoolean("blocking_active", false))
            return true;

        int startMinutes = prefs.getInt("schedule_start", -1);
        int endMinutes = prefs.getInt("schedule_end", -1);
        if (startMinutes < 0 || endMinutes < 0)
            return false;

        Calendar cal = Calendar.getInstance();
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        if (startMinutes <= endMinutes)
            return now >= startMinutes && now < endMinutes;
        return now >= startMinutes || now < endMinutes;
    }

    /**
     * Returns only FULLY blocked packages (not feed-mode ones).
     * The PollReceiver can only detect the foreground package, not the specific
     * screen within the app, so feed-mode blocking (Shorts/Reels detection)
     * must be handled by the AccessibilityService which has UI context.
     */
    private Set<String> getBlockedPackages(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> blocked = new HashSet<>();
        try {
            JSONArray fullArr = new JSONArray(prefs.getString("blocked_packages_full", "[]"));
            for (int i = 0; i < fullArr.length(); i++)
                blocked.add(fullArr.getString(i));
            // NOTE: Feed-mode packages are intentionally NOT included here.
            // The poll receiver can't distinguish between Shorts vs Home, Reels vs DMs,
            // etc.
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing blocked packages", e);
        }
        return blocked;
    }

    private boolean isOurApp(Context context, String pkg) {
        if (pkg == null)
            return false;
        return pkg.equals(context.getPackageName())
                || pkg.equals("com.athanasso.doomscrolldetox")
                || pkg.equals("com.doomscrolldetox");
    }

    // ── Alarm scheduling (static so the service can also call it) ──

    static void scheduleNext(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;

        Intent intent = new Intent(ACTION_POLL);
        intent.setPackage(context.getPackageName());
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        long triggerAt = SystemClock.elapsedRealtime() + POLL_INTERVAL_MS;
        try {
            am.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        }
    }

    static void cancelAlarm(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;
        Intent intent = new Intent(ACTION_POLL);
        intent.setPackage(context.getPackageName());
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
    }
}
