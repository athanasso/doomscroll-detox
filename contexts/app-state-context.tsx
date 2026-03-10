import { useAppState } from "@/hooks/use-app-state";
import React, { createContext, useContext, type ReactNode } from "react";

type AppCtx = ReturnType<typeof useAppState>;

const Ctx = createContext<AppCtx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppCtx(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppCtx must be used inside <AppStateProvider>");
  return ctx;
}
