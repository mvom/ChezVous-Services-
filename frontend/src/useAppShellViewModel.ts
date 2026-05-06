import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoleSwitching } from "./useRoleSwitching";
import { useDemandeModals } from "./useDemandeModals";
import { useUnregisterFlow } from "./useUnregisterFlow";
import { useAvatarCrop } from "./useAvatarCrop";
import { useAuthSessionLifecycle } from "./useAuthSessionLifecycle";
import { useAuthActions } from "./useAuthActions";
import { useProfileAvatar } from "./useProfileAvatar";
import { useClientMatching } from "./useClientMatching";
import { useRefreshDashboard } from "./useRefreshDashboard";
import type { AppContextValue } from "./AppContext";
import { MODAL_CLOSE_MS } from "./constants";
import {
  apiFetch,
  cleanGeo,
  dateRefPart,
  demandRef,
  initialsFromActorLabel,
  initialsFromText,
  jsonHeaders,
  readThemePreference,
  roleHomePath,
  sessionToClaims,
  themeStorageKey,
  userFacingError,
} from "./utils";
import type {
  AtRiskResponse,
  AuthMode,
  BadgeRecord,
  Demande,
  JwtClaims,
  LoyaltyStats,
  Mission,
  PrestataireRecord,
  Role,
  Service,
  ThemeMode,
  ToastState,
  UserRecord,
  ZoneNotification,
} from "./types";

export function useAppShellViewModel() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<JwtClaims | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemePreference());
  const [toast, setToast] = useState<ToastState>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);
  const [dashboardPending, setDashboardPending] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [prestataires, setPrestataires] = useState<PrestataireRecord[]>([]);
  const [visibilityMode, setVisibilityMode] = useState<"public" | "discret" | "anonyme">("public");
  const [visibilityPending, setVisibilityPending] = useState(false);
  const [zonePrefVille, setZonePrefVille] = useState("");
  const [zonePrefArrondissement, setZonePrefArrondissement] = useState("");
  const [zonePrefQuartier, setZonePrefQuartier] = useState("");
  const [zonePrefPending, setZonePrefPending] = useState(false);
  const [zoneNotifications, setZoneNotifications] = useState<ZoneNotification[]>([]);
  const [authModeByRole, setAuthModeByRole] = useState<Record<Extract<Role, "client" | "prestataire">, AuthMode>>({
    client: "register",
    prestataire: "register",
  });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const registerAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [registerAvatarDataUrl, setRegisterAvatarDataUrl] = useState<string | null>(null);
  const [clientLoyalty, setClientLoyalty] = useState<LoyaltyStats | null>(null);
  const [userBadges, setUserBadges] = useState<BadgeRecord[]>([]);
  const [adminAtRisk, setAdminAtRisk] = useState<AtRiskResponse | null>(null);

  const {
    userProfile,
    setUserProfile,
    avatarUploadPending,
    setAvatarUploadPending,
    queuePendingAvatarUpload,
    fetchUserProfile,
  } = useProfileAvatar({ apiFetch, jsonHeaders });

  const {
    matchingByDemande,
    matchingLoadingByDemande,
    loadClientMatchingPreview,
    resetClientMatching,
  } = useClientMatching({ apiFetch, setToast });

  function normalizeAvailableRoles(raw: Role[] | undefined, fallbackRole?: Role): Role[] {
    const filtered = (raw || []).filter((value): value is Role => value === "client" || value === "prestataire" || value === "admin");
    const deduped = Array.from(new Set(filtered));
    if (deduped.length > 0) {
      return deduped;
    }
    return fallbackRole ? [fallbackRole] : [];
  }

  const { refreshDashboard } = useRefreshDashboard({
    apiFetch,
    navigate,
    roleHomePath,
    normalizeAvailableRoles,
    setClaims,
    setAvailableRoles,
    setDashboardPending,
    setToast,
    setDemandes,
    setServices,
    setMissions,
    setUsers,
    setPrestataires,
    setVisibilityMode,
    setZonePrefVille,
    setZonePrefArrondissement,
    setZonePrefQuartier,
    setZoneNotifications,
    setClientLoyalty,
    setUserBadges,
    setAdminAtRisk,
    loadClientMatchingPreview,
    fetchUserProfile,
  });

  const claimUserId = Number(claims?.sub || 0);
  const claimUsername = userProfile?.username || claims?.username || "";

  const { clientInitialsById, demandeRefById, demandeById, missionRefById, missionById } = useMemo(() => {
    const nextClientInitialsById = new Map<number, string>();

    users.forEach((user) => {
      nextClientInitialsById.set(user.id, initialsFromText(`${user.first_name} ${user.last_name}`));
    });

    if (claimUserId > 0 && !nextClientInitialsById.has(claimUserId)) {
      nextClientInitialsById.set(claimUserId, initialsFromText(claimUsername));
    }

    const demandesForRefs = [...demandes].sort((a, b) => {
      const tA = Date.parse(a.created_at);
      const tB = Date.parse(b.created_at);
      if (tA !== tB) return tA - tB;
      return a.id - b.id;
    });

    const nextDemandeRefById = new Map<number, string>();
    const demandeOrderByClient = new Map<number, number>();
    demandesForRefs.forEach((demande) => {
      const fromEvent = demande.events.find((e) => e.event_type === "cree" || e.event_type === "created");
      const fallbackInitials = initialsFromActorLabel(fromEvent?.actor_label) || initialsFromActorLabel(demande.events[0]?.actor_label) || "CL";
      const initials = nextClientInitialsById.get(demande.client_id) || fallbackInitials;
      nextClientInitialsById.set(demande.client_id, initials);
      const order = (demandeOrderByClient.get(demande.client_id) || 0) + 1;
      demandeOrderByClient.set(demande.client_id, order);
      nextDemandeRefById.set(demande.id, demandRef("DEM", initials, dateRefPart(demande.created_at), order));
    });

    const nextDemandeById = new Map<number, Demande>(demandes.map((d) => [d.id, d]));

    const missionsForRefs = [...missions].sort((a, b) => {
      const tA = Date.parse(a.created_at);
      const tB = Date.parse(b.created_at);
      if (tA !== tB) return tA - tB;
      return a.id - b.id;
    });

    const nextMissionRefById = new Map<number, string>();
    const missionOrderByClient = new Map<number, number>();
    missionsForRefs.forEach((mission) => {
      const linkedDemande = nextDemandeById.get(mission.demande_id);
      const initials =
        nextClientInitialsById.get(mission.client_id) ||
        (linkedDemande ? initialsFromActorLabel(linkedDemande.events[0]?.actor_label) : null) ||
        "CL";
      nextClientInitialsById.set(mission.client_id, initials);
      const order = (missionOrderByClient.get(mission.client_id) || 0) + 1;
      missionOrderByClient.set(mission.client_id, order);
      nextMissionRefById.set(mission.id, demandRef("SRV", initials, dateRefPart(mission.created_at), order));
    });

    const nextMissionById = new Map<number, Mission>(missions.map((m) => [m.id, m]));

    return {
      clientInitialsById: nextClientInitialsById,
      demandeRefById: nextDemandeRefById,
      demandeById: nextDemandeById,
      missionRefById: nextMissionRefById,
      missionById: nextMissionById,
    };
  }, [users, claimUserId, claimUsername, demandes, missions]);

  useEffect(() => {
    setThemeMode(readThemePreference(claimUsername || claims?.username));
  }, [claimUsername, claims?.username]);

  function updateThemePreference(nextTheme: ThemeMode): void {
    const userKey = (claimUsername || claims?.username || "").trim();
    window.localStorage.setItem(themeStorageKey(userKey), nextTheme);
    setThemeMode(nextTheme);
  }

  function demandeLabelById(demandeId: number): string {
    const known = demandeRefById.get(demandeId);
    if (known) return known;
    const demande = demandeById.get(demandeId);
    if (!demande) return `DEM-CL-${dateRefPart()}-${String(demandeId).padStart(3, "0")}`;
    return `DEM-CL-${dateRefPart(demande.created_at)}-${String(demandeId).padStart(3, "0")}`;
  }

  function demandeLabel(demande: Demande): string {
    return demandeLabelById(demande.id);
  }

  function missionLabelById(missionId: number): string {
    const known = missionRefById.get(missionId);
    if (known) return known;
    const mission = missionById.get(missionId);
    if (!mission) return `SRV-CL-${dateRefPart()}-${String(missionId).padStart(3, "0")}`;
    return `SRV-CL-${dateRefPart(mission.created_at)}-${String(missionId).padStart(3, "0")}`;
  }

  function missionLabel(mission: Mission): string {
    return missionLabelById(mission.id);
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // Clear state on logout
  useEffect(() => {
    if (claims) return;
    setDemandes([]);
    setServices([]);
    setMissions([]);
    setUsers([]);
    setPrestataires([]);
    setVisibilityMode("public");
    setZonePrefVille("");
    setZonePrefArrondissement("");
    setZonePrefQuartier("");
    setZoneNotifications([]);
    setAvailableRoles([]);
    resetClientMatching();
    setClientLoyalty(null);
    setUserBadges([]);
    setAdminAtRisk(null);
    setUserProfile(null);
  }, [claims]);

  useAuthSessionLifecycle({
    claims,
    availableRoles,
    setClaims,
    setAvailableRoles,
    setToast,
    apiFetch,
    normalizeAvailableRoles,
    sessionToClaims,
    refreshDashboard,
    onSessionExpired: () => navigate("/", { replace: true }),
  });

  const role = claims?.role;
  const userId = Number(claims?.sub || 0);
  const isLoggedIn = Boolean(claims);

  const { handleLogin, handleRegister, logout } = useAuthActions({
    apiFetch,
    setClaims,
    setAvailableRoles,
    normalizeAvailableRoles,
    sessionToClaims,
    refreshDashboard,
    setToast,
    setLoginPending,
    setRegisterPending,
    registerAvatarDataUrl,
    queuePendingAvatarUpload,
    setRegisterAvatarDataUrl,
    setDemandes,
    setServices,
    setMissions,
    userFacingError,
  });

  const {
    demandeCancelId,
    editDemandeTarget,
    editDemandeDraft,
    editDemandePending,
    demandDetailClosing,
    editModalClosing,
    cancelModalClosing,
    selectedDemandForDetail,
    setEditDemandeDraft,
    openDemandDetailModal,
    closeDemandDetailModal,
    handleEditDemande,
    closeEditDemandeModal,
    handleConfirmEditDemande,
    handleCancelDemande,
    closeCancelDemandeModal,
    confirmCancelDemande,
  } = useDemandeModals({
    claims,
    modalCloseMs: MODAL_CLOSE_MS,
    cleanGeo,
    apiFetch,
    setToast,
    refreshDashboard,
  });

  const {
    unregisterModalOpen,
    unregisterPassword,
    unregisterPending,
    unregisterModalClosing,
    setUnregisterPassword,
    handleUnregister,
    closeUnregisterModal,
    confirmUnregister,
  } = useUnregisterFlow({
    modalCloseMs: MODAL_CLOSE_MS,
    apiFetch,
    setToast,
    logout,
    navigateHome: () => navigate("/", { replace: true }),
  });

  const {
    cropModalOpen,
    cropSourceDataUrl,
    cropImageSize,
    cropZoom,
    cropOffsetX,
    cropOffsetY,
    cropTarget,
    cropPending,
    cropModalClosing,
    handleAvatarChange,
    handleRegisterAvatarSelected,
    closeCropModal,
    handleCropZoomChange,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    confirmCropSelection,
    avatarDisplaySize,
  } = useAvatarCrop({
    modalCloseMs: MODAL_CLOSE_MS,
    apiFetch,
    setToast,
    setAvatarUploadPending,
    setRegisterAvatarDataUrl,
    setUserProfile,
  });

  const {
    switchableRoles,
    canSwitchRole,
    addRolePending,
    switchRolePending,
    handleAddRole,
    handleSwitchRole,
  } = useRoleSwitching({
    activeRole: role,
    availableRoles,
    setClaims,
    setAvailableRoles,
    setToast,
    apiFetch,
    normalizeAvailableRoles,
  });

  function handleThemeVioletClick(): void {
    updateThemePreference("violet");
  }

  function handleThemeRoseClick(): void {
    updateThemePreference("rose");
  }

  function handleClientAuthAccessClick(): void {
    navigate("/auth/client");
  }

  function handlePrestataireAuthAccessClick(): void {
    navigate("/auth/prestataire");
  }

  function handleAdminLoginSubmit(event: FormEvent<HTMLFormElement>): void {
    void handleLogin(event, "admin");
  }

  const contextValue: AppContextValue = {
    claims, userId, role, isLoggedIn, claimUsername, availableRoles,
    themeMode, updateThemePreference, loginPending, registerPending, dashboardPending,
    authModeByRole, setAuthModeByRole,
    demandes, services, missions, users, prestataires,
    clientLoyalty, userBadges, adminAtRisk,
    matchingByDemande, matchingLoadingByDemande,
    demandeRefById, missionRefById, clientInitialsById,
    demandeLabelById, missionLabelById,
    userProfile, avatarUploadPending, registerAvatarDataUrl, setRegisterAvatarDataUrl,
    avatarInputRef, registerAvatarInputRef,
    cropModalOpen, cropModalClosing, cropSourceDataUrl, cropImageSize, cropZoom,
    cropOffsetX, cropOffsetY, cropTarget, cropPending,
    handleCropZoomChange, onCropPointerDown, onCropPointerMove, onCropPointerUp,
    closeCropModal, confirmCropSelection,
    selectedDemandForDetail, demandDetailClosing, openDemandDetailModal, closeDemandDetailModal,
    editDemandeTarget, editDemandeDraft, setEditDemandeDraft, editDemandePending, editModalClosing,
    handleEditDemande, closeEditDemandeModal, handleConfirmEditDemande,
    demandeCancelId, cancelModalClosing, handleCancelDemande, closeCancelDemandeModal, confirmCancelDemande,
    visibilityMode, setVisibilityMode, visibilityPending, setVisibilityPending,
    setPrestataires,
    zonePrefVille, setZonePrefVille,
    zonePrefArrondissement, setZonePrefArrondissement,
    zonePrefQuartier, setZonePrefQuartier,
    zonePrefPending, setZonePrefPending, zoneNotifications, setZoneNotifications,
    unregisterModalOpen, unregisterPassword, setUnregisterPassword,
    unregisterPending, unregisterModalClosing,
    handleUnregister, closeUnregisterModal, confirmUnregister,
    switchableRoles, canSwitchRole, switchRolePending, addRolePending,
    handleSwitchRole, handleAddRole,
    loadClientMatchingPreview,
    demandeLabel, missionLabel,
    toast, setToast,
    handleLogin, handleRegister,
    handleAvatarChange, handleRegisterAvatarSelected,
    refreshDashboard, logout,
  };

  return {
    contextValue,
    themeMode,
    role,
    isLoggedIn,
    loginPending,
    toast,
    handleThemeVioletClick,
    handleThemeRoseClick,
    handleClientAuthAccessClick,
    handlePrestataireAuthAccessClick,
    handleAdminLoginSubmit,
    selectedDemandForDetail,
    demandDetailClosing,
    closeDemandDetailModal,
    demandeLabel,
    demandeLabelById,
    editDemandeTarget,
    editDemandeDraft,
    setEditDemandeDraft,
    editDemandePending,
    editModalClosing,
    handleConfirmEditDemande,
    closeEditDemandeModal,
    demandeCancelId,
    cancelModalClosing,
    closeCancelDemandeModal,
    confirmCancelDemande,
    unregisterModalOpen,
    unregisterModalClosing,
    unregisterPassword,
    setUnregisterPassword,
    unregisterPending,
    closeUnregisterModal,
    confirmUnregister,
    cropModalOpen,
    cropModalClosing,
    cropImageSize,
    cropSourceDataUrl,
    cropZoom,
    cropOffsetX,
    cropOffsetY,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    handleCropZoomChange,
    closeCropModal,
    confirmCropSelection,
    cropPending,
    avatarDisplaySize,
  };
}
