import { FormEvent, useMemo, useRef, useState } from "react";

import { useAppCtx } from "../../AppContext";
import { apiFetch, jsonHeaders, userFacingError } from "../../utils";
import type { DemandeCategory, PipelineCardFilter, PrestataireRecord, PrestataireStatusFilter } from "../../types";

export function usePrestataireDashboardViewModel() {
  const ctx = useAppCtx();
  const {
    missions,
    services,
    demandes,
    userId,
    claims,
    setToast,
    refreshDashboard,
    missionLabelById,
  } = ctx;

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [prestataireStatusFilter, setPrestataireStatusFilter] = useState<PrestataireStatusFilter>("ouverte");
  const [prestataireCategoryFilter, setPrestataireCategoryFilter] = useState<DemandeCategory | "all">("all");
  const [prestataireVilleFilter, setPrestataireVilleFilter] = useState("all");
  const [prestataireArrondissementFilter, setPrestataireArrondissementFilter] = useState("all");
  const [prestataireQuartierFilter, setPrestataireQuartierFilter] = useState("all");
  const [pipelineVisibleCount, setPipelineVisibleCount] = useState<5 | 10>(5);
  const [pipelineCardFilter, setPipelineCardFilter] = useState<PipelineCardFilter>("all");
  const [pipelineIdQuery, setPipelineIdQuery] = useState("");
  const [missionPendingId, setMissionPendingId] = useState<number | null>(null);
  const [notifsPanelOpen, setNotifsPanelOpen] = useState(false);
  const prestataireCreateServiceRef = useRef<HTMLFormElement | null>(null);

  const ownServices = useMemo(() => services.filter((s) => s.prestataire_id === userId), [services, userId]);
  const providerMissions = useMemo(() => missions.filter((m) => m.prestataire_id === userId), [missions, userId]);
  const matchingDemandesCount = useMemo(() => demandes.length, [demandes]);

  async function handleCreateService(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!claims) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      await apiFetch<void>("/services", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          prestataire_id: userId,
          name: String(formData.get("name") || ""),
          description: String(formData.get("description") || ""),
          availability_slots: String(formData.get("availability_slots") || "").trim(),
          price: (() => {
            const raw = String(formData.get("price") || "").trim();
            if (!raw) return null;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
          })(),
        }),
      });
      setToast({ kind: "ok", message: "Service créé." });
      form.reset();
      if (claims) await refreshDashboard(claims);
    } catch (error) {
      setToast({
        kind: "err",
        message: userFacingError(
          error,
          "Le service est enregistré, mais l'actualisation de l'écran a échoué. Cliquez sur Actualiser.",
          "create-service"
        ),
      });
    }
  }

  async function handleUpdateMissionStatus(missionId: number, newStatus: string): Promise<void> {
    if (!claims) return;
    try {
      setMissionPendingId(missionId);
      await apiFetch<import("../../types").Mission>(`/missions/${missionId}/status`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      setToast({ kind: "ok", message: `${missionLabelById(missionId)} → ${newStatus}` });
      if (claims) await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise à jour impossible" });
    } finally {
      setMissionPendingId(null);
    }
  }

  async function handleVisibilityChange(newMode: "public" | "discret" | "anonyme"): Promise<void> {
    if (!claims || claims.role !== "prestataire") return;
    ctx.setVisibilityPending(true);
    try {
      const updated = await apiFetch<PrestataireRecord>("/prestataires/me/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility_mode: newMode }),
      });
      ctx.setVisibilityMode(updated.visibility_mode ?? newMode);
      ctx.setPrestataires((prev) => prev.map((p) => p.user_id === updated.user_id ? { ...p, visibility_mode: updated.visibility_mode } : p));
      setToast({ kind: "ok", message: `Mode de visibilité : ${newMode === "public" ? "Public" : newMode === "discret" ? "Discret" : "Anonyme"}` });
    } catch (err) {
      setToast({ kind: "err", message: err instanceof Error ? err.message : "Erreur lors de la mise à jour" });
    } finally {
      ctx.setVisibilityPending(false);
    }
  }

  async function handleZonePreferenceChange(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!claims || claims.role !== "prestataire") return;
    ctx.setZonePrefPending(true);
    try {
      const updated = await apiFetch<PrestataireRecord>("/prestataires/me/zone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_preference_ville: ctx.zonePrefVille.trim() || null,
          zone_preference_arrondissement: ctx.zonePrefArrondissement.trim() || null,
          zone_preference_quartier: ctx.zonePrefQuartier.trim() || null,
        }),
      });
      ctx.setZonePrefVille(updated.zone_preference_ville ?? "");
      ctx.setZonePrefArrondissement(updated.zone_preference_arrondissement ?? "");
      ctx.setZonePrefQuartier(updated.zone_preference_quartier ?? "");
      setToast({ kind: "ok", message: "Zone de préférence enregistrée." });
    } catch (err) {
      setToast({ kind: "err", message: err instanceof Error ? err.message : "Erreur lors de la sauvegarde" });
    } finally {
      ctx.setZonePrefPending(false);
    }
  }

  async function handleMarkAllNotifsRead(): Promise<void> {
    if (!claims || claims.role !== "prestataire") return;
    try {
      await apiFetch<void>("/prestataires/me/notifications/read-all", { method: "POST" });
      ctx.setZoneNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  }

  return {
    // ─ Data from context
    token: ctx.token,
    claims,
    userId,
    role: ctx.role,
    demandes,
    services,
    missions,
    userProfile: ctx.userProfile,
    avatarInputRef: ctx.avatarInputRef,
    avatarUploadPending: ctx.avatarUploadPending,
    handleAvatarChange: ctx.handleAvatarChange,
    dashboardPending: ctx.dashboardPending,
    refreshDashboard: ctx.refreshDashboard,
    userBadges: ctx.userBadges,
    visibilityMode: ctx.visibilityMode,
    visibilityPending: ctx.visibilityPending,
    zonePrefVille: ctx.zonePrefVille,
    setZonePrefVille: ctx.setZonePrefVille,
    zonePrefArrondissement: ctx.zonePrefArrondissement,
    setZonePrefArrondissement: ctx.setZonePrefArrondissement,
    zonePrefQuartier: ctx.zonePrefQuartier,
    setZonePrefQuartier: ctx.setZonePrefQuartier,
    zonePrefPending: ctx.zonePrefPending,
    zoneNotifications: ctx.zoneNotifications,
    openDemandDetailModal: ctx.openDemandDetailModal,
    demandeLabel: ctx.demandeLabel,
    missionLabel: ctx.missionLabel,
    demandeLabelById: ctx.demandeLabelById,
    missionLabelById: ctx.missionLabelById,
    switchableRoles: ctx.switchableRoles,
    canSwitchRole: ctx.canSwitchRole,
    switchRolePending: ctx.switchRolePending,
    addRolePending: ctx.addRolePending,
    handleSwitchRole: ctx.handleSwitchRole,
    handleAddRole: ctx.handleAddRole,
    handleUnregister: ctx.handleUnregister,
    logout: ctx.logout,
    // ─ Local UI state
    prestataireStatusFilter,
    setPrestataireStatusFilter,
    prestataireCategoryFilter,
    setPrestataireCategoryFilter,
    prestataireVilleFilter,
    setPrestataireVilleFilter,
    prestataireArrondissementFilter,
    setPrestataireArrondissementFilter,
    prestataireQuartierFilter,
    setPrestataireQuartierFilter,
    pipelineVisibleCount,
    setPipelineVisibleCount,
    pipelineCardFilter,
    setPipelineCardFilter,
    pipelineIdQuery,
    setPipelineIdQuery,
    missionPendingId,
    notifsPanelOpen,
    setNotifsPanelOpen,
    prestataireCreateServiceRef,
    // ─ Computed
    ownServices,
    providerMissions,
    matchingDemandesCount,
    // ─ Handlers
    handleCreateService,
    handleUpdateMissionStatus,
    handleVisibilityChange,
    handleZonePreferenceChange,
    handleMarkAllNotifsRead,
  };
}
