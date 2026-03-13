import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";

import { Brand } from "@/constants/theme";
import { AppStateProvider, useAppCtx } from "@/contexts/app-state-context";


export const unstable_settings = {
  anchor: "(tabs)",
};

// Custom dark theme built on our Brand palette
const DoomscrollDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.accent,
    background: Brand.midnight,
    card: Brand.slate,
    text: Brand.text,
    border: Brand.glassBorder,
    notification: Brand.danger,
  },
};

export default function RootLayout() {
  return (
    <AppStateProvider>
      <InnerLayout />
    </AppStateProvider>
  );
}

function InnerLayout() {
  const { state, loaded } = useAppCtx();

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loaded) return;

    const inOnboardingGroup = segments[0] === "onboarding";

    if (!state.onboardingDone && !inOnboardingGroup) {
      // Missing permissions or first launch -> force onboarding
      router.replace("/onboarding");
    } else if (state.onboardingDone && inOnboardingGroup) {
      // Done onboarding -> force to tabs
      router.replace("/(tabs)");
    }
  }, [state.onboardingDone, segments, loaded]);

  // While loading state from AsyncStorage, show nothing
  if (!loaded) return null;

  return (
    <ThemeProvider value={DoomscrollDark}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "fullScreenModal",
            headerShown: false,
            animation: "fade",
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
