package com.doomscrolldetox;

import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONException;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Rect;
import android.net.Uri;
import android.os.PowerManager;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/**
 * DoomscrollAccessibilityService
 *
 * Uses getRootInActiveWindow() to scan the FULL UI tree of the foreground app
 * and determine which screen/tab the user is on. This is far more reliable
 * than checking event.getSource() which only gives the triggering node.
 *
 * Feed-mode detection strategy:
 * - TikTok/Instagram: Block by default, allow only if a "safe" tab
 * (Inbox, Profile, etc.) is detected as selected in the bottom nav.
 * - YouTube: Block only when Shorts tab/content is detected.
 * - Facebook: Block only when Reels/Watch content is detected.
 *
 * When blocking feed content, the service tries to click the app's
 * messaging/inbox tab directly. Falls back to GLOBAL_ACTION_BACK.
 */
public class DoomscrollAccessibilityService extends AccessibilityService {

    private static final String TAG = "DoomscrollA11y";
    private static final String PREFS_NAME = "DoomscrollDetoxPrefs";
    private static final String KEY_BLOCKED_FULL = "blocked_packages_full";
    private static final String KEY_BLOCKED_FEED = "blocked_packages_feed";
    private static final String KEY_BLOCKING_ACTIVE = "blocking_active";
    private static final String KEY_SCHEDULE_START = "schedule_start";
    private static final String KEY_SCHEDULE_END = "schedule_end";

    private static final long BLOCK_COOLDOWN_MS = 500;
    private static final long FEED_CHECK_THROTTLE_MS = 300;

    private static final long PREFS_REFRESH_INTERVAL_MS = 2000;
    private static final long USAGE_CHECK_THROTTLE_MS = 400;
    private final Set<String> blockedFullPackages = new HashSet<>();
    private final Set<String> blockedFeedPackages = new HashSet<>();
    private long lastBlockTime = 0;
    private String myAppPackage = "";
    private String lastEventPkg = "";
    private long lastEventMillis = 0;

    private long lastPrefsRefresh = 0;

    private PowerManager.WakeLock wakeLock;
    // Track the current foreground activity class name (set on
    // WINDOW_STATE_CHANGED)
    private String currentFgActivity = "";

    // Track the current foreground package
    private String currentFgPackage = "";
    // Throttle feed screen checks to avoid excessive tree scanning
    private long lastFeedCheckMs = 0;
    private boolean lastFeedCheckResult = false;

    private String lastFeedCheckPkg = "";

    // ── Lifecycle ─────────────────────────────────────────────

    // YouTube Shorts state tracking
    private boolean youtubeInShorts = false;

    // Instagram redirect grace period — after redirecting to DMs,
    // skip feed checks for a short window so the DM screen can load.
    private long instagramRedirectTime = 0;
    private static final long INSTAGRAM_GRACE_MS = 2500;

    private long lastUsageCheckMillis = 0;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        myAppPackage = getPackageName();
        Log.i(TAG, "Service connected. myPkg=" + myAppPackage);

        try {
            AccessibilityServiceInfo info = new AccessibilityServiceInfo();
            info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
            info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
            info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                    | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
                    | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            info.notificationTimeout = 50;
            setServiceInfo(info);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set service info", e);
        }

        refreshBlockedPackages();
        Log.i(TAG, "Initial blocks: full=" + blockedFullPackages + " feed=" + blockedFeedPackages);

        DoomscrollForegroundService.start(this);

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                    "DoomscrollDetox::PollingLock");
            wakeLock.acquire();
            Log.i(TAG, "WakeLock acquired");
        }

        DoomscrollPollReceiver.scheduleNext(this);
        Log.i(TAG, "Alarm polling started");
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy called");
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.i(TAG, "WakeLock released");
        }
    }

    // ── Accessibility events ─────────────────────────────────

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "onTaskRemoved — service stays alive");
    }

    // ── UsageStats-based foreground check ─────────────────────

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Service interrupted");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null)
            return;

        String pkg = event.getPackageName().toString();
        if (pkg.equals("android") || pkg.startsWith("com.android.systemui"))
            return;

        int eventType = event.getEventType();
        boolean isWindowChanged = (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED);
        String cls = event.getClassName() != null ? event.getClassName().toString() : "";

        if (isWindowChanged) {
            lastEventPkg = pkg;
            lastEventMillis = System.currentTimeMillis();
            currentFgPackage = pkg;
            currentFgActivity = cls;
            Log.i(TAG, "EVENT fg=" + pkg + " cls=" + cls);

            // Reset YouTube Shorts state when leaving YouTube
            if (!pkg.equals("com.google.android.youtube")) {
                youtubeInShorts = false;
            }
            // Reset feed check cache on window change
            lastFeedCheckPkg = "";
        }

        if (!isOurApp(pkg)) {
            maybeRefreshPrefs();
            if (isBlockingActive()) {
                tryBlock(pkg, cls, event, isWindowChanged ? "event" : "content");
            }
        }

        checkViaUsageStats();
    }

    private void checkViaUsageStats() {
        long now = System.currentTimeMillis();
        if (now - lastUsageCheckMillis < USAGE_CHECK_THROTTLE_MS)
            return;
        lastUsageCheckMillis = now;

        maybeRefreshPrefs();
        if (!isBlockingActive())
            return;

        String fg = queryCurrentForeground();
        if (fg == null || fg.isEmpty())
            return;
        if (isOurApp(fg))
            return;

        if (now - lastEventMillis < 1500 && !lastEventPkg.isEmpty()
                && !lastEventPkg.equals(fg) && !isBlocked(lastEventPkg)) {
            return;
        }

        if (isBlocked(fg)) {
            Log.i(TAG, "USAGE fg=" + fg + " -> blocked");
            tryBlock(fg, "", null, "usage");
        }
    }

    private boolean isBlocked(String pkg) {
        return blockedFullPackages.contains(pkg) || blockedFeedPackages.contains(pkg);
    }

    // ── Core blocking ─────────────────────────────────────────

    private void tryBlock(String pkg, String className,
            AccessibilityEvent event, String source) {

        boolean isFullTarget = blockedFullPackages.contains(pkg);
        boolean isFeedTarget = blockedFeedPackages.contains(pkg);
        if (!isFullTarget && !isFeedTarget)
            return;

        long now = System.currentTimeMillis();
        if (now - lastBlockTime < BLOCK_COOLDOWN_MS)
            return;

        if (isFullTarget) {
            Log.i(TAG, ">>> BLOCK [" + source + "] " + pkg);
            lastBlockTime = now;
            performGlobalAction(GLOBAL_ACTION_BACK);
            performGlobalAction(GLOBAL_ACTION_HOME);
            return;
        }

        // Feed-mode: use full UI tree scanning
        if (isFeedTarget) {
            if (isFeedScreen(pkg)) {
                Log.i(TAG, ">>> BLOCK FEED [" + source + "] " + pkg);
                lastBlockTime = now;
                redirectToSafeScreen(pkg);
            }
        }
    }

    // ── Feed screen detection using getRootInActiveWindow() ───

    /**
     * Determines if the user is currently on a "feed" screen (reels, shorts,
     * home feed, etc.) by scanning the FULL UI tree via getRootInActiveWindow().
     *
     * This is throttled to avoid excessive IPC overhead.
     */
    private boolean isFeedScreen(String pkg) {
        // No throttle caching — always do a fresh check.
        // Stale cache caused Reels to slip through after initial detection.

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            // Can't scan the tree; use activity-class fallback
            return isFeedByActivityClass(pkg);
        }

        try {
            boolean result;
            switch (pkg) {
                case "com.zhiliaoapp.musically":
                    result = isTikTokFeed(root);
                    break;
                case "com.instagram.android":
                    result = isInstagramFeed(root);
                    break;
                case "com.google.android.youtube":
                    result = isYoutubeShorts(root);
                    break;
                case "com.facebook.katana":
                    result = isFacebookReels(root);
                    break;
                default:
                    result = isGenericReels(root);
                    break;
            }
            return result;
        } finally {
            root.recycle();
        }
    }

    /**
     * Fallback: if we can't get the root window, check the activity class name.
     */
    private boolean isFeedByActivityClass(String pkg) {
        String cls = currentFgActivity.toLowerCase();
        if (pkg.equals("com.zhiliaoapp.musically")) {
            // TikTok: block unless the activity is clearly messaging
            return !cls.contains("inbox") && !cls.contains("message")
                    && !cls.contains("profile") && !cls.contains("setting");
        }
        if (pkg.equals("com.instagram.android")) {
            // Only block reels-specific screens, not home
            return cls.contains("reel");
        }
        if (pkg.equals("com.google.android.youtube")) {
            return cls.contains("shorts") || youtubeInShorts;
        }
        if (pkg.equals("com.facebook.katana")) {
            return cls.contains("reel") || cls.contains("watch");
        }
        return false;
    }

    // ── TikTok feed detection ─────────────────────────────────

    /**
     * TikTok strategy: Scan the whole tree for bottom nav tab indicators.
     * If a "safe" tab (Inbox, Profile) is selected/active → not feed.
     * If a "feed" tab (Home, Friends) is selected/active → feed.
     * Also check for "For You" text which only appears on the main feed.
     * Default: block (conservative).
     */
    private boolean isTikTokFeed(AccessibilityNodeInfo root) {
        // Strategy: detect safe screens first, feed screens second,
        // default to BLOCK on main activity.
        String cls = currentFgActivity.toLowerCase();

        // Step 1: Activity class safe screens
        if (cls.contains("inbox") || cls.contains("message") || cls.contains("chat")
                || cls.contains("profile") || cls.contains("setting")
                || cls.contains("camera") || cls.contains("record")
                || cls.contains("editor") || cls.contains("search")
                || cls.contains("live") || cls.contains("comment")) {
            Log.d(TAG, "TikTok: safe activity class → not feed");
            return false;
        }

        // Step 2: Content-based safe screen detection
        // "Edit profile" / "Share profile" only appear on profile page
        if (hasTextInTree(root, "Edit profile") || hasTextInTree(root, "Share profile")) {
            Log.d(TAG, "TikTok: profile content → not feed");
            return false;
        }
        // "All activity" only appears on inbox screen
        if (hasTextInTree(root, "All activity")) {
            Log.d(TAG, "TikTok: inbox content → not feed");
            return false;
        }

        // Step 3: Tab-based safe screen detection
        if (isTabSelected(root, "Inbox") || isTabSelected(root, "Profile")) {
            Log.d(TAG, "TikTok: safe tab selected → not feed");
            return false;
        }

        // Step 4: Definitive feed detection
        if (hasTextInTree(root, "For You")) {
            Log.d(TAG, "TikTok: 'For You' text → feed");
            return true;
        }

        // Step 5: Tab-based feed detection
        if (isTabSelected(root, "Home") || isTabSelected(root, "Friends")) {
            Log.d(TAG, "TikTok: feed tab selected → feed");
            return true;
        }

        // Step 6: Default — block on main activity
        // This catches Friends tab where neither "For You" nor tab selection
        // is detectable, but we're still on the main video-feed activity
        if (cls.contains("mainactivity") || cls.contains("aweme") || cls.isEmpty()) {
            Log.d(TAG, "TikTok: main activity, defaulting to BLOCK");
            return true;
        }

        return false;
    }

    // ── Instagram feed detection ──────────────────────────────

    /**
     * Instagram strategy: ONLY block the Reels tab.
     * Everything else (Home, DMs, Profile, Search) is allowed.
     */
    private boolean isInstagramFeed(AccessibilityNodeInfo root) {
        // Grace period: after blocking, skip feed checks briefly
        if (System.currentTimeMillis() - instagramRedirectTime < INSTAGRAM_GRACE_MS) {
            Log.d(TAG, "Instagram: in redirect grace period → not feed");
            return false;
        }

        // Check if Reels tab is selected
        if (isTabSelected(root, "Reels")) {
            Log.d(TAG, "Instagram: Reels tab selected → feed");
            return true;
        }

        // Check for reels-specific view IDs
        if (hasViewIdInTree(root, "clips_viewer") || hasViewIdInTree(root, "reel_viewer")) {
            Log.d(TAG, "Instagram: reels viewer found → feed");
            return true;
        }

        // Check activity class for reels-specific screens
        String cls = currentFgActivity.toLowerCase();
        if (cls.contains("reel") || cls.contains("clips")) {
            Log.d(TAG, "Instagram: reels activity class → feed");
            return true;
        }

        return false;
    }

    // ── YouTube Shorts detection ──────────────────────────────

    /**
     * YouTube strategy: Only block Shorts, allow everything else.
     * Detect via: ShortsActivity class, "Shorts" selected tab, and
     * Shorts-specific views in the hierarchy.
     */
    private boolean isYoutubeShorts(AccessibilityNodeInfo root) {
        // 1. Check activity class (most reliable when available)
        String cls = currentFgActivity.toLowerCase();
        if (cls.contains("shorts")) {
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: ShortsActivity class → shorts");
            return true;
        }

        // 2. Check if the Shorts tab is selected in bottom nav
        if (isTabSelected(root, "Shorts")) {
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: Shorts tab selected → shorts");
            return true;
        }

        // 3. Check for Shorts player using view IDs.
        //    Count BOTH "shorts" and "reel" view IDs — YouTube uses both.
        //    The Home page Shorts shelf has at most 1-2, the actual player has many.
        int shortsIdCount = countViewIdsContaining(root, "shorts", 0, 20);
        int reelIdCount = countViewIdsContaining(root, "reel", 0, 20);
        int totalShortsViews = shortsIdCount + reelIdCount;
        Log.d(TAG, "YouTube: shorts_ids=" + shortsIdCount + " reel_ids=" + reelIdCount);

        if (totalShortsViews >= 3) {
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: Shorts player views (" + totalShortsViews + ") → shorts");
            return true;
        }

        // 4. Check for Shorts-specific view IDs by full resource name
        List<AccessibilityNodeInfo> spNodes = root.findAccessibilityNodeInfosByViewId(
                "com.google.android.youtube:id/shorts_player_container");
        if (spNodes != null && !spNodes.isEmpty()) {
            for (AccessibilityNodeInfo n : spNodes) n.recycle();
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: shorts_player_container found → shorts");
            return true;
        }
        List<AccessibilityNodeInfo> rpNodes = root.findAccessibilityNodeInfosByViewId(
                "com.google.android.youtube:id/reel_recycler");
        if (rpNodes != null && !rpNodes.isEmpty()) {
            for (AccessibilityNodeInfo n : rpNodes) n.recycle();
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: reel_recycler found → shorts");
            return true;
        }

        // 5. Check for text that only appears in the Shorts player.
        //    When watching a Short, the bottom shows a music/sound marquee
        //    and there's a "Subscribe" button next to the channel name.
        //    If both exist → likely Shorts player.
        if (hasTextInTree(root, "Subscribe") && hasNodeWithDescContaining(root, "like this video", 0, 12)) {
            youtubeInShorts = true;
            Log.d(TAG, "YouTube: Shorts player UI elements → shorts");
            return true;
        }

        // 6. Check if a safe tab is selected (reset Shorts state)
        if (isTabSelected(root, "Home") || isTabSelected(root, "Subscriptions")
                || isTabSelected(root, "Library") || isTabSelected(root, "You")) {
            if (youtubeInShorts) {
                Log.d(TAG, "YouTube: safe tab selected → reset shorts state");
                youtubeInShorts = false;
            }
            return false;
        }

        // 7. If we previously determined we're on Shorts, keep blocking
        if (youtubeInShorts) {
            Log.d(TAG, "YouTube: persisted shorts state → shorts");
            return true;
        }

        return false;
    }

    // ── Facebook Reels detection ──────────────────────────────

    /**
     * Facebook strategy: Block Reels and Watch sections.
     * Detect via selected tab and Reels-specific content.
     */
    private boolean isFacebookReels(AccessibilityNodeInfo root) {
        // Check for Reels/Watch tab selected
        if (isTabSelected(root, "Reels") || isTabSelected(root, "Watch")
                || isTabSelected(root, "Video")) {
            Log.d(TAG, "Facebook: Reels/Watch tab selected → reels");
            return true;
        }

        // Check for safe tabs
        if (isTabSelected(root, "Home") || isTabSelected(root, "Friends")
                || isTabSelected(root, "Marketplace") || isTabSelected(root, "Notifications")
                || isTabSelected(root, "Menu") || isTabSelected(root, "Groups")) {
            Log.d(TAG, "Facebook: safe tab selected → not reels");
            return false;
        }

        // Look for Reels-specific views
        if (hasViewIdInTree(root, "reel") || hasViewIdInTree(root, "watch_tab")) {
            Log.d(TAG, "Facebook: reel views found → reels");
            return true;
        }

        // Content-based Reels detection
        if (hasTextInTree(root, "Reels and short videos")) {
            Log.d(TAG, "Facebook: reels content found → reels");
            return true;
        }

        // Check activity class
        String cls = currentFgActivity.toLowerCase();
        if (cls.contains("reel") || cls.contains("watch") || cls.contains("fbshort")
                || cls.contains("video")) {
            Log.d(TAG, "Facebook: reels activity class → reels");
            return true;
        }

        return false;
    }

    // ── Generic reels detection (other apps) ──────────────────

    private boolean isGenericReels(AccessibilityNodeInfo root) {
        if (hasTextInTree(root, "Shorts"))
            return true;
        if (hasTextInTree(root, "Reels"))
            return true;
        String cls = currentFgActivity.toLowerCase();
        return cls.contains("reel") || cls.contains("shorts");
    }

    // ── Tree scanning utilities ───────────────────────────────

    /**
     * Check if any node in the tree is a "selected" tab with the given name.
     * Uses findAccessibilityNodeInfosByText which searches BOTH
     * text content AND content descriptions.
     */
    private boolean isTabSelected(AccessibilityNodeInfo root, String tabName) {
        if (root == null)
            return false;
        try {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(tabName);
            if (nodes == null)
                return false;

            String tabLower = tabName.toLowerCase();
            boolean found = false;
            for (AccessibilityNodeInfo node : nodes) {
                if (!found) {
                    // Strategy 1: Standard selected/checked state
                    if (node.isSelected() || node.isChecked()) {
                        found = true;
                    }
                    // Strategy 2: Content description contains "selected"
                    // Many apps use descriptions like "Home, tab, selected"
                    if (!found) {
                        found = hasSelectedInDesc(node, tabLower);
                    }
                    // Strategy 3: Check parent selected/checked/desc
                    if (!found) {
                        AccessibilityNodeInfo parent = node.getParent();
                        if (parent != null) {
                            if (parent.isSelected() || parent.isChecked()) {
                                found = true;
                            }
                            if (!found) {
                                found = hasSelectedInDesc(parent, tabLower);
                            }
                            // Strategy 4: Check grandparent
                            if (!found) {
                                AccessibilityNodeInfo gp = parent.getParent();
                                if (gp != null) {
                                    if (gp.isSelected() || gp.isChecked()) {
                                        found = true;
                                    }
                                    if (!found) {
                                        found = hasSelectedInDesc(gp, tabLower);
                                    }
                                    gp.recycle();
                                }
                            }
                            parent.recycle();
                        }
                    }
                }
                node.recycle();
            }
            return found;
        } catch (Exception e) {
            return false;
        }
    }

    /** Check if a node's content description mentions both the tab name and "selected" */
    private boolean hasSelectedInDesc(AccessibilityNodeInfo node, String tabNameLower) {
        CharSequence desc = node.getContentDescription();
        if (desc != null) {
            String d = desc.toString().toLowerCase();
            if (d.contains(tabNameLower) && d.contains("selected")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if any node in the tree has a content description containing
     * the keyword (case-insensitive). Recurses up to maxDepth levels.
     */
    private boolean hasNodeWithDescContaining(AccessibilityNodeInfo node, String keyword,
            int depth, int maxDepth) {
        if (node == null || depth > maxDepth)
            return false;
        CharSequence desc = node.getContentDescription();
        if (desc != null && desc.toString().toLowerCase().contains(keyword.toLowerCase())) {
            return true;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                if (hasNodeWithDescContaining(child, keyword, depth + 1, maxDepth)) {
                    child.recycle();
                    return true;
                }
                child.recycle();
            }
        }
        return false;
    }

    /**
     * Check if the text exists anywhere in the UI tree.
     * Uses findAccessibilityNodeInfosByText for efficient searching.
     */
    private boolean hasTextInTree(AccessibilityNodeInfo root, String text) {
        if (root == null)
            return false;
        try {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
            if (nodes == null || nodes.isEmpty())
                return false;
            for (AccessibilityNodeInfo node : nodes) {
                node.recycle();
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Check if any view in the tree has a resource ID containing the keyword.
     */
    private boolean hasViewIdInTree(AccessibilityNodeInfo root, String keyword) {
        if (root == null)
            return false;
        return countViewIdsContaining(root, keyword, 0, 15) > 0;
    }

    /**
     * Count how many nodes have view resource IDs containing the keyword.
     * Limited by maxDepth to avoid excessive scanning.
     */
    private int countViewIdsContaining(AccessibilityNodeInfo node, String keyword,
            int depth, int maxDepth) {
        if (node == null || depth > maxDepth)
            return 0;
        int count = 0;

        CharSequence viewId = node.getViewIdResourceName();
        if (viewId != null && viewId.toString().toLowerCase().contains(keyword.toLowerCase())) {
            count++;
        }

        for (int i = 0; i < node.getChildCount() && count < 10; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                count += countViewIdsContaining(child, keyword, depth + 1, maxDepth);
                child.recycle();
            }
        }
        return count;
    }

    // ── Redirect to safe screen ───────────────────────────────

    /**
     * Tries to click the app's messaging/inbox tab in the bottom nav.
     * Falls back to GLOBAL_ACTION_BACK if the tab can't be found.
     */
    private void redirectToSafeScreen(String pkg) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            try {
                String[] safeTabNames;
                switch (pkg) {
                    case "com.zhiliaoapp.musically":
                        safeTabNames = new String[] { "Inbox", "Profile" };
                        break;
                    case "com.instagram.android":
                        // Just go back — tab clicking and deep links are unreliable
                        // on Instagram. Set grace period so the back-navigated screen
                        // has time to load before being re-checked.
                        instagramRedirectTime = System.currentTimeMillis();
                        root.recycle();
                        performGlobalAction(GLOBAL_ACTION_BACK);
                        return;
                    case "com.facebook.katana":
                        // "Home" first — "Menu" is the burger icon and must not be clicked
                        safeTabNames = new String[] { "Home", "Notifications" };
                        break;
                    default:
                        safeTabNames = new String[] {};
                        break;
                }

                for (String tabName : safeTabNames) {
                    if (clickTab(root, tabName)) {
                        Log.i(TAG, "Clicked safe tab: " + tabName);
                        root.recycle();
                        return;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Error finding safe tab", e);
            }
            root.recycle();
        }

        // Fallback: just go back
        Log.i(TAG, "No safe tab found, falling back to BACK");
        performGlobalAction(GLOBAL_ACTION_BACK);
    }

    /**
     * Find a tab node by name and click it.
     */
    private boolean clickTab(AccessibilityNodeInfo root, String tabName) {
        try {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(tabName);
            if (nodes == null)
                return false;

            boolean clicked = false;
            for (AccessibilityNodeInfo node : nodes) {
                if (!clicked) {
                    // Try clicking the node itself
                    if (node.isClickable()) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                        clicked = true;
                    } else {
                        // Try clicking the parent (common for tab containers)
                        AccessibilityNodeInfo parent = node.getParent();
                        if (parent != null) {
                            if (parent.isClickable()) {
                                parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                                clicked = true;
                            }
                            parent.recycle();
                        }
                    }
                }
                node.recycle();
            }
            return clicked;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Find a clickable node whose content description contains the keyword
     * (case-insensitive). Scans the tree recursively to find bottom-nav items.
     * This avoids text-matching issues where "Direct" also matches share buttons.
     */
    private boolean clickTabByDesc(AccessibilityNodeInfo root, String keyword) {
        if (root == null)
            return false;
        try {
            return clickTabByDescRecursive(root, keyword.toLowerCase(), 0, 10);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean clickTabByDescRecursive(AccessibilityNodeInfo node, String keyword,
            int depth, int maxDepth) {
        if (node == null || depth > maxDepth)
            return false;

        CharSequence desc = node.getContentDescription();
        if (desc != null && desc.toString().toLowerCase().contains(keyword)) {
            // Found a node with matching description — try clicking it
            if (node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                return true;
            }
            // Try parent
            AccessibilityNodeInfo parent = node.getParent();
            if (parent != null) {
                if (parent.isClickable()) {
                    parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    parent.recycle();
                    return true;
                }
                parent.recycle();
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                if (clickTabByDescRecursive(child, keyword, depth + 1, maxDepth)) {
                    child.recycle();
                    return true;
                }
                child.recycle();
            }
        }
        return false;
    }

    /**
     * Click the nth bottom navigation item by position.
     * Finds the bottom nav by scanning for a node whose children are all
     * clickable (or have clickable children) and positioned at the bottom
     * of the screen. Then clicks the child at index n (0-based).
     *
     * @param root           Root node of the window
     * @param targetIndex    0-based index of the button to click (e.g. 2 for 3rd)
     * @param expectedCount  Expected number of bottom nav items (e.g. 5)
     */
    private boolean clickNthBottomNavItem(AccessibilityNodeInfo root, int targetIndex,
            int expectedCount) {
        if (root == null)
            return false;
        try {
            // Get screen bounds from root
            Rect rootBounds = new Rect();
            root.getBoundsInScreen(rootBounds);
            int screenHeight = rootBounds.bottom;
            // Bottom nav is typically in the bottom 15% of the screen
            int bottomThreshold = screenHeight - (screenHeight / 7);

            return findAndClickBottomNav(root, targetIndex, expectedCount,
                    bottomThreshold, 0, 8);
        } catch (Exception e) {
            Log.w(TAG, "clickNthBottomNavItem error", e);
            return false;
        }
    }

    private boolean findAndClickBottomNav(AccessibilityNodeInfo node, int targetIndex,
            int expectedCount, int bottomThreshold, int depth, int maxDepth) {
        if (node == null || depth > maxDepth)
            return false;

        // Check if this node's bounds are in the bottom area
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);

        if (bounds.top >= bottomThreshold && node.getChildCount() >= expectedCount) {
            // Count clickable children (or children with clickable sub-children)
            int clickableCount = 0;
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    if (child.isClickable() || child.getChildCount() > 0) {
                        clickableCount++;
                    }
                    child.recycle();
                }
            }

            if (clickableCount >= expectedCount && targetIndex < node.getChildCount()) {
                AccessibilityNodeInfo target = node.getChild(targetIndex);
                if (target != null) {
                    boolean clicked = false;
                    if (target.isClickable()) {
                        target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                        clicked = true;
                    } else {
                        // Try first clickable child of the target
                        for (int j = 0; j < target.getChildCount() && !clicked; j++) {
                            AccessibilityNodeInfo sub = target.getChild(j);
                            if (sub != null) {
                                if (sub.isClickable()) {
                                    sub.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                                    clicked = true;
                                }
                                sub.recycle();
                            }
                        }
                    }
                    target.recycle();
                    if (clicked) {
                        Log.d(TAG, "Clicked bottom nav item " + targetIndex
                                + " of " + clickableCount);
                        return true;
                    }
                }
            }
        }

        // Recurse into children
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                if (findAndClickBottomNav(child, targetIndex, expectedCount,
                        bottomThreshold, depth + 1, maxDepth)) {
                    child.recycle();
                    return true;
                }
                child.recycle();
            }
        }
        return false;
    }

    // ── Package self-check ────────────────────────────────────

    private boolean isOurApp(String pkg) {
        if (pkg == null)
            return false;
        return pkg.equals(myAppPackage)
                || pkg.equals("com.athanasso.doomscrolldetox")
                || pkg.equals("com.doomscrolldetox");
    }

    // ── UsageStatsManager foreground detection ────────────────

    private String queryCurrentForeground() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
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
                if (type == 1 /* MOVE_TO_FOREGROUND */ || type == 7 /* ACTIVITY_RESUMED */) {
                    fg = ev.getPackageName();
                }
            }
            return fg;
        } catch (Exception e) {
            return null;
        }
    }

    // ── Schedule + blocking-active check ──────────────────────

    private boolean isBlockingActive() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(KEY_BLOCKING_ACTIVE, false))
            return true;

        int startMinutes = prefs.getInt(KEY_SCHEDULE_START, -1);
        int endMinutes = prefs.getInt(KEY_SCHEDULE_END, -1);
        if (startMinutes < 0 || endMinutes < 0)
            return false;

        Calendar cal = Calendar.getInstance();
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        if (startMinutes <= endMinutes)
            return now >= startMinutes && now < endMinutes;
        return now >= startMinutes || now < endMinutes;
    }

    // ── Blocked-package refresh (throttled) ───────────────────

    private void maybeRefreshPrefs() {
        long now = System.currentTimeMillis();
        if (now - lastPrefsRefresh < PREFS_REFRESH_INTERVAL_MS)
            return;
        lastPrefsRefresh = now;
        refreshBlockedPackages();
    }

    private void refreshBlockedPackages() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        Set<String> oldFull = new HashSet<>(blockedFullPackages);
        Set<String> oldFeed = new HashSet<>(blockedFeedPackages);
        blockedFullPackages.clear();
        blockedFeedPackages.clear();
        try {
            JSONArray fullArr = new JSONArray(prefs.getString(KEY_BLOCKED_FULL, "[]"));
            for (int i = 0; i < fullArr.length(); i++)
                blockedFullPackages.add(fullArr.getString(i));
            JSONArray feedArr = new JSONArray(prefs.getString(KEY_BLOCKED_FEED, "[]"));
            for (int i = 0; i < feedArr.length(); i++)
                blockedFeedPackages.add(feedArr.getString(i));
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing blocked packages", e);
        }
        if (!blockedFullPackages.equals(oldFull) || !blockedFeedPackages.equals(oldFeed)) {
            Log.i(TAG, "Blocks updated: full=" + blockedFullPackages + " feed=" + blockedFeedPackages);
        }
    }
}
