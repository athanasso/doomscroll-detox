package com.doomscrolldetox;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import java.util.Calendar;

/**
 * DoomscrollForegroundService
 *
 * A minimal foreground service whose sole purpose is to keep the process alive
 * by showing a persistent (non-swipeable) notification.  This prevents MIUI
 * and other OEM battery optimizations from killing the process when the user
 * swipes the app away from recents.
 *
 * The notification text updates every 10 seconds to reflect the current
 * blocking state (Quick Shield on, scheduled block, or standing by).
 */
public class DoomscrollForegroundService extends Service {

    private static final String TAG = "DoomscrollA11y";
    private static final String CHANNEL_ID = "doomscroll_blocking";
    private static final int NOTIFICATION_ID = 9001;
    private static final String PREFS_NAME = "DoomscrollDetoxPrefs";
    private static final long UPDATE_INTERVAL_MS = 30_000;

    private Handler handler;
    private NotificationManager notificationManager;

    private final Runnable notificationUpdater = new Runnable() {
        @Override
        public void run() {
            updateNotification();
            if (handler != null) {
                handler.postDelayed(this, UPDATE_INTERVAL_MS);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        notificationManager = getSystemService(NotificationManager.class);
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "ForegroundService onStartCommand");

        Notification notification = buildNotification();
        try {
            startForeground(NOTIFICATION_ID, notification);
            Log.i(TAG, "ForegroundService started with notification");
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
        }

        // Start periodic notification updates
        handler.removeCallbacks(notificationUpdater);
        handler.postDelayed(notificationUpdater, UPDATE_INTERVAL_MS);

        // If the system kills the service, restart it
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "ForegroundService onTaskRemoved — staying alive");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "ForegroundService onDestroy");
        if (handler != null) {
            handler.removeCallbacks(notificationUpdater);
        }
        super.onDestroy();
    }

    private void updateNotification() {
        if (notificationManager != null) {
            Notification notification = buildNotification();
            // Re-post as foreground to prevent dismissal on Android 13+
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception e) {
                // Fallback: just update the notification
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Doomscroll Detox Blocking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the app-blocking service running in the background");
            channel.setShowBadge(false);

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0,
                launchIntent != null ? launchIntent : new Intent(),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Determine current blocking state
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean quickShield = prefs.getBoolean("blocking_active", false);
        boolean scheduled = isInSchedule(prefs);

        String title;
        String text;

        // Count enabled blocked apps via unique set to deduplicate
        java.util.HashSet<String> uniqueBlockedApps = new java.util.HashSet<>();
        try {
            org.json.JSONArray fullArr = new org.json.JSONArray(prefs.getString("blocked_packages_full", "[]"));
            for (int i = 0; i < fullArr.length(); i++) uniqueBlockedApps.add(fullArr.getString(i));
        } catch (Exception ignored) {}
        try {
            org.json.JSONArray feedArr = new org.json.JSONArray(prefs.getString("blocked_packages_feed", "[]"));
            for (int i = 0; i < feedArr.length(); i++) uniqueBlockedApps.add(feedArr.getString(i));
        } catch (Exception ignored) {}
        try {
            org.json.JSONObject antiObj = new org.json.JSONObject(prefs.getString("antiscroll_config", "{}"));
            java.util.Iterator<String> keys = antiObj.keys();
            while (keys.hasNext()) uniqueBlockedApps.add(keys.next());
        } catch (Exception ignored) {}
        
        int appCount = uniqueBlockedApps.size();
        String appLabel = appCount == 1 ? "1 app" : appCount + " apps";

        if (quickShield) {
            title = "\uD83D\uDEE1\uFE0F Shield Active";
            text = "Quick Shield is on \u2014 " + appLabel + " blocked";
        } else if (scheduled) {
            title = "\uD83C\uDF19 Bedtime Block Active";
            text = "Scheduled blocking is running \u2014 " + appLabel + " blocked";
        } else {
            title = "Doomscroll Detox";
            text = "Standing by \u2014 no apps are being blocked";
        }

        // Use the app's own notification icon (installed by expo-notifications plugin)
        int icon = getResources().getIdentifier(
                "notification_icon", "drawable", getPackageName());
        if (icon == 0) {
            // Fallback if the resource isn't found
            icon = android.R.drawable.ic_lock_lock;
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(icon)
                .setColor(0xFF818CF8) // Match the notification accent color
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();
    }

    private boolean isInSchedule(SharedPreferences prefs) {
        int startMinutes = prefs.getInt("schedule_start", -1);
        int endMinutes = prefs.getInt("schedule_end", -1);
        if (startMinutes < 0 || endMinutes < 0) return false;

        Calendar cal = Calendar.getInstance();
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        if (startMinutes <= endMinutes) return now >= startMinutes && now < endMinutes;
        return now >= startMinutes || now < endMinutes;
    }

    /**
     * Start this foreground service from any context.
     */
    public static void start(Context context) {
        try {
            Intent intent = new Intent(context, DoomscrollForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            Log.i(TAG, "ForegroundService start requested");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ForegroundService", e);
        }
    }
}
