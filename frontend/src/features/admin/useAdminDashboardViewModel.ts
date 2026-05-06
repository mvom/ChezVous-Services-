import { useMemo, useState } from "react";

import { useAppCtx } from "../../AppContext";
import { apiFetch, jsonHeaders } from "../../utils";
import type { PrestataireRecord, Role, UserRecord } from "../../types";

export function useAdminDashboardViewModel() {
  const ctx = useAppCtx();
  const {
    users,
    prestataires,
    missions,
    demandes,
    claims,
    setToast,
    refreshDashboard,
  } = ctx;

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [adminRoleDraftByUserId, setAdminRoleDraftByUserId] = useState<Record<number, Role>>({});
  const [adminActionUserId, setAdminActionUserId] = useState<number | null>(null);
  const [adminActionKind, setAdminActionKind] = useState<"role" | "delete" | null>(null);

  const providerUsersCount = useMemo(() => users.filter((u) => u.role === "prestataire").length, [users]);
  const verifiedProvidersCount = useMemo(() => prestataires.filter((p) => p.verified).length, [prestataires]);
  const activeMissionsCount = useMemo(() => missions.filter((m) => m.status === "en_cours").length, [missions]);
  const openDemandesCount = useMemo(() => demandes.filter((d) => d.status === "ouverte").length, [demandes]);

  async function handleTogglePrestataireVerified(prestataireId: number, nextVerified: boolean): Promise<void> {
    if (!claims) return;
    try {
      await apiFetch<PrestataireRecord>(`/prestataires/${prestataireId}/verified`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ verified: nextVerified }),
      });
      setToast({ kind: "ok", message: nextVerified ? "Prestataire verifie." : "Verification retiree." });
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise à jour impossible" });
    }
  }

  async function handleAdminChangeUserRole(user: UserRecord, nextRole: Role): Promise<void> {
    if (!claims) return;
    if (user.role === nextRole) {
      setToast({ kind: "err", message: "Aucun changement de rôle détecté." });
      return;
    }
    try {
      setAdminActionUserId(user.id);
      setAdminActionKind("role");
      await apiFetch<{ detail: string }>(`/auth/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ role: nextRole }),
      });
      setToast({ kind: "ok", message: `Role de @${user.username} mis a jour vers ${nextRole}.` });
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise à jour du rôle impossible" });
    } finally {
      setAdminActionUserId(null);
      setAdminActionKind(null);
    }
  }

  async function handleAdminDeleteUser(user: UserRecord): Promise<void> {
    if (!claims) return;
    const confirmed = window.confirm(`Supprimer le compte @${user.username} ? Cette action est irréversible.`);
    if (!confirmed) return;
    try {
      setAdminActionUserId(user.id);
      setAdminActionKind("delete");
      await apiFetch<{ detail: string }>(`/auth/admin/users/${user.id}`, {
        method: "DELETE",
        headers: jsonHeaders(),
      });
      setToast({ kind: "ok", message: `Compte @${user.username} supprimé.` });
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Suppression impossible" });
    } finally {
      setAdminActionUserId(null);
      setAdminActionKind(null);
    }
  }

  return {
    // ─ Data from context
    token: ctx.token,
    claims,
    userId: ctx.userId,
    role: ctx.role,
    demandes,
    missions,
    services: ctx.services,
    users,
    prestataires,
    userProfile: ctx.userProfile,
    dashboardPending: ctx.dashboardPending,
    refreshDashboard: ctx.refreshDashboard,
    adminAtRisk: ctx.adminAtRisk,
    demandeLabel: ctx.demandeLabel,
    missionLabelById: ctx.missionLabelById,
    demandeLabelById: ctx.demandeLabelById,
    logout: ctx.logout,
    // ─ Local UI state
    adminRoleDraftByUserId,
    setAdminRoleDraftByUserId,
    adminActionUserId,
    adminActionKind,
    // ─ Computed
    providerUsersCount,
    verifiedProvidersCount,
    activeMissionsCount,
    openDemandesCount,
    // ─ Handlers
    handleTogglePrestataireVerified,
    handleAdminChangeUserRole,
    handleAdminDeleteUser,
  };
}
