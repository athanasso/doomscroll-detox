/**
 * AppIcon — renders the real Android app icon (fetched via native PackageManager)
 * with a fallback to a known web icon URL, then to a coloured circle + initial.
 */
import { Brand } from "@/constants/theme";
import { getAppIcon } from "@/modules/doomscroll-native";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";

// Well-known Play Store icon URLs for the default apps.
// These are Google's static CDN links that don't require auth.
const KNOWN_ICONS: Record<string, string> = {
  "com.zhiliaoapp.musically":
    "https://www.google.com/s2/favicons?sz=128&domain=tiktok.com",
  "com.instagram.android":
    "https://www.google.com/s2/favicons?sz=128&domain=instagram.com",
  "com.google.android.youtube":
    "https://www.google.com/s2/favicons?sz=128&domain=youtube.com",
  "com.facebook.katana":
    "https://www.google.com/s2/favicons?sz=128&domain=facebook.com",
};

interface AppIconProps {
  /** Android package name, e.g. "com.instagram.android" */
  packageName?: string;
  /** Display name (used for fallback initial) */
  name: string;
  /** Pixel size of the icon (default 40) */
  size?: number;
  /** Fallback background colour */
  fallbackColor?: string;
  style?: ViewStyle;
}

export function AppIcon({
  packageName,
  name,
  size = 40,
  fallbackColor = Brand.slateLight,
  style,
}: AppIconProps) {
  const [iconUri, setIconUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (packageName) {
      getAppIcon(packageName, size * 2) // 2x for retina
        .then((uri) => {
          if (mounted && uri) {
            setIconUri(uri);
          } else if (mounted && KNOWN_ICONS[packageName]) {
            // Native module unavailable (Expo Go) — use web fallback
            setIconUri(KNOWN_ICONS[packageName]);
          }
        })
        .catch(() => {
          if (mounted && KNOWN_ICONS[packageName]) {
            setIconUri(KNOWN_ICONS[packageName]);
          }
        });
    } else if (packageName && KNOWN_ICONS[packageName]) {
      setIconUri(KNOWN_ICONS[packageName]);
    }
    return () => {
      mounted = false;
    };
  }, [packageName, size]);

  const borderRadius = size * 0.22; // slightly rounded square like Android icons

  if (iconUri) {
    return (
      <Image
        source={{ uri: iconUri }}
        style={[
          { width: size, height: size, borderRadius },
          style as import("react-native").ImageStyle,
        ]}
      />
    );
  }

  // Fallback: coloured circle with first letter
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: fallbackColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: Brand.textBright,
    fontWeight: "700",
  },
});
