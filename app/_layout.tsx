import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

  // Schedule bedtime notifications whenever the schedule or app list changes
  const blockedAppCount = state.blockedApps.filter((a) => a.enabled).length;


  // While loading state from AsyncStorage, show nothing
  if (!loaded) return null;

  // Redirect to onboarding if not completed
  if (!state.onboardingDone) {
    return (
      <ThemeProvider value={DoomscrollDark}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={DoomscrollDark}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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
