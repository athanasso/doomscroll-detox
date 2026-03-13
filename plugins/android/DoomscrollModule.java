package com.doomscrolldetox;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.PowerManager;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * DoomscrollModule
 *
 * React Native bridge module that exposes:
 *   - Blocking control (syncs blocked list to SharedPrefs for A11yService)
 *   - Accessibility-service status check & settings opener
 *   - App icon retrieval (base64 PNG from PackageManager)
 *   - Installed-apps listing
 *   - Usage-stats queries (Android UsageStatsManager)
 */
public class DoomscrollModule extends ReactContextBaseJavaModule {

    private static final String TAG = "DoomscrollModule";
    private static final String PREFS_NAME = "DoomscrollDetoxPrefs";

    public DoomscrollModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "DoomscrollModule";
    }

    // ── Blocking control ──────────────────────────────────────

    /**
     * Sync the blocked-packages lists into SharedPreferences so the
     * AccessibilityService can read them.
     *
     * @param fullPackages  JSON array of package names to fully block
     * @param feedPackages  JSON array of package names to block Reels/Shorts only
     * @param active        Whether blocking is currently active
     */
    @ReactMethod
    public void syncBlockedApps(ReadableArray fullPackages, ReadableArray feedPackages, boolean active, ReadableArray allowFriendPkgs, String antiScrollConfigJson, Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            SharedPreferences prefs = ctx
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

            JSONArray fullArr = new JSONArray();
            for (int i = 0; i < fullPackages.size(); i++) {
                fullArr.put(fullPackages.getString(i));
            }

            JSONArray feedArr = new JSONArray();
            for (int i = 0; i < feedPackages.size(); i++) {
                feedArr.put(feedPackages.getString(i));
            }

            JSONArray allowArr = new JSONArray();
            for (int i = 0; i < allowFriendPkgs.size(); i++) {
                allowArr.put(allowFriendPkgs.getString(i));
            }

            prefs.edit()
                    .putString("blocked_packages_full", fullArr.toString())
                    .putString("blocked_packages_feed", feedArr.toString())
                    .putBoolean("blocking_active", active)
                    .putString("allow_friend_packages", allowArr.toString())
                    .putString("antiscroll_config", antiScrollConfigJson)
                    .apply();

            // Restart foreground service to refresh notification text
            DoomscrollForegroundService.start(ctx);

            // Start or stop poll alarm based on blocking state
            if (active || isInSchedule(prefs)) {
                DoomscrollPollReceiver.scheduleNext(ctx);
            } else {
                DoomscrollPollReceiver.cancelAlarm(ctx);
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SYNC_ERROR", e.getMessage());
        }
    }

    // ── Accessibility service status ──────────────────────────

    /**
     * Sync the doom-zone schedule into SharedPreferences so the
     * AccessibilityService can decide blocking based on time of day.
     *
     * @param startMinutes  Minutes since midnight for schedule start (e.g. 22*60 = 1320)
     * @param endMinutes    Minutes since midnight for schedule end (e.g. 7*60 = 420)
     */
    @ReactMethod
    public void syncSchedule(int startMinutes, int endMinutes, Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            SharedPreferences prefs = ctx
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putInt("schedule_start", startMinutes)
                    .putInt("schedule_end", endMinutes)
                    .apply();

            // Start or stop poll alarm based on updated schedule
            boolean quickShield = prefs.getBoolean("blocking_active", false);
            if (quickShield || isInSchedule(prefs)) {
                DoomscrollPollReceiver.scheduleNext(ctx);
            } else {
                DoomscrollPollReceiver.cancelAlarm(ctx);
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SYNC_ERROR", e.getMessage());
        }
    }

    /** Helper: check if the current time falls within the saved schedule */
    private boolean isInSchedule(SharedPreferences prefs) {
        int startMinutes = prefs.getInt("schedule_start", -1);
        int endMinutes = prefs.getInt("schedule_end", -1);
        if (startMinutes < 0 || endMinutes < 0) return false;
        Calendar cal = Calendar.getInstance();
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        if (startMinutes <= endMinutes) return now >= startMinutes && now < endMinutes;
        return now >= startMinutes || now < endMinutes;
    }

    // ── Accessibility service status ──────────────────────────

    @ReactMethod
    public void isAccessibilityEnabled(Promise promise) {
        try {
            String enabledServices = Settings.Secure.getString(
                    getReactApplicationContext().getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            boolean enabled = enabledServices != null
                    && enabledServices.contains(getReactApplicationContext().getPackageName());
            promise.resolve(enabled);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("NAV_ERROR", e.getMessage());
        }
    }

    // ── Battery optimization ──────────────────────────────────

    @ReactMethod
    public void isBatteryOptimized(Promise promise) {
        try {
            PowerManager pm = (PowerManager) getReactApplicationContext()
                    .getSystemService(Context.POWER_SERVICE);
            boolean optimized = pm.isIgnoringBatteryOptimizations(
                    getReactApplicationContext().getPackageName());
            // returns true if we ARE optimized (i.e. NOT ignoring)
            promise.resolve(!optimized);
        } catch (Exception e) {
            promise.resolve(true); // Assume optimized if can't check
        }
    }

    @ReactMethod
    public void requestIgnoreBatteryOptimizations(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            // Fallback: open general battery optimization settings
            try {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(fallback);
                promise.resolve(true);
            } catch (Exception e2) {
                promise.reject("NAV_ERROR", e2.getMessage());
            }
        }
    }

    // ── Usage stats ───────────────────────────────────────────

    @ReactMethod
    public void hasUsageStatsPermission(Promise promise) {
        try {
            UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext()
                    .getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            List<UsageStats> stats = usm.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, now - 60_000, now);
            promise.resolve(stats != null && !stats.isEmpty());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void openUsageStatsSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("NAV_ERROR", e.getMessage());
        }
    }

    /**
     * Returns daily usage totals (in minutes) for the last 7 days.
     * Sums foreground time for all blocked packages.
     */
    @ReactMethod
    public void getWeeklyUsage(ReadableArray packageNames, Promise promise) {
        try {
            UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext()
                    .getSystemService(Context.USAGE_STATS_SERVICE);

            WritableArray result = Arguments.createArray();
            Calendar cal = Calendar.getInstance();
            cal.set(Calendar.HOUR_OF_DAY, 0);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);

            // Go back 6 days (7 days total including today)
            cal.add(Calendar.DAY_OF_YEAR, -6);

            for (int day = 0; day < 7; day++) {
                long dayStart = cal.getTimeInMillis();
                cal.add(Calendar.DAY_OF_YEAR, 1);
                long dayEnd = cal.getTimeInMillis();

                Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(dayStart, dayEnd);

                long totalMs = 0;
                if (statsMap != null) {
                    for (int i = 0; i < packageNames.size(); i++) {
                        String pkg = packageNames.getString(i);
                        UsageStats us = statsMap.get(pkg);
                        if (us != null) {
                            totalMs += us.getTotalTimeInForeground();
                        }
                    }
                }

                result.pushInt((int) (totalMs / 60_000)); // convert to minutes
            }

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("USAGE_ERROR", e.getMessage());
        }
    }

    // ── App icon retrieval ────────────────────────────────────

    /**
     * Returns a base64-encoded PNG of the app icon for the given package name.
     * Returns null if the package is not installed.
     */
    @ReactMethod
    public void getAppIcon(String packageName, int sizePx, Promise promise) {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Drawable icon = pm.getApplicationIcon(packageName);

            Bitmap bitmap;
            if (icon instanceof BitmapDrawable) {
                bitmap = ((BitmapDrawable) icon).getBitmap();
            } else {
                bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                icon.setBounds(0, 0, sizePx, sizePx);
                icon.draw(canvas);
            }

            // Scale to requested size
            Bitmap scaled = Bitmap.createScaledBitmap(bitmap, sizePx, sizePx, true);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.PNG, 100, baos);
            String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

            promise.resolve("data:image/png;base64," + b64);
        } catch (PackageManager.NameNotFoundException e) {
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ICON_ERROR", e.getMessage());
        }
    }

    // ── Installed apps listing ────────────────────────────────

    /**
     * Returns a list of all launchable apps with their
     * package name and display label.
     * Uses the launcher intent query to find apps on Android 11+.
     */
    @ReactMethod
    public void getInstalledApps(Promise promise) {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Intent launchIntent = new Intent(Intent.ACTION_MAIN);
            launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);

            List<android.content.pm.ResolveInfo> activities = pm.queryIntentActivities(launchIntent, 0);
            WritableArray result = Arguments.createArray();
            Set<String> seen = new HashSet<>();

            for (android.content.pm.ResolveInfo ri : activities) {
                String pkg = ri.activityInfo.packageName;
                if (seen.contains(pkg)) continue;
                seen.add(pkg);

                // Skip our own app
                if (pkg.equals(getReactApplicationContext().getPackageName())) continue;

                WritableMap map = Arguments.createMap();
                map.putString("packageName", pkg);
                map.putString("name", ri.loadLabel(pm).toString());
                result.pushMap(map);
            }

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("LIST_ERROR", e.getMessage());
        }
    }
}
