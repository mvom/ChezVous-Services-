import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAppCtx } from "../../AppContext";
import { apiFetch, cleanGeo, jsonHeaders } from "../../utils";
import { DEMANDE_DRAFT_KEY, SUB_SERVICES_CONFIG } from "../../constants";
import { demandeGeoLabel } from "../../utils";
import type { ClientStatusFilter, DemandeCategory } from "../../types";

function compareDemandesByRecencyDesc(
  a: { created_at: string; id: number },
  b: { created_at: string; id: number }
): number {
  const left = Date.parse(a.created_at);
  const right = Date.parse(b.created_at);
  const timeDelta = (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
  return timeDelta !== 0 ? timeDelta : b.id - a.id;
}

export function useClientDashboardViewModel() {
  const ctx = useAppCtx();
  const {
    demandes,
    missions,
    userId,
    claims,
    matchingByDemande,
    matchingLoadingByDemande,
    refreshDashboard,
    loadClientMatchingPreview,
    setToast,
  } = ctx;
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>("all");
  const [clientQuery, setClientQuery] = useState("");
  const [newDemandeCategory, setNewDemandeCategory] = useState<DemandeCategory>("menage");
  const [newDemandeSubServices, setNewDemandeSubServices] = useState<string[]>(
    Object.values(SUB_SERVICES_CONFIG.menage?.groups?.[0]?.options || []).map(opt => opt.value).slice(0, 1) || []
  );

  const clientCreateFormRef = useRef<HTMLFormElement | null>(null);

  async function handleCreateDemande(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!claims) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ville = String(formData.get("ville") || "").trim();
    const arrondissement = String(formData.get("arrondissement") || "").trim();
    const quartier = String(formData.get("quartier") || "").trim();
    const clientAvailabilityMode = String(formData.get("client_availability_mode") || "flexible");
    const clientAvailabilityNote = String(formData.get("client_availability_note") || "").trim();
    const requestedDatetimeRaw = String(formData.get("requested_datetime") || "").trim();
    const category = newDemandeCategory;
    let requestedDatetimeLabel = "";
    if (requestedDatetimeRaw) {
      const requestedDate = new Date(requestedDatetimeRaw);
      if (Number.isNaN(requestedDate.getTime())) {
        setToast({ kind: "err", message: "Date/heure demandée invalide." });
        return;
      }
      if (requestedDate.getTime() < Date.now()) {
        setToast({ kind: "err", message: "Vous ne pouvez pas créer une demande sur une date/heure déjà passée." });
        return;
      }
      requestedDatetimeLabel = `Intervention souhaitée: ${requestedDate.toLocaleString("fr-FR")}`;
    }
    const mergedAvailabilityNote = [clientAvailabilityNote, requestedDatetimeLabel].filter(Boolean).join(" | ");
    if (clientAvailabilityMode === "fixe" && mergedAvailabilityNote.length < 5) {
      setToast({ kind: "err", message: "Précisez votre disponibilité (minimum 5 caractères)" });
      return;
    }
    try {
      const payload = {
        client_id: userId,
        category,
        description: String(formData.get("description") || ""),
        location: [ville, arrondissement, quartier].filter(Boolean).join(", "),
        ville,
        arrondissement,
        quartier,
        client_availability_mode: clientAvailabilityMode,
        client_availability_note: mergedAvailabilityNote || null,
        requested_datetime: requestedDatetimeRaw || null,
        priority: String(formData.get("priority") || "normale"),
        sub_services: newDemandeSubServices,
      };
      await apiFetch<void>("/demandes", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
      window.localStorage.setItem(
        DEMANDE_DRAFT_KEY,
        JSON.stringify({
          ville,
          arrondissement,
          quartier,
          category,
          client_availability_mode: clientAvailabilityMode,
          client_availability_note: clientAvailabilityNote,
          requested_datetime: requestedDatetimeRaw,
          priority: payload.priority,
        })
      );
      setToast({ kind: "ok", message: "Demande créée." });
      setNewDemandeSubServices([]);
      form.reset();
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Échec de la création de la demande" });
    }
  }

  async function handleDuplicateDemande(source: import("../../types").Demande): Promise<void> {
    if (!claims) return;
    try {
      await apiFetch<void>("/demandes", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          client_id: userId,
          category: source.category || "menage",
          description: source.description,
          location: [cleanGeo(source.ville), cleanGeo(source.arrondissement), cleanGeo(source.quartier)].filter(Boolean).join(", "),
          ville: cleanGeo(source.ville),
          arrondissement: cleanGeo(source.arrondissement),
          quartier: cleanGeo(source.quartier),
          client_availability_mode: source.client_availability_mode || "flexible",
          client_availability_note: source.client_availability_note || null,
          priority: source.priority || "normale",
        }),
      });
      setToast({ kind: "ok", message: "Demande dupliquee." });
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Duplication impossible" });
    }
  }

  // ── Computed data ────────────────────────────────────────────────────────────
  const clientDemandes = useMemo(
    () => demandes.filter((d) => d.client_id === userId).sort(compareDemandesByRecencyDesc),
    [demandes, userId]
  );
  const clientMissions = useMemo(() => missions.filter((m) => m.client_id === userId), [missions, userId]);

  const loweredQuery = clientQuery.trim().toLowerCase();
  const filteredDemandes = useMemo(
    () =>
      clientDemandes.filter((d) => {
        const matchesStatus = clientStatusFilter === "all" || d.status === clientStatusFilter;
        const matchesQuery =
          loweredQuery.length === 0 ||
          demandeGeoLabel(d).toLowerCase().includes(loweredQuery) ||
          d.location.toLowerCase().includes(loweredQuery) ||
          d.description.toLowerCase().includes(loweredQuery);
        return matchesStatus && matchesQuery;
      }),
    [clientDemandes, clientStatusFilter, loweredQuery]
  );

  const pendingDemandes = useMemo(() => clientDemandes.filter((d) => d.status === "ouverte").length, [clientDemandes]);
  const activeMissions = useMemo(() => clientMissions.filter((m) => m.status === "en_cours").length, [clientMissions]);
  const highPriorityOpen = useMemo(
    () => clientDemandes.filter((d) => d.status === "ouverte" && d.priority === "haute").length,
    [clientDemandes]
  );
  const completedMissions = useMemo(() => clientMissions.filter((m) => m.status === "terminee").length, [clientMissions]);
  const completionRate = clientMissions.length > 0 ? Math.round((completedMissions / clientMissions.length) * 100) : 0;

  const nextScheduledMission = useMemo(
    () =>
      [...clientMissions]
        .filter((m) => m.scheduled_at)
        .sort((a, b) => new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime())[0],
    [clientMissions]
  );

  const latestOpenDemande = useMemo(
    () => [...clientDemandes].filter((d) => d.status === "ouverte").sort(compareDemandesByRecencyDesc)[0],
    [clientDemandes]
  );

  const matchingPreview = latestOpenDemande ? matchingByDemande[latestOpenDemande.id] : null;
  const matchingPreviewPending = latestOpenDemande ? Boolean(matchingLoadingByDemande[latestOpenDemande.id]) : false;
  const topCandidates = matchingPreview?.candidates?.slice(0, 3) || [];

  useEffect(() => {
    if (!latestOpenDemande) {
      return;
    }
    void loadClientMatchingPreview(latestOpenDemande.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestOpenDemande?.id]);

  async function refreshClientDashboard(): Promise<void> {
    if (!claims) {
      return;
    }
    await refreshDashboard(claims);
  }

  async function refreshMatchingPreview(): Promise<void> {
    if (!latestOpenDemande) {
      return;
    }
    await loadClientMatchingPreview(latestOpenDemande.id);
  }

  async function handleValidatePrestataire(demandeId: number, prestataireId: number): Promise<void> {
    if (!claims || !userId) return;
    try {
      await apiFetch<unknown>("/missions", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          demande_id: demandeId,
          client_id: userId,
          prestataire_id: prestataireId,
        }),
      });
      setToast({ kind: "ok", message: "Prestataire validé — mission créée en attente de confirmation." });
      await refreshDashboard(claims);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Échec de la validation" });
    }
  }

  return {
    // Local UI state
    clientStatusFilter,
    setClientStatusFilter,
    clientQuery,
    setClientQuery,
    newDemandeCategory,
    setNewDemandeCategory,
    newDemandeSubServices,
    setNewDemandeSubServices,
    clientCreateFormRef,

    // Modal states (from AppContext — shared with AppOverlays)
    selectedDemandForDetail: ctx.selectedDemandForDetail,
    demandDetailClosing: ctx.demandDetailClosing,
    openDemandDetailModal: ctx.openDemandDetailModal,
    closeDemandDetailModal: ctx.closeDemandDetailModal,
    editDemandeTarget: ctx.editDemandeTarget,
    editDemandeDraft: ctx.editDemandeDraft,
    setEditDemandeDraft: ctx.setEditDemandeDraft,
    editDemandePending: ctx.editDemandePending,
    editModalClosing: ctx.editModalClosing,
    handleEditDemande: ctx.handleEditDemande,
    closeEditDemandeModal: ctx.closeEditDemandeModal,
    handleConfirmEditDemande: ctx.handleConfirmEditDemande,
    demandeCancelId: ctx.demandeCancelId,
    cancelModalClosing: ctx.cancelModalClosing,
    handleCancelDemande: ctx.handleCancelDemande,
    closeCancelDemandeModal: ctx.closeCancelDemandeModal,
    confirmCancelDemande: ctx.confirmCancelDemande,
    unregisterModalOpen: ctx.unregisterModalOpen,
    unregisterPassword: ctx.unregisterPassword,
    setUnregisterPassword: ctx.setUnregisterPassword,
    unregisterPending: ctx.unregisterPending,
    unregisterModalClosing: ctx.unregisterModalClosing,
    handleUnregister: ctx.handleUnregister,
    closeUnregisterModal: ctx.closeUnregisterModal,
    confirmUnregister: ctx.confirmUnregister,

    // Data from context
    demandes,
    services: ctx.services,
    missions,
    userId,
    claims,
    role: ctx.role,
    userProfile: ctx.userProfile,
    avatarInputRef: ctx.avatarInputRef,
    avatarUploadPending: ctx.avatarUploadPending,
    handleAvatarChange: ctx.handleAvatarChange,
    dashboardPending: ctx.dashboardPending,
    clientLoyalty: ctx.clientLoyalty,
    userBadges: ctx.userBadges,
    demandeLabelById: ctx.demandeLabelById,
    missionLabelById: ctx.missionLabelById,
    demandeLabel: ctx.demandeLabel,
    missionLabel: ctx.missionLabel,
    logout: ctx.logout,
    switchableRoles: ctx.switchableRoles,
    canSwitchRole: ctx.canSwitchRole,
    switchRolePending: ctx.switchRolePending,
    addRolePending: ctx.addRolePending,
    handleSwitchRole: ctx.handleSwitchRole,
    handleAddRole: ctx.handleAddRole,

    // Computed data
    clientDemandes,
    clientMissions,
    filteredDemandes,
    pendingDemandes,
    activeMissions,
    highPriorityOpen,
    completedMissions,
    completionRate,
    nextScheduledMission,
    latestOpenDemande,
    matchingPreview,
    matchingPreviewPending,
    topCandidates,

    // Handlers
    refreshClientDashboard,
    refreshMatchingPreview,
    handleCreateDemande,
    handleDuplicateDemande,
    handleValidatePrestataire,
  };
}
