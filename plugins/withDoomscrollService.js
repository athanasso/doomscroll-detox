/**
 * withDoomscrollService — Expo Config Plugin
 *
 * Injects the native Android code required for Doomscroll Detox:
 *   1. Copies Java source files (AccessibilityService, Module, Package)
 *   2. Adds accessibility_service_config.xml resource
 *   3. Modifies AndroidManifest.xml with service declaration + permissions
 *   4. Registers the native package in MainApplication.java
 *   5. Adds the accessibility service description string
 */
const {
  withAndroidManifest,
  withMainApplication,
  withStringsXml,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE_NAME = "com.doomscrolldetox";
const JAVA_DIR_RELATIVE = "app/src/main/java/com/doomscrolldetox";
const RES_XML_DIR_RELATIVE = "app/src/main/res/xml";

// ── Helper: copy a file from plugins/android/ into the android project ──
function copyPluginFile(androidDir, srcFileName, destRelDir) {
  const srcPath = path.join(__dirname, "android", srcFileName);
  const destDir = path.join(androidDir, destRelDir);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(destDir, srcFileName));
}

// ── 1. Copy Java sources + XML resource ───────────────────────
function withCopyNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const androidDir = cfg.modRequest.platformProjectRoot;

      // Java sources
      copyPluginFile(
        androidDir,
        "DoomscrollAccessibilityService.java",
        JAVA_DIR_RELATIVE,
      );
      copyPluginFile(androidDir, "DoomscrollModule.java", JAVA_DIR_RELATIVE);
      copyPluginFile(androidDir, "DoomscrollPackage.java", JAVA_DIR_RELATIVE);
      copyPluginFile(
        androidDir,
        "DoomscrollPollReceiver.java",
        JAVA_DIR_RELATIVE,
      );
      copyPluginFile(
        androidDir,
        "DoomscrollForegroundService.java",
        JAVA_DIR_RELATIVE,
      );
      copyPluginFile(
        androidDir,
        "AntiscrollPopupActivity.java",
        JAVA_DIR_RELATIVE,
      );

      // XML resource
      copyPluginFile(
        androidDir,
        "accessibility_service_config.xml",
        RES_XML_DIR_RELATIVE,
      );

      // Notification icon (since we removed expo-notifications)
      try {
        const srcIconPath = path.join(
          cfg.modRequest.projectRoot,
          "assets",
          "images",
          "android-icon-monochrome.png",
        );
        const destIconDir = path.join(
          androidDir,
          "app",
          "src",
          "main",
          "res",
          "drawable",
        );
        fs.mkdirSync(destIconDir, { recursive: true });
        fs.copyFileSync(
          srcIconPath,
          path.join(destIconDir, "notification_icon.png"),
        );
      } catch (e) {
        console.warn("Failed to copy notification icon:", e);
      }

      return cfg;
    },
  ]);
}

// ── 2. Modify AndroidManifest.xml ─────────────────────────────
function withManifestMods(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // Add permissions
    const permissions = [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.WAKE_LOCK",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.QUERY_ALL_PACKAGES",
    ];

    if (!manifest.manifest["uses-permission"]) {
      manifest.manifest["uses-permission"] = [];
    }

    for (const perm of permissions) {
      const exists = manifest.manifest["uses-permission"].some(
        (p) => p.$?.["android:name"] === perm,
      );
      if (!exists) {
        manifest.manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    // Add <queries> for package visibility (Android 11+)
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }
    if (manifest.manifest.queries.length === 0) {
      manifest.manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [
              { $: { "android:name": "android.intent.category.LAUNCHER" } },
            ],
          },
        ],
      });
    }

    // Add AccessibilityService declaration
    const app = manifest.manifest.application?.[0];
    if (app) {
      if (!app.service) app.service = [];

      const serviceExists = app.service.some(
        (s) =>
          s.$?.["android:name"] ===
          `${PACKAGE_NAME}.DoomscrollAccessibilityService`,
      );

      if (!serviceExists) {
        app.service.push({
          $: {
            "android:name": `${PACKAGE_NAME}.DoomscrollAccessibilityService`,
            "android:label": "Doomscroll Detox Blocker",
            "android:permission":
              "android.permission.BIND_ACCESSIBILITY_SERVICE",
            "android:exported": "false",
            "android:stopWithTask": "false",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name":
                      "android.accessibilityservice.AccessibilityService",
                  },
                },
              ],
            },
          ],
          "meta-data": [
            {
              $: {
                "android:name": "android.accessibilityservice",
                "android:resource": "@xml/accessibility_service_config",
              },
            },
          ],
        });
      }

      // Add PollReceiver declaration (manifest-registered so it survives process death)
      if (!app.receiver) app.receiver = [];
      const receiverExists = app.receiver.some(
        (r) =>
          r.$?.["android:name"] === `${PACKAGE_NAME}.DoomscrollPollReceiver`,
      );
      if (!receiverExists) {
        app.receiver.push({
          $: {
            "android:name": `${PACKAGE_NAME}.DoomscrollPollReceiver`,
            "android:exported": "false",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name": "com.doomscrolldetox.ACTION_POLL",
                  },
                },
              ],
            },
          ],
        });
      }

      // Add ForegroundService declaration
      const fgServiceExists = app.service.some(
        (s) =>
          s.$?.["android:name"] ===
          `${PACKAGE_NAME}.DoomscrollForegroundService`,
      );
      if (!fgServiceExists) {
        app.service.push({
          $: {
            "android:name": `${PACKAGE_NAME}.DoomscrollForegroundService`,
            "android:exported": "false",
            "android:stopWithTask": "false",
            "android:foregroundServiceType": "specialUse",
          },
        });
      }

      // Add AntiscrollPopupActivity declaration
      if (!app.activity) app.activity = [];
      const popupExists = app.activity.some(
        (a) =>
          a.$?.["android:name"] ===
          `${PACKAGE_NAME}.AntiscrollPopupActivity`,
      );
      if (!popupExists) {
        app.activity.push({
          $: {
            "android:name": `${PACKAGE_NAME}.AntiscrollPopupActivity`,
            "android:theme": "@android:style/Theme.DeviceDefault.Light.NoActionBar",
            "android:excludeFromRecents": "true",
            "android:taskAffinity": "",
            "android:launchMode": "singleInstance",
          },
        });
      }
    }

    return cfg;
  });
}

// ── 3. Register native package in MainApplication ─────────────
function withRegisterPackage(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const language = cfg.modResults.language; // "java" | "kt"

    if (contents.includes("DoomscrollPackage")) {
      // Already registered
      return cfg;
    }

    const importLine = `import ${PACKAGE_NAME}.DoomscrollPackage`;

    if (language === "kt") {
      // ── Kotlin MainApplication ──
      // Add import (Kotlin imports don't have semicolons)
      if (!contents.includes(importLine)) {
        contents = contents.replace(/^(import .+\n)/m, `$1${importLine}\n`);
      }

      // Inject inside PackageList(...).packages.apply { ... }
      // Pattern: the comment line "// add(MyReactNativePackage())" or the closing }
      if (contents.includes("// add(MyReactNativePackage())")) {
        contents = contents.replace(
          "// add(MyReactNativePackage())",
          "// add(MyReactNativePackage())\n              add(DoomscrollPackage())",
        );
      } else {
        // Fallback: inject before the closing brace of the apply block
        contents = contents.replace(
          /(PackageList\(this\)\.packages\.apply\s*\{)/,
          `$1\n              add(DoomscrollPackage())`,
        );
      }
    } else {
      // ── Java MainApplication ──
      const importLineJava = `import ${PACKAGE_NAME}.DoomscrollPackage;`;
      if (!contents.includes(importLineJava)) {
        contents = contents.replace(
          /^(import .+;\s*\n)/m,
          `$1${importLineJava}\n`,
        );
      }

      if (!contents.includes("new DoomscrollPackage()")) {
        contents = contents.replace(
          /(packages\.add\(new \w+\(\)\);)/,
          `$1\n      packages.add(new DoomscrollPackage());`,
        );

        // Fallback for PackageList-based templates
        if (!contents.includes("new DoomscrollPackage()")) {
          contents = contents.replace(
            /(return packages;)/,
            `packages.add(new DoomscrollPackage());\n      $1`,
          );
        }
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ── 4. Add string resource for a11y description ───────────────
function withStringResource(config) {
  return withStringsXml(config, (cfg) => {
    const strings = cfg.modResults;

    if (!strings.resources.string) {
      strings.resources.string = [];
    }

    const exists = strings.resources.string.some(
      (s) => s.$.name === "doomscroll_a11y_description",
    );

    if (!exists) {
      strings.resources.string.push({
        $: { name: "doomscroll_a11y_description" },
        _: "Doomscroll Detox uses this service to detect when you open a blocked app during your Doom Zone and gently redirect you.",
      });
    }

    return cfg;
  });
}

// ── Compose all mods ──────────────────────────────────────────
function withDoomscrollService(config) {
  config = withCopyNativeFiles(config);
  config = withManifestMods(config);
  config = withRegisterPackage(config);
  config = withStringResource(config);
  return config;
}

module.exports = withDoomscrollService;
