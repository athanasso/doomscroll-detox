import { Brand } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  /** Extra padding (default 28) */
  padding?: number;
}

/**
 * Glassmorphism-style card with rounded corners, translucent background,
 * and a subtle border glow.
 */
export function GlassCard({
  children,
  style,
  padding = 28,
  ...rest
}: GlassCardProps) {
  return (
    <View style={[styles.card, { padding }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    // Soft shadow for the "glow" feel
    shadowColor: Brand.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
});
