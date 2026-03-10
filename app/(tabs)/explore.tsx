/**
 * App Selector – Doomscroll Detox
 *
 * Lets the user toggle individual social-media apps and choose
 * between "Block Entire App" vs "Block Reels/Shorts Only."
 * Users can also add custom apps from their installed apps list.
 */
import { AppIcon } from "@/components/app-icon";
import { GlassCard } from "@/components/glass-card";
import { GlowToggle } from "@/components/glow-toggle";
import { Brand } from "@/constants/theme";
import { useAppCtx } from "@/contexts/app-state-context";
import { APP_COLORS, type BlockedApp } from "@/hooks/use-app-state";
import { getInstalledApps } from "@/modules/doomscroll-native";
import { Ban, Film, Plus, Search, Trash2, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface InstalledApp {
  packageName: string;
  name: string;
}

export default function AppSelectorScreen() {
  const { state, toggleApp, setAppBlockMode, addApp, removeApp } = useAppCtx();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>App Selector</Text>
        <Text style={styles.sub}>
          Choose which apps to shield during your Doom Zone.
        </Text>

        {state.blockedApps.map((app) => {
          const color =
            APP_COLORS[app.id] ?? APP_COLORS[app.packageName] ?? Brand.accent;
          const isDefault = [
            "tiktok",
            "instagram",
            "youtube",
            "facebook",
          ].includes(app.id);
          return (
            <GlassCard key={app.id} style={styles.card}>
              {/* Top row: icon + name + toggle */}
              <View style={styles.topRow}>
                <AppIcon
                  packageName={app.packageName}
                  name={app.name}
                  size={40}
                  fallbackColor={color}
                />
                <View style={styles.appNameCol}>
                  <Text style={styles.appName}>{app.name}</Text>
                  <Text style={styles.pkgName}>{app.packageName}</Text>
                </View>
                <GlowToggle
                  value={app.enabled}
                  onValueChange={() => toggleApp(app.id)}
                  activeColor={color}
                />
              </View>

              {/* Block-mode selector (only for known apps that support feed blocking) */}
              {app.enabled && isDefault && (
                <View style={styles.modeCol}>
                  <View style={styles.modeRow}>
                    <ModeButton
                      label="Block Entire App"
                      icon={
                        <Ban
                          size={14}
                          color={
                            app.blockMode === "full"
                              ? Brand.textBright
                              : Brand.muted
                          }
                        />
                      }
                      active={app.blockMode === "full"}
                      onPress={() => setAppBlockMode(app.id, "full")}
                    />
                    <ModeButton
                      label="Block Reels / Shorts"
                      icon={
                        <Film
                          size={14}
                          color={
                            app.blockMode === "feed"
                              ? Brand.textBright
                              : Brand.muted
                          }
                        />
                      }
                      active={app.blockMode === "feed"}
                      onPress={() => setAppBlockMode(app.id, "feed")}
                    />
                  </View>
                </View>
              )}

              {/* Remove button for custom (non-default) apps */}
              {!isDefault && (
                <Pressable
                  onPress={() => removeApp(app.id)}
                  style={styles.removeBtn}
                >
                  <Trash2 size={14} color={Brand.danger} />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              )}
            </GlassCard>
          );
        })}

        {/* Add app button */}
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
        >
          <Plus size={20} color={Brand.accent} />
          <Text style={styles.addBtnText}>Add App</Text>
        </Pressable>
      </ScrollView>

      {/* Add-app modal */}
      <AddAppModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(app) => {
          addApp(app);
          setShowAddModal(false);
        }}
        existingPackages={state.blockedApps.map((a) => a.packageName)}
      />
    </SafeAreaView>
  );
}

// ── Add App Modal ──────────────────────────────────────────────
function AddAppModal({
  visible,
  onClose,
  onAdd,
  existingPackages,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (app: BlockedApp) => void;
  existingPackages: string[];
}) {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedApp(null);
      return;
    }
    setLoading(true);
    getInstalledApps()
      .then((apps) => setInstalledApps(apps))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = installedApps.filter(
    (app) =>
      !existingPackages.includes(app.packageName) &&
      (app.name.toLowerCase().includes(search.toLowerCase()) ||
        app.packageName.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe} edges={["top"]}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add App</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={24} color={Brand.text} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Search size={16} color={Brand.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search installed apps…"
            placeholderTextColor={Brand.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        {/* List */}
        {loading ? (
          <Text style={styles.emptyText}>Loading installed apps…</Text>
        ) : selectedApp ? (
          <View style={styles.modeSelectContainer}>
            <View style={styles.selectedAppRow}>
              <AppIcon
                packageName={selectedApp.packageName}
                name={selectedApp.name}
                size={48}
              />
              <View style={styles.appRowText}>
                <Text style={styles.appRowName}>{selectedApp.name}</Text>
                <Text style={styles.appRowPkg}>{selectedApp.packageName}</Text>
              </View>
            </View>

            <Text style={styles.modeSelectLabel}>
              This app will be fully blocked when your Doom Zone is active.
            </Text>

            <View style={styles.modeSelectButtons}>
              <Pressable
                onPress={() => setSelectedApp(null)}
                style={styles.modeSelectCancel}
              >
                <Text style={styles.modeSelectCancelText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const id = selectedApp.packageName.replace(/\./g, "_");
                  onAdd({
                    id,
                    name: selectedApp.name,
                    packageName: selectedApp.packageName,
                    blockMode: "full",
                    enabled: true,
                  });
                }}
                style={styles.modeSelectConfirm}
              >
                <Text style={styles.modeSelectConfirmText}>Add App</Text>
              </Pressable>
            </View>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>
            {installedApps.length === 0
              ? "Could not load installed apps.\nThis requires running on a real Android device."
              : "No matching apps found."}
          </Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.packageName}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedApp(item);
                  setSelectedMode("full");
                }}
                style={({ pressed }) => [
                  styles.appRow,
                  pressed && { backgroundColor: Brand.slateLight },
                ]}
              >
                <AppIcon
                  packageName={item.packageName}
                  name={item.name}
                  size={36}
                />
                <View style={styles.appRowText}>
                  <Text style={styles.appRowName}>{item.name}</Text>
                  <Text style={styles.appRowPkg}>{item.packageName}</Text>
                </View>
                <Plus size={18} color={Brand.accent} />
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── ModeButton ─────────────────────────────────────────────────
function ModeButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeBtn, active && styles.modeBtnActive]}
    >
      {icon}
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.midnight },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: Brand.textBright,
    marginBottom: 4,
  },
  sub: { fontSize: 14, color: Brand.muted, marginBottom: 24 },
  card: { marginBottom: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  appNameCol: { flex: 1 },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: Brand.textBright,
  },
  pkgName: {
    fontSize: 11,
    color: Brand.muted,
    marginTop: 1,
  },
  modeCol: { gap: 10, marginTop: 14 },
  modeRow: { flexDirection: "row", gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    backgroundColor: "transparent",
  },
  modeBtnActive: {
    backgroundColor: Brand.slateLight,
    borderColor: Brand.accent,
  },
  modeBtnText: { fontSize: 11, color: Brand.muted, flexShrink: 1 },
  modeBtnTextActive: { color: Brand.textBright },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  removeText: { fontSize: 12, color: Brand.danger },

  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Brand.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    borderStyle: "dashed",
    padding: 16,
    marginTop: 4,
  },
  addBtnText: { fontSize: 15, fontWeight: "600", color: Brand.accent },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Brand.midnight },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: Brand.textBright },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Brand.slate,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
    padding: 0,
  },
  emptyText: {
    fontSize: 14,
    color: Brand.muted,
    textAlign: "center",
    marginTop: 40,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  appRowText: { flex: 1 },
  appRowName: { fontSize: 15, fontWeight: "500", color: Brand.textBright },
  appRowPkg: { fontSize: 11, color: Brand.muted, marginTop: 1 },

  // Mode selection step in modal
  modeSelectContainer: { padding: 20 },
  selectedAppRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  modeSelectLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Brand.text,
    marginBottom: 12,
  },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    backgroundColor: Brand.glass,
    marginBottom: 10,
  },
  modeOptionActive: {
    borderColor: Brand.accent,
    backgroundColor: Brand.slateLight,
  },
  modeOptionTitle: { fontSize: 15, fontWeight: "600", color: Brand.muted },
  modeOptionTitleActive: { color: Brand.textBright },
  modeOptionDesc: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  modeSelectButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modeSelectCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
    alignItems: "center",
  },
  modeSelectCancelText: { fontSize: 15, fontWeight: "600", color: Brand.text },
  modeSelectConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Brand.accent,
    alignItems: "center",
  },
  modeSelectConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: Brand.textBright,
  },
});
