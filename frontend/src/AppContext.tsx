// ── App-wide context ──────────────────────────────────────────────────────────
// Provides all shared state, setters, and handler functions to workspace
// components so they don't need massive prop drilling.

import { ChangeEvent, createContext, FormEvent, RefObject, useContext } from "react";
import type { SwitchableRole } from "./useRoleSwitching";
import type {
  AtRiskResponse,
  AuthMode,
  AvatarCropTarget,
  BadgeRecord,
  Demande,
  EditDemandeDraft,
  JwtClaims,
  LoyaltyStats,
  MatchingResult,
  Mission,
  PrestataireRecord,
  Role,
  Service,
  ThemeMode,
  ToastState,
  UserProfile,
  UserRecord,
  ZoneNotification,
} from "./types";

export type AppContextValue = {
  // ── Auth / session ──────────────────────────────────────────────────────────
  claims: JwtClaims | null;
  userId: number;
  role: Role | undefined;
  isLoggedIn: boolean;
  claimUsername: string;
  availableRoles: Role[];
  themeMode: ThemeMode;
  updateThemePreference: (next: ThemeMode) => void;
  loginPending: boolean;
  registerPending: boolean;
  dashboardPending: boolean;

  // ── UI ──────────────────────────────────────────────────────────────────────
  toast: ToastState;
  setToast: React.Dispatch<React.SetStateAction<ToastState>>;
  authModeByRole: Record<Extract<Role, "client" | "prestataire">, AuthMode>;
  setAuthModeByRole: React.Dispatch<React.SetStateAction<Record<Extract<Role, "client" | "prestataire">, AuthMode>>>;

  // ── Data ────────────────────────────────────────────────────────────────────
  demandes: Demande[];
  services: Service[];
  missions: Mission[];
  users: UserRecord[];
  prestataires: PrestataireRecord[];
  clientLoyalty: LoyaltyStats | null;
  userBadges: BadgeRecord[];
  adminAtRisk: AtRiskResponse | null;
  matchingByDemande: Record<number, MatchingResult>;
  matchingLoadingByDemande: Record<number, boolean>;

  // ── Derived refs/maps ───────────────────────────────────────────────────────
  demandeRefById: Map<number, string>;
  missionRefById: Map<number, string>;
  clientInitialsById: Map<number, string>;
  demandeLabelById: (id: number) => string;
  missionLabelById: (id: number) => string;

  // ── Profile / avatar ────────────────────────────────────────────────────────
  userProfile: UserProfile | null;
  avatarUploadPending: boolean;
  registerAvatarDataUrl: string | null;
  setRegisterAvatarDataUrl: React.Dispatch<React.SetStateAction<string | null>>;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  registerAvatarInputRef: RefObject<HTMLInputElement | null>;

  // ── Crop modal ──────────────────────────────────────────────────────────────
  cropModalOpen: boolean;
  cropModalClosing: boolean;
  cropSourceDataUrl: string;
  cropImageSize: { width: number; height: number } | null;
  cropZoom: number;
  cropOffsetX: number;
  cropOffsetY: number;
  cropTarget: AvatarCropTarget | null;
  cropPending: boolean;
  handleCropZoomChange: (zoom: number) => void;
  onCropPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCropPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCropPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  closeCropModal: () => void;
  confirmCropSelection: () => Promise<void>;

  // ── Demande detail modal ────────────────────────────────────────────────────
  selectedDemandForDetail: Demande | null;
  demandDetailClosing: boolean;
  openDemandDetailModal: (demande: Demande) => void;
  closeDemandDetailModal: () => void;

  // ── Edit demande modal ──────────────────────────────────────────────────────
  editDemandeTarget: Demande | null;
  editDemandeDraft: EditDemandeDraft | null;
  setEditDemandeDraft: React.Dispatch<React.SetStateAction<EditDemandeDraft | null>>;
  editDemandePending: boolean;
  editModalClosing: boolean;
  handleEditDemande: (demande: Demande) => void;
  closeEditDemandeModal: () => void;
  handleConfirmEditDemande: (e: FormEvent<HTMLFormElement>) => Promise<void>;

  // ── Cancel demande modal ────────────────────────────────────────────────────
  demandeCancelId: number | null;
  cancelModalClosing: boolean;
  handleCancelDemande: (id: number) => void;
  closeCancelDemandeModal: () => void;
  confirmCancelDemande: () => Promise<void>;

  // ── Prestataire settings ────────────────────────────────────────────────────
  visibilityMode: "public" | "discret" | "anonyme";
  setVisibilityMode: React.Dispatch<React.SetStateAction<"public" | "discret" | "anonyme">>;
  visibilityPending: boolean;
  setVisibilityPending: React.Dispatch<React.SetStateAction<boolean>>;
  setPrestataires: React.Dispatch<React.SetStateAction<PrestataireRecord[]>>;
  zonePrefVille: string;
  setZonePrefVille: React.Dispatch<React.SetStateAction<string>>;
  zonePrefArrondissement: string;
  setZonePrefArrondissement: React.Dispatch<React.SetStateAction<string>>;
  zonePrefQuartier: string;
  setZonePrefQuartier: React.Dispatch<React.SetStateAction<string>>;
  zonePrefPending: boolean;
  setZonePrefPending: React.Dispatch<React.SetStateAction<boolean>>;
  zoneNotifications: ZoneNotification[];
  setZoneNotifications: React.Dispatch<React.SetStateAction<ZoneNotification[]>>;
  // ── Unregister modal ────────────────────────────────────────────────────────
  unregisterModalOpen: boolean;
  unregisterPassword: string;
  setUnregisterPassword: React.Dispatch<React.SetStateAction<string>>;
  unregisterPending: boolean;
  unregisterModalClosing: boolean;
  handleUnregister: () => void;
  closeUnregisterModal: () => void;
  confirmUnregister: () => Promise<void>;

  // ── Role switching ──────────────────────────────────────────────────────────
  switchableRoles: SwitchableRole[];
  canSwitchRole: boolean;
  switchRolePending: boolean;
  addRolePending: boolean;
  handleSwitchRole: (role: SwitchableRole) => Promise<void>;
  handleAddRole: (role: SwitchableRole) => Promise<void>;

  // ── Matching preview ────────────────────────────────────────────────────────
  loadClientMatchingPreview: (demandeId: number) => Promise<void>;

  // ── Derived label helpers ───────────────────────────────────────────────────
  demandeLabel: (demande: Demande) => string;
  missionLabel: (mission: Mission) => string;

  // ── Action handlers ─────────────────────────────────────────────────────────
  handleLogin: (e: FormEvent<HTMLFormElement>, expectedRole?: Role) => Promise<void>;
  handleRegister: (e: FormEvent<HTMLFormElement>, role: Extract<Role, "client" | "prestataire">) => Promise<void>;
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRegisterAvatarSelected: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  refreshDashboard: (claims: JwtClaims) => Promise<void>;
  logout: () => void;
};

export const AppCtx = createContext<AppContextValue>(null!);

export function useAppCtx(): AppContextValue {
  return useContext(AppCtx);
}
