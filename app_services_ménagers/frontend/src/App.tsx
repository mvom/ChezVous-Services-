import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  AVAILABILITY_LABELS,
  EVENT_TEXT,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STEP_LABELS,
} from "./labels";

type Role = "client" | "prestataire" | "admin";

type JwtClaims = {
  sub?: string;
  role?: Role;
  username?: string;
  exp?: number;
};

type UserProfile = {
  username: string;
  avatar_url: string | null;
};

type UserRecord = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  address: string;
  phone: string;
  role: Role;
  avatar_url?: string | null;
};

type PrestataireRecord = {
  user_id: number;
  rating: number;
  verified: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type Demande = {
  id: number;
  client_id: number;
  status: string;
  priority: string;
  description: string;
  location: string;
  ville?: string | null;
  arrondissement?: string | null;
  quartier?: string | null;
  client_availability_mode?: string;
  client_availability_note?: string | null;
  created_at: string;
  updated_at: string;
  events: DemandeEvent[];
};

type DemandeEvent = {
  id: number;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  actor_user_id?: number | null;
  actor_label?: string | null;
  created_at: string;
};

type Service = {
  id: number;
  prestataire_id: number;
  name: string;
  description: string;
  availability_slots: string;
  price: number;
  created_at: string;
  updated_at: string;
};

type PrestataireTrust = {
  verified: boolean;
  rating: number;
  completed_missions: number;
  total_missions: number;
  average_response_minutes?: number | null;
  eta_reliability_percent: number;
};

type PrestataireMissionSummary = {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
  trust: PrestataireTrust;
};

type Mission = {
  id: number;
  demande_id: number;
  client_id: number;
  prestataire_id: number;
  service_id?: number | null;
  status: string;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
  prestataire_summary?: PrestataireMissionSummary | null;
};

type MatchingCandidate = {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
  trust: PrestataireTrust;
  score_total: number;
  score_zone: number;
  score_rating: number;
  score_completion: number;
  score_response: number;
  distance_km?: number | null;
};

type MatchingResult = {
  demande_id: number;
  available_count: number;
  candidates: MatchingCandidate[];
};

type LoyaltyStats = {
  loyalty_points: number;
  completed_missions_count: number;
  next_milestone: number;
  progress_percent: number;
};

type BadgeRecord = {
  id: number;
  user_id: number;
  slug: string;
  awarded_at: string;
};

type AtRiskMission = {
  mission_id: number;
  demande_id: number;
  client_id: number;
  prestataire_id: number;
  scheduled_at?: string | null;
};

type AtRiskResponse = {
  status: string;
  checked_at: string;
  threshold_at: string;
  count: number;
  missions: AtRiskMission[];
};

type ToastState = {
  kind: "ok" | "err";
  message: string;
} | null;

type AuthMode = "login" | "register";

type ClientStatusFilter = "all" | "ouverte" | "attribuee" | "annulee" | "expiree";
type PrestataireStatusFilter = "all" | "ouverte" | "attribuee";
type AvatarCropTarget = "profile" | "register";
type PipelineCardFilter = "all" | "urgent" | "scheduled";
type AvailabilityMode = "flexible" | "fixe";

type EditDemandeDraft = {
  description: string;
  ville: string;
  arrondissement: string;
  quartier: string;
  client_availability_mode: AvailabilityMode;
  client_availability_note: string;
  priority: string;
};

function cleanGeo(value?: string | null): string {
  return (value || "").trim();
}

function demandeGeoLabel(demande: Demande): string {
  const parts = [cleanGeo(demande.ville), cleanGeo(demande.arrondissement), cleanGeo(demande.quartier)].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return (demande.location || "Localisation indisponible").trim();
}

function clientAvailabilityLabel(demande: Demande): string {
  const mode = (demande.client_availability_mode || "flexible").toLowerCase();
  const note = (demande.client_availability_note || "").trim();
  const modeLabel = AVAILABILITY_LABELS[mode] ?? (note || AVAILABILITY_LABELS.fixe);
  return note && mode !== "flexible" ? `Disponibilité client : ${note}` : `Disponibilité client : ${modeLabel}`;
}

const AVATAR_CROP_VIEW_SIZE = 320;
const AVATAR_EXPORT_SIZE = 1024;

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire l'image"));
    reader.readAsDataURL(file);
  });
}

async function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Image invalide"));
    nextImage.src = dataUrl;
  });
  return { width: img.width, height: img.height };
}

function avatarDisplaySize(width: number, height: number, zoom: number): { width: number; height: number } {
  const baseScale = Math.max(AVATAR_CROP_VIEW_SIZE / width, AVATAR_CROP_VIEW_SIZE / height);
  return {
    width: width * baseScale * zoom,
    height: height * baseScale * zoom,
  };
}

function clampAvatarOffset(width: number, height: number, zoom: number, x: number, y: number): { x: number; y: number } {
  const display = avatarDisplaySize(width, height, zoom);
  const maxX = Math.max(0, (display.width - AVATAR_CROP_VIEW_SIZE) / 2);
  const maxY = Math.max(0, (display.height - AVATAR_CROP_VIEW_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

async function exportAvatarCrop(
  sourceDataUrl: string,
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = sourceDataUrl;
  });

  const display = avatarDisplaySize(width, height, zoom);
  const imageLeft = (AVATAR_CROP_VIEW_SIZE - display.width) / 2 + offsetX;
  const imageTop = (AVATAR_CROP_VIEW_SIZE - display.height) / 2 + offsetY;
  const ratioX = width / display.width;
  const ratioY = height / display.height;

  const sourceX = Math.max(0, (0 - imageLeft) * ratioX);
  const sourceY = Math.max(0, (0 - imageTop) * ratioY);
  const sourceW = Math.min(width - sourceX, AVATAR_CROP_VIEW_SIZE * ratioX);
  const sourceH = Math.min(height - sourceY, AVATAR_CROP_VIEW_SIZE * ratioY);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EXPORT_SIZE;
  canvas.height = AVATAR_EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas non disponible");
  }

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE);
  const qualities = [0.92, 0.86, 0.8, 0.72, 0.65];
  let best = canvas.toDataURL("image/jpeg", qualities[0]);
  for (const quality of qualities) {
    const candidate = canvas.toDataURL("image/jpeg", quality);
    best = candidate;
    if (candidate.length <= 3_000_000) {
      break;
    }
  }
  return best;
}

const API_BASE = "http://localhost:8000/api/v1";
const TOKEN_KEY = "sm_token";
const DEMANDE_DRAFT_KEY = "sm_last_demande_draft";
const HIDDEN_ADMIN_PATH = "/_staff/console";
const TOKEN_REFRESH_SKEW_SECONDS = 90;

function decodeJwt(jwtToken: string): JwtClaims | null {
  if (!jwtToken || jwtToken.split(".").length !== 3) {
    return null;
  }

  try {
    const payload = jwtToken.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized)) as JwtClaims;
  } catch {
    return null;
  }
}

function isTokenExpired(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp <= nowEpochSeconds;
}

function shouldActualiserToken(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp - nowEpochSeconds <= TOKEN_REFRESH_SKEW_SECONDS;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body: unknown = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof body === "string"
        ? body
        : typeof body === "object" && body !== null && "detail" in body
          ? String((body as { detail?: unknown }).detail || "")
          : "";
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return body as T;
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function roleHomePath(role?: Role): string {
  if (role === "client") {
    return "/espace/client";
  }
  if (role === "prestataire") {
    return "/espace/prestataire";
  }
  if (role === "admin") {
    return HIDDEN_ADMIN_PATH;
  }
  return "/";
}

function formatCameroonPhone(value: string): string {
  const compact = value.replace(/\s+/g, "").trim();
  const normalized = compact.startsWith("+237") ? compact : `+237${compact.replace(/^\+/, "")}`;
  const digits = normalized.replace("+237", "");
  if (!/^\d{9}$/.test(digits)) {
    return value;
  }
  return `+237 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function normalizePersonName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return cleaned;
  }
  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function userFacingError(error: unknown, fallbackMessage: string, context: string): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  console.error(`[debug:${context}]`, error);

  const rawMessage = (error.message || "").trim();
  if (!rawMessage) {
    return fallbackMessage;
  }

  const lowered = rawMessage.toLowerCase();
  if (lowered.includes("cannot read properties of null") || lowered.includes("cannot read property")) {
    return fallbackMessage;
  }

  return rawMessage;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Date indisponible";
  }
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return "Date indisponible";
  }
  return asDate.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function demandeStatusTone(status: string): "green" | "blue" | "orange" | "gray" {
  if (status === "ouverte") {
    return "green";
  }
  if (status === "attribuee") {
    return "blue";
  }
  if (status === "annulee") {
    return "orange";
  }
  return "gray";
}

function demandeStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusChipClass(status: string): string {
  const base = "status-chip";
  if (status === "ouverte") return `${base} chip-ouverte`;
  if (status === "attribuee") return `${base} chip-attribuee`;
  if (status === "annulee") return `${base} chip-annulee`;
  if (status === "expiree") return `${base} chip-expiree`;
  if (status === "en_cours") return `${base} chip-en-cours`;
  if (status === "terminee") return `${base} chip-terminee`;
  return base;
}

function formatStatusLabel(status?: string | null): string {
  if (!status) return "statut inconnu";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function demandeEventText(event: DemandeEvent): string {
  if (EVENT_TEXT[event.event_type]) return EVENT_TEXT[event.event_type];
  if (event.previous_status && event.new_status) {
    return `Transition : ${formatStatusLabel(event.previous_status)} → ${formatStatusLabel(event.new_status)}`;
  }
  if (event.new_status) {
    return `Statut : ${formatStatusLabel(event.new_status)}`;
  }
  return formatStatusLabel(event.event_type);
}

type DemandeStepBadge = {
  key: "publiee" | "attribuee" | "en_cours" | "terminee" | "notee";
  label: string;
};

function demandeEventStepBadge(event: DemandeEvent): DemandeStepBadge | null {
  const step = (event.new_status || event.event_type || "").toLowerCase();

  if (step === "cree" || step === "ouverte" || step === "publiee") {
    return { key: "publiee", label: STEP_LABELS.publiee };
  }
  if (step === "attribuee" || step === "acceptee" || step === "confirmee") {
    return { key: "attribuee", label: STEP_LABELS.attribuee };
  }
  if (step === "en_cours") {
    return { key: "en_cours", label: STEP_LABELS.en_cours };
  }
  if (step === "terminee") {
    return { key: "terminee", label: STEP_LABELS.terminee };
  }
  if (step === "notee") {
    return { key: "notee", label: STEP_LABELS.notee };
  }

  return null;
}

function demandeEventActor(event: DemandeEvent): string {
  if (event.actor_label) {
    return event.actor_label;
  }
  if (event.actor_user_id) {
    return `Utilisateur #${event.actor_user_id}`;
  }
  return "Système";
}

function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? "Normale";
}

function priorityClass(priority: string): string {
  return PRIORITY_CLASSES[priority] ?? "priority-badge priority-normale";
}

function groupEventsByDay(events: DemandeEvent[]): { day: string; events: DemandeEvent[] }[] {
  const groups: Map<string, DemandeEvent[]> = new Map();
  for (const ev of events) {
    const day = new Date(ev.created_at).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(ev);
  }
  return Array.from(groups.entries()).map(([day, evs]) => ({ day, events: evs }));
}

function missionPipelineStatus(status: string): "pending" | "active" | "done" | "other" {
  if (status === "en_attente" || status === "acceptee" || status === "confirmee") return "pending";
  if (status === "en_cours") return "active";
  if (status === "terminee") return "done";
  return "other";
}

function demandeProgressIndex(status: string): number {
  if (status === "ouverte") return 0;
  if (status === "attribuee") return 1;
  if (status === "en_cours") return 2;
  if (status === "terminee") return 3;
  return 0;
}

function demandeProgressSteps(status: string): Array<{ key: string; label: string; done: boolean; active: boolean }> {
  const index = demandeProgressIndex(status);
  const raw = [
    { key: "ouverte", label: "Créée" },
    { key: "attribuee", label: "Acceptée" },
    { key: "en_cours", label: "En cours" },
    { key: "terminee", label: "Terminee" },
  ];

  return raw.map((step, i) => ({
    ...step,
    done: i < index,
    active: i === index,
  }));
}

function formatResponseDelay(value?: number | null): string {
  if (value == null) {
    return "Réponse : indisponible";
  }
  if (value < 60) {
    return `Réponse moyenne : ${value} min`;
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (minutes === 0) {
    return `Réponse moyenne : ${hours} h`;
  }
  return `Réponse moyenne : ${hours} h ${minutes} min`;
}

function etaReliabilityLabel(value: number): string {
  if (value >= 85) return `ETA fiable : ${value}%`;
  if (value >= 60) return `ETA assez fiable : ${value}%`;
  return `ETA à confirmer : ${value}%`;
}

function trustBadgeTone(value: number): string {
  if (value >= 85) return "trust-badge trust-badge--strong";
  if (value >= 60) return "trust-badge trust-badge--medium";
  return "trust-badge trust-badge--soft";
}

function badgeLabel(slug: string): string {
  if (slug === "mission-5") return "Pro en progression (5 missions)";
  if (slug === "mission-10") return "Pro de confiance (10 missions)";
  if (slug === "mission-20") return "Pro élite (20 missions)";
  return slug;
}

function scoreBarClass(value: number): string {
  if (value >= 85) return "score-pill score-pill--strong";
  if (value >= 60) return "score-pill score-pill--medium";
  return "score-pill score-pill--soft";
}

function renderPrestataireTrust(summary?: PrestataireMissionSummary | null): JSX.Element | null {
  if (!summary) {
    return null;
  }

  const trust = summary.trust;
  return (
    <div className="provider-trust-card">
      <div className="provider-trust-head">
        <strong>{summary.display_name}</strong>
        <span className="provider-trust-rating">Note {trust.rating.toFixed(1)}/5</span>
      </div>
      <div className="provider-trust-badges">
        {trust.verified ? <span className="trust-badge trust-badge--verified">Vérifié</span> : null}
        <span className="trust-badge">{trust.completed_missions} missions terminées</span>
        <span className="trust-badge">{formatResponseDelay(trust.average_response_minutes)}</span>
        <span className={trustBadgeTone(trust.eta_reliability_percent)}>{etaReliabilityLabel(trust.eta_reliability_percent)}</span>
      </div>
    </div>
  );
}

function renderSkeletonList(prefix: string, count = 3): JSX.Element[] {
  return Array.from({ length: count }).map((_, index) => (
    <li key={`${prefix}-${index}`} className="skeleton-item">
      <div className="skeleton-line skeleton-line--lg" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line--sm" />
    </li>
  ));
}

const MODAL_CLOSE_MS = 180;

function AppShell(): JSX.Element {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [claims, setClaims] = useState<JwtClaims | null>(() => decodeJwt(window.localStorage.getItem(TOKEN_KEY) || ""));
  const [toast, setToast] = useState<ToastState>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);
  const [dashboardPending, setDashboardPending] = useState(false);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [prestataires, setPrestataires] = useState<PrestataireRecord[]>([]);
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>("all");
  const [clientQuery, setClientQuery] = useState("");
  const [prestataireStatusFilter, setPrestataireStatusFilter] = useState<PrestataireStatusFilter>("ouverte");
  const [prestataireVilleFilter, setPrestataireVilleFilter] = useState("all");
  const [prestataireArrondissementFilter, setPrestataireArrondissementFilter] = useState("all");
  const [prestataireQuartierFilter, setPrestataireQuartierFilter] = useState("all");
  const [pipelineVisibleCount, setPipelineVisibleCount] = useState<5 | 10>(5);
  const [pipelineCardFilter, setPipelineCardFilter] = useState<PipelineCardFilter>("all");
  const [pipelineIdQuery, setPipelineIdQuery] = useState("");
  const [missionPendingId, setMissionPendingId] = useState<number | null>(null);
  const [demandeCancelId, setDemandeCancelId] = useState<number | null>(null);
  const [unregisterModalOpen, setUnregisterModalOpen] = useState(false);
  const [unregisterPassword, setUnregisterPassword] = useState("");
  const [unregisterPending, setUnregisterPending] = useState(false);
  const [editDemandeTarget, setEditDemandeTarget] = useState<Demande | null>(null);
  const [editDemandeDraft, setEditDemandeDraft] = useState<EditDemandeDraft | null>(null);
  const [editDemandePending, setEditDemandePending] = useState(false);
  const [demandDetailClosing, setDemandDetailClosing] = useState(false);
  const [cropModalClosing, setCropModalClosing] = useState(false);
  const [editModalClosing, setEditModalClosing] = useState(false);
  const [cancelModalClosing, setCancelModalClosing] = useState(false);
  const [unregisterModalClosing, setUnregisterModalClosing] = useState(false);
  const [authModeByRole, setAuthModeByRole] = useState<Record<Extract<Role, "client" | "prestataire">, AuthMode>>({
    client: "register",
    prestataire: "register",
  });
  const clientCreateFormRef = useRef<HTMLFormElement | null>(null);
  const prestataireCreateServiceRef = useRef<HTMLFormElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const registerAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAvatarRef = useRef<string | null>(null);
  const cropDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);
  const [registerAvatarDataUrl, setRegisterAvatarDataUrl] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourceDataUrl, setCropSourceDataUrl] = useState("");
  const [cropImageSize, setCropImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [cropTarget, setCropTarget] = useState<AvatarCropTarget | null>(null);
  const [cropPending, setCropPending] = useState(false);
  const [selectedDemandForDetail, setSelectedDemandForDetail] = useState<Demande | null>(null);
  const [matchingByDemande, setMatchingByDemande] = useState<Record<number, MatchingResult>>({});
  const [matchingLoadingByDemande, setMatchingLoadingByDemande] = useState<Record<number, boolean>>({});
  const [matchingToastDemandes, setMatchingToastDemandes] = useState<number[]>([]);
  const [clientLoyalty, setClientLoyalty] = useState<LoyaltyStats | null>(null);
  const [userBadges, setUserBadges] = useState<BadgeRecord[]>([]);
  const [adminAtRisk, setAdminAtRisk] = useState<AtRiskResponse | null>(null);
  const [adminRoleDraftByUserId, setAdminRoleDraftByUserId] = useState<Record<number, Role>>({});
  const [adminActionUserId, setAdminActionUserId] = useState<number | null>(null);
  const [adminActionKind, setAdminActionKind] = useState<"role" | "delete" | null>(null);
  const tokenActualiserPendingRef = useRef(false);

  async function refreshSessionToken(currentToken: string): Promise<boolean> {
    if (tokenActualiserPendingRef.current) {
      return false;
    }
    tokenActualiserPendingRef.current = true;
    try {
      const result = await apiFetch<LoginResponse>("/auth/refresh", {
        method: "POST",
        headers: authHeaders(currentToken),
      });
      const refreshedClaims = decodeJwt(result.access_token);
      if (!refreshedClaims?.role) {
        throw new Error("Token de session invalide");
      }
      setToken(result.access_token);
      return true;
    } catch {
      setToast({ kind: "err", message: "Session expirée, veuillez vous reconnecter." });
      setToken("");
      setClaims(null);
      return false;
    } finally {
      tokenActualiserPendingRef.current = false;
    }
  }

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const nextClaims = decodeJwt(token);
    setClaims(nextClaims);

    if (!token || !nextClaims) {
      setDemandes([]);
      setServices([]);
      setMissions([]);
      setUsers([]);
      setPrestataires([]);
      setMatchingByDemande({});
      setMatchingLoadingByDemande({});
      setMatchingToastDemandes([]);
      setClientLoyalty(null);
      setUserBadges([]);
      setAdminAtRisk(null);
      setUserProfile(null);
      window.localStorage.removeItem(TOKEN_KEY);
      navigate("/", { replace: true });
      return;
    }

    if (isTokenExpired(nextClaims)) {
      setToast({ kind: "err", message: "Session expirée, veuillez vous reconnecter." });
      window.localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setClaims(null);
      navigate("/", { replace: true });
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
    void refreshDashboard(nextClaims, token);
  }, [token]);

  useEffect(() => {
    if (!token || !claims || !claims.exp) {
      return undefined;
    }

    const maybeActualiser = async () => {
      const currentClaims = decodeJwt(token);
      if (!currentClaims) {
        setToken("");
        return;
      }

      if (isTokenExpired(currentClaims)) {
        setToast({ kind: "err", message: "Session expirée, veuillez vous reconnecter." });
        setToken("");
        return;
      }

      if (shouldActualiserToken(currentClaims)) {
        await refreshSessionToken(token);
      }
    };

    void maybeActualiser();
    const intervalId = window.setInterval(() => {
      void maybeActualiser();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token, claims]);

  async function fetchUserProfile(nextToken: string): Promise<void> {
    try {
      const profile = await apiFetch<UserProfile>("/auth/me", { headers: authHeaders(nextToken) });
      setUserProfile(profile);
      if (pendingAvatarRef.current) {
        const avatarData = pendingAvatarRef.current;
        pendingAvatarRef.current = null;
        await apiFetch<UserProfile>("/auth/me/avatar", {
          method: "PATCH",
          headers: authHeaders(nextToken),
          body: JSON.stringify({ avatar_url: avatarData }),
        });
        setUserProfile((prev) => prev ? { ...prev, avatar_url: avatarData } : prev);
      }
    } catch {
      // Non-critical
    }
  }

  async function loadClientMatchingPreview(nextToken: string, demandeId: number): Promise<void> {
    if (!demandeId) {
      return;
    }
    setMatchingLoadingByDemande((prev) => ({ ...prev, [demandeId]: true }));
    try {
      const result = await apiFetch<MatchingResult>(`/demandes/${demandeId}/matching`, { headers: authHeaders(nextToken) });
      setMatchingByDemande((prev) => ({ ...prev, [demandeId]: result }));
      if (result.available_count > 0 && !matchingToastDemandes.includes(demandeId)) {
        setToast({ kind: "ok", message: `${result.available_count} prestataire(s) compatible(s) dans votre zone.` });
        setMatchingToastDemandes((prev) => [...prev, demandeId]);
      }
    } catch {
      // best effort widget
    } finally {
      setMatchingLoadingByDemande((prev) => ({ ...prev, [demandeId]: false }));
    }
  }

  async function refreshDashboard(nextClaims: JwtClaims, nextToken: string) {
    if (!nextClaims.sub) {
      return;
    }

    try {
      setDashboardPending(true);
      const [nextDemandes, nextServices, nextMissions, nextUsers, nextPrestataires, nextLoyalty, nextBadges, nextAtRisk] = await Promise.all([
        apiFetch<Demande[]>("/demandes", { headers: authHeaders(nextToken) }),
        apiFetch<Service[]>("/services", { headers: authHeaders(nextToken) }),
        apiFetch<Mission[]>("/missions", { headers: authHeaders(nextToken) }),
        nextClaims.role === "admin"
          ? apiFetch<UserRecord[]>("/auth/users", { headers: authHeaders(nextToken) })
          : Promise.resolve([] as UserRecord[]),
        nextClaims.role === "admin"
          ? apiFetch<PrestataireRecord[]>("/prestataires", { headers: authHeaders(nextToken) })
          : Promise.resolve([] as PrestataireRecord[]),
        nextClaims.role === "client"
          ? apiFetch<LoyaltyStats>("/auth/me/loyalty", { headers: authHeaders(nextToken) })
          : Promise.resolve(null),
        nextClaims.role === "client" || nextClaims.role === "prestataire"
          ? apiFetch<BadgeRecord[]>("/auth/me/badges", { headers: authHeaders(nextToken) })
          : Promise.resolve([] as BadgeRecord[]),
        nextClaims.role === "admin"
          ? apiFetch<AtRiskResponse>("/missions/at-risk", { headers: authHeaders(nextToken) }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setDemandes(nextDemandes);
      setServices(nextServices);
      setMissions(nextMissions);
      setUsers(nextUsers);
      setPrestataires(nextPrestataires);
      setClientLoyalty(nextLoyalty);
      setUserBadges(nextBadges);
      setAdminAtRisk(nextAtRisk);

      if (nextClaims.role === "client") {
        const ownOpenDemandes = nextDemandes
          .filter((d) => d.client_id === Number(nextClaims.sub) && d.status === "ouverte")
          .sort((a, b) => b.id - a.id);
        const recentOpenDemande = ownOpenDemandes[0];
        if (recentOpenDemande) {
          void loadClientMatchingPreview(nextToken, recentOpenDemande.id);
        }
      }

      navigate(roleHomePath(nextClaims.role), { replace: true });
      void fetchUserProfile(nextToken);
    } catch (error) {
      setToken("");
      setClaims(null);
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Session expirée" });
    } finally {
      setDashboardPending(false);
    }
  }

  function currentRole(): Role | undefined {
    return claims?.role;
  }

  function currentUserId(): number {
    return Number(claims?.sub || 0);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>, expectedRole?: Role) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setLoginPending(true);
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: String(formData.get("phone") || ""),
          password: String(formData.get("password") || ""),
        }),
      });

      const nextClaims = decodeJwt(result.access_token);
      if (!nextClaims?.role) {
        throw new Error("Impossible de lire le role depuis le token");
      }
      if (expectedRole && nextClaims.role !== expectedRole) {
        throw new Error("Ce compte n'est pas autorise sur cet espace");
      }

      form.reset();
      setToken(result.access_token);
      setToast({ kind: "ok", message: "Connexion reussie" });
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Connexion impossible" });
    } finally {
      setLoginPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>, role: Extract<Role, "client" | "prestataire">) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const passwordConfirmation = String(formData.get("password_confirmation") || "");
    const normalizedPhone = formatCameroonPhone(String(formData.get("phone") || ""));

    if (password !== passwordConfirmation) {
      setToast({ kind: "err", message: "Les deux mots de passe ne correspondent pas." });
      return;
    }

    try {
      setRegisterPending(true);
      await apiFetch<void>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: normalizePersonName(String(formData.get("first_name") || "")),
          last_name: normalizePersonName(String(formData.get("last_name") || "")),
          username: String(formData.get("username") || "").trim().toLowerCase(),
          email: String(formData.get("email") || "").trim().toLowerCase(),
          address: String(formData.get("address") || "").trim(),
          phone: normalizedPhone,
          password,
          role,
        }),
      });

      const loginResult = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          password,
        }),
      });

      form.reset();
      if (registerAvatarDataUrl) {
        pendingAvatarRef.current = registerAvatarDataUrl;
      }
      setRegisterAvatarDataUrl(null);
      setToken(loginResult.access_token);
      setToast({ kind: "ok", message: "Inscription reussie. Redirection vers votre tableau de bord..." });
    } catch (error) {
      setToast({
        kind: "err",
        message: userFacingError(
          error,
          "Inscription enregistree, mais la redirection vers le tableau de bord a echoue. Rechargez la page.",
          "register"
        ),
      });
    } finally {
      setRegisterPending(false);
    }
  }

  async function handleCreateDemande(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const ville = String(formData.get("ville") || "").trim();
    const arrondissement = String(formData.get("arrondissement") || "").trim();
    const quartier = String(formData.get("quartier") || "").trim();
    const clientAvailabilityMode = String(formData.get("client_availability_mode") || "flexible");
    const clientAvailabilityNote = String(formData.get("client_availability_note") || "").trim();

    if (clientAvailabilityMode === "fixe" && clientAvailabilityNote.length < 5) {
      setToast({ kind: "err", message: "Precisez votre disponibilite (minimum 5 caracteres)" });
      return;
    }

    try {
      const payload = {
        client_id: currentUserId(),
        description: String(formData.get("description") || ""),
        location: [ville, arrondissement, quartier].filter(Boolean).join(", "),
        ville,
        arrondissement,
        quartier,
        client_availability_mode: clientAvailabilityMode,
        client_availability_note: clientAvailabilityNote || null,
        priority: String(formData.get("priority") || "normale"),
      };
      await apiFetch<void>("/demandes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
      window.localStorage.setItem(
        DEMANDE_DRAFT_KEY,
        JSON.stringify({
          ville,
          arrondissement,
          quartier,
          client_availability_mode: clientAvailabilityMode,
          client_availability_note: clientAvailabilityNote,
          priority: payload.priority,
        })
      );
      setToast({ kind: "ok", message: "Request created" });
      form.reset();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Request creation failed" });
    }
  }

  function handleEditDemande(demande: Demande) {
    if (demande.status !== "ouverte") {
      setToast({ kind: "err", message: "La demande ne peut plus etre modifiee apres acceptation." });
      return;
    }
    setEditModalClosing(false);
    setEditDemandeTarget(demande);
    setEditDemandeDraft({
      description: demande.description,
      ville: cleanGeo(demande.ville),
      arrondissement: cleanGeo(demande.arrondissement),
      quartier: cleanGeo(demande.quartier),
      client_availability_mode: ((demande.client_availability_mode || "flexible").toLowerCase() === "fixe" ? "fixe" : "flexible"),
      client_availability_note: demande.client_availability_note || "",
      priority: demande.priority || "normale",
    });
  }

  function closeEditDemandeModal() {
    if (editDemandePending) {
      return;
    }
    setEditModalClosing(true);
    window.setTimeout(() => {
      setEditDemandeTarget(null);
      setEditDemandeDraft(null);
      setEditModalClosing(false);
    }, MODAL_CLOSE_MS);
  }

  async function handleConfirmEditDemande(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editDemandeTarget || !editDemandeDraft) {
      return;
    }

    const description = editDemandeDraft.description.trim();
    const ville = editDemandeDraft.ville.trim();
    const arrondissement = editDemandeDraft.arrondissement.trim();
    const quartier = editDemandeDraft.quartier.trim();
    const availabilityMode = editDemandeDraft.client_availability_mode;
    const availabilityNote = editDemandeDraft.client_availability_note.trim();

    if (description.length < 5 || ville.length < 2 || arrondissement.length < 2 || quartier.length < 2) {
      setToast({ kind: "err", message: "Completez correctement les champs de la demande." });
      return;
    }

    if (availabilityMode === "fixe" && availabilityNote.length < 5) {
      setToast({ kind: "err", message: "Merci de preciser une disponibilite fixe." });
      return;
    }

    try {
      setEditDemandePending(true);
      await apiFetch<Demande>(`/demandes/${editDemandeTarget.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          description,
          ville,
          arrondissement,
          quartier,
          location: [ville, arrondissement, quartier].join(", "),
          client_availability_mode: availabilityMode,
          client_availability_note: availabilityNote || null,
          priority: editDemandeDraft.priority || "normale",
        }),
      });
      setToast({ kind: "ok", message: "Demande mise a jour." });
      closeEditDemandeModal();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise a jour impossible" });
    } finally {
      setEditDemandePending(false);
    }
  }

  async function handleDuplicateDemande(source: Demande) {
    if (!token) return;
    try {
      await apiFetch<void>("/demandes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          client_id: currentUserId(),
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
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Duplication impossible" });
    }
  }

  function handleCancelDemande(demandeId: number) {
    setCancelModalClosing(false);
    setDemandeCancelId(demandeId);
  }

  function closeCancelDemandeModal() {
    setCancelModalClosing(true);
    window.setTimeout(() => {
      setDemandeCancelId(null);
      setCancelModalClosing(false);
    }, MODAL_CLOSE_MS);
  }

  async function confirmCancelDemande() {
    if (!token || demandeCancelId == null) {
      return;
    }
    try {
      await apiFetch<Demande>(`/demandes/${demandeCancelId}/cancel`, {
        method: "POST",
        headers: authHeaders(token),
      });
      setToast({ kind: "ok", message: "Demande annulee." });
      closeCancelDemandeModal();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Annulation impossible" });
    }
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      await apiFetch<void>("/services", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          prestataire_id: currentUserId(),
          name: String(formData.get("name") || ""),
          description: String(formData.get("description") || ""),
          availability_slots: String(formData.get("availability_slots") || "").trim(),
          price: Number(formData.get("price") || 0),
        }),
      });
      setToast({ kind: "ok", message: "Service created" });
      form.reset();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({
        kind: "err",
        message: userFacingError(
          error,
          "Le service est enregistre, mais l'actualisation de l'ecran a echoue. Cliquez sur Actualiser.",
          "create-service"
        ),
      });
    }
  }

  async function handleUpdateMissionStatus(missionId: number, newStatus: string) {
    if (!token) {
      return;
    }
    try {
      setMissionPendingId(missionId);
      await apiFetch<Mission>(`/missions/${missionId}/status`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ status: newStatus }),
      });
      setToast({ kind: "ok", message: `Mission #${missionId} → ${newStatus}` });
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise à jour impossible" });
    } finally {
      setMissionPendingId(null);
    }
  }

  async function handleTogglePrestataireVerified(prestataireId: number, nextVerified: boolean) {
    if (!token) {
      return;
    }
    try {
      await apiFetch<PrestataireRecord>(`/prestataires/${prestataireId}/verified`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ verified: nextVerified }),
      });
      setToast({ kind: "ok", message: nextVerified ? "Prestataire verifie." : "Verification retiree." });
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise a jour impossible" });
    }
  }

  async function handleAdminChangeUserRole(user: UserRecord, nextRole: Role) {
    if (!token) {
      return;
    }
    if (user.role === nextRole) {
      setToast({ kind: "err", message: "Aucun changement de role detecte." });
      return;
    }

    try {
      setAdminActionUserId(user.id);
      setAdminActionKind("role");
      await apiFetch<{ detail: string }>(`/auth/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ role: nextRole }),
      });
      setToast({ kind: "ok", message: `Role de @${user.username} mis a jour vers ${nextRole}.` });
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise a jour du role impossible" });
    } finally {
      setAdminActionUserId(null);
      setAdminActionKind(null);
    }
  }

  async function handleAdminDeleteUser(user: UserRecord) {
    if (!token) {
      return;
    }
    const confirmed = window.confirm(`Supprimer le compte @${user.username} ? Cette action est irreversible.`);
    if (!confirmed) {
      return;
    }

    try {
      setAdminActionUserId(user.id);
      setAdminActionKind("delete");
      await apiFetch<{ detail: string }>(`/auth/admin/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      setToast({ kind: "ok", message: `Compte @${user.username} supprime.` });
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Suppression impossible" });
    } finally {
      setAdminActionUserId(null);
      setAdminActionKind(null);
    }
  }

  function handleUnregister() {
    setUnregisterModalClosing(false);
    setUnregisterPassword("");
    setUnregisterModalOpen(true);
  }

  function closeUnregisterModal() {
    if (unregisterPending) {
      return;
    }
    setUnregisterModalClosing(true);
    window.setTimeout(() => {
      setUnregisterModalOpen(false);
      setUnregisterPassword("");
      setUnregisterModalClosing(false);
    }, MODAL_CLOSE_MS);
  }

  async function confirmUnregister() {
    if (!token || unregisterPassword.trim().length === 0) {
      setToast({ kind: "err", message: "Entrez votre mot de passe pour confirmer." });
      return;
    }

    try {
      setUnregisterPending(true);
      await apiFetch<{ detail: string }>("/auth/unregister", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ password: unregisterPassword }),
      });
      logout();
      setToast({ kind: "ok", message: "Compte supprime. Verification dans MailHog." });
      closeUnregisterModal();
      navigate("/", { replace: true });
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Desinscription impossible" });
    } finally {
      setUnregisterPending(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 8_000_000) {
      setToast({ kind: "err", message: "Image source trop grande. Maximum 8 Mo." });
      event.target.value = "";
      return;
    }
    try {
      const sourceDataUrl = await readFileAsDataUrl(file);
      const size = await loadImageSize(sourceDataUrl);
      setCropSourceDataUrl(sourceDataUrl);
      setCropImageSize(size);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget("profile");
      setCropModalClosing(false);
      setCropModalOpen(true);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Erreur lors du televersement." });
    }
    // Reset input so same file can be re-selected
    event.target.value = "";
  }

  async function handleRegisterAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) {
      setToast({ kind: "err", message: "Image source trop grande. Maximum 8 Mo." });
      event.target.value = "";
      return;
    }
    try {
      const sourceDataUrl = await readFileAsDataUrl(file);
      const size = await loadImageSize(sourceDataUrl);
      setCropSourceDataUrl(sourceDataUrl);
      setCropImageSize(size);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget("register");
      setCropModalClosing(false);
      setCropModalOpen(true);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Erreur lors de l'import de l'image." });
    }
    event.target.value = "";
  }

  function closeCropModal() {
    if (cropPending) {
      return;
    }
    setCropModalClosing(true);
    window.setTimeout(() => {
      setCropModalOpen(false);
      setCropSourceDataUrl("");
      setCropImageSize(null);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget(null);
      cropDragRef.current = null;
      setCropModalClosing(false);
    }, MODAL_CLOSE_MS);
  }

  function openDemandDetailModal(demande: Demande) {
    setDemandDetailClosing(false);
    setSelectedDemandForDetail(demande);
  }

  function closeDemandDetailModal() {
    setDemandDetailClosing(true);
    window.setTimeout(() => {
      setSelectedDemandForDetail(null);
      setDemandDetailClosing(false);
    }, MODAL_CLOSE_MS);
  }

  function handleCropZoomChange(nextZoom: number) {
    if (!cropImageSize) {
      return;
    }
    const clamped = clampAvatarOffset(cropImageSize.width, cropImageSize.height, nextZoom, cropOffsetX, cropOffsetY);
    setCropZoom(nextZoom);
    setCropOffsetX(clamped.x);
    setCropOffsetY(clamped.y);
  }

  function onCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropImageSize) {
      return;
    }
    cropDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: cropOffsetX,
      originY: cropOffsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropImageSize || !cropDragRef.current) {
      return;
    }
    const nextX = cropDragRef.current.originX + (event.clientX - cropDragRef.current.startX);
    const nextY = cropDragRef.current.originY + (event.clientY - cropDragRef.current.startY);
    const clamped = clampAvatarOffset(cropImageSize.width, cropImageSize.height, cropZoom, nextX, nextY);
    setCropOffsetX(clamped.x);
    setCropOffsetY(clamped.y);
  }

  function onCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropDragRef.current = null;
  }

  async function confirmCropSelection() {
    if (!cropImageSize || !cropSourceDataUrl || !cropTarget) {
      return;
    }

    try {
      setCropPending(true);
      const avatarDataUrl = await exportAvatarCrop(
        cropSourceDataUrl,
        cropImageSize.width,
        cropImageSize.height,
        cropZoom,
        cropOffsetX,
        cropOffsetY
      );

      if (cropTarget === "register") {
        setRegisterAvatarDataUrl(avatarDataUrl);
        setToast({ kind: "ok", message: "Photo cadree pour l'inscription." });
      } else {
        if (!token) {
          throw new Error("Session invalide");
        }
        setAvatarUploadPending(true);
        await apiFetch<UserProfile>("/auth/me/avatar", {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ avatar_url: avatarDataUrl }),
        });
        setUserProfile((prev) => prev ? { ...prev, avatar_url: avatarDataUrl } : prev);
        setToast({ kind: "ok", message: "Photo de profil mise a jour (cadree)." });
      }

      closeCropModal();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Recadrage impossible." });
    } finally {
      setCropPending(false);
      setAvatarUploadPending(false);
    }
  }

  function logout() {
    setToken("");
    setClaims(null);
    setDemandes([]);
    setServices([]);
    setMissions([]);
    window.localStorage.removeItem(TOKEN_KEY);
  }

  const role = currentRole();
  const userId = currentUserId();
  const isLoggedIn = Boolean(token && claims);

  function renderPublicAuth(roleForPage: Extract<Role, "client" | "prestataire">): JSX.Element {
    const title = roleForPage === "client" ? "Espace Client" : "Espace Prestataire";
    const subtitle =
      roleForPage === "client"
        ? "Créez des demandes et suivez vos missions à domicile."
        : "Proposez vos services et gérez les missions entrantes.";
    const authMode = authModeByRole[roleForPage];

    return (
      <section className="panel auth-panel">
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="ghost" onClick={() => navigate("/")}>Back</button>
        </div>

        <div className="auth-switch-banner">
          {authMode === "register" ? (
            <p>
              Deja inscrit ?
              <button
                type="button"
                className="text-btn"
                onClick={() => setAuthModeByRole((prev) => ({ ...prev, [roleForPage]: "login" }))}
              >
                Connectez-vous
              </button>
            </p>
          ) : (
            <p>
              Pas encore inscrit ?
              <button
                type="button"
                className="text-btn"
                onClick={() => setAuthModeByRole((prev) => ({ ...prev, [roleForPage]: "register" }))}
              >
                Creez votre compte
              </button>
            </p>
          )}
        </div>

        {authMode === "login" ? (
          <form className="card stack auth-single-card" onSubmit={(event) => void handleLogin(event, roleForPage)}>
            <h3>Connexion</h3>
            <label>
              <span>Identifiant (username ou telephone)</span>
              <input type="text" name="phone" placeholder="username ou +237 6XX XXX XXX" required />
            </label>
            <label>
              <span>Mot de passe</span>
              <input type="password" name="password" required />
            </label>
            <button type="submit" disabled={loginPending}>
              {loginPending ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        ) : (
          <form className="card stack auth-single-card" onSubmit={(event) => void handleRegister(event, roleForPage)}>
            <h3>Inscription {roleForPage}</h3>
            <label>
              <span>Prenom</span>
              <input
                type="text"
                name="first_name"
                onBlur={(event) => {
                  event.currentTarget.value = normalizePersonName(event.currentTarget.value);
                }}
                required
              />
            </label>
            <label>
              <span>Nom</span>
              <input
                type="text"
                name="last_name"
                onBlur={(event) => {
                  event.currentTarget.value = normalizePersonName(event.currentTarget.value);
                }}
                required
              />
            </label>
            <label>
              <span>Username</span>
              <input type="text" name="username" placeholder="ex: alice.client" minLength={3} required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" name="email" placeholder="ex: nom@email.com" required />
            </label>
            <label>
              <span>Adresse</span>
              <input type="text" name="address" placeholder="Quartier, ville" minLength={5} required />
            </label>
            <label>
              <span>Telephone</span>
              <input
                type="text"
                name="phone"
                placeholder="+237 6XX XXX XXX"
                pattern="\+237\s\d{3}\s\d{3}\s\d{3}"
                onBlur={(event) => {
                  event.currentTarget.value = formatCameroonPhone(event.currentTarget.value);
                }}
                required
              />
            </label>
            <label>
              <span>Mot de passe</span>
              <input type="password" name="password" minLength={8} required />
            </label>
            <label>
              <span>Confirmer le mot de passe</span>
              <input type="password" name="password_confirmation" minLength={8} required />
            </label>
            <label>
              <span>Photo de profil <em style={{ fontWeight: 400, opacity: 0.7 }}>(optionnelle, max 8 Mo, cadrage auto)</em></span>
              <input
                ref={registerAvatarInputRef}
                type="file"
                name="avatar"
                accept="image/*"
                onChange={(event) => void handleRegisterAvatarSelected(event)}
              />
            </label>
            <button type="submit" disabled={registerPending}>
              {registerPending ? "Creation..." : "S'inscrire"}
            </button>
          </form>
        )}
      </section>
    );
  }

  function renderClientWorkspace(): JSX.Element {
    const clientDemandes = demandes.filter((demande) => demande.client_id === userId);
    const clientMissions = missions.filter((mission) => mission.client_id === userId);
    const loweredQuery = clientQuery.trim().toLowerCase();
    const filteredDemandes = clientDemandes.filter((demande) => {
      const matchesStatus = clientStatusFilter === "all" || demande.status === clientStatusFilter;
      const matchesQuery =
        loweredQuery.length === 0 ||
        demandeGeoLabel(demande).toLowerCase().includes(loweredQuery) ||
        demande.location.toLowerCase().includes(loweredQuery) ||
        demande.description.toLowerCase().includes(loweredQuery);
      return matchesStatus && matchesQuery;
    });

    const pendingDemandes = clientDemandes.filter((demande) => demande.status === "ouverte").length;
    const activeMissions = clientMissions.filter((mission) => mission.status === "en_cours").length;
    const highPriorityOpen = clientDemandes.filter((demande) => demande.status === "ouverte" && demande.priority === "haute").length;
    const completedMissions = clientMissions.filter((mission) => mission.status === "terminee").length;
    const completionRate = clientMissions.length > 0 ? Math.round((completedMissions / clientMissions.length) * 100) : 0;
    const nextScheduledMission = [...clientMissions]
      .filter((mission) => mission.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime())[0];
    const latestOpenDemande = [...clientDemandes]
      .filter((demande) => demande.status === "ouverte")
      .sort((a, b) => b.id - a.id)[0];
    const matchingPreview = latestOpenDemande ? matchingByDemande[latestOpenDemande.id] : null;
    const matchingPreviewPending = latestOpenDemande ? Boolean(matchingLoadingByDemande[latestOpenDemande.id]) : false;
    const topCandidates = matchingPreview?.candidates?.slice(0, 3) || [];

    const lastDraftRaw = window.localStorage.getItem(DEMANDE_DRAFT_KEY);
    let lastDraft: {
      ville?: string;
      arrondissement?: string;
      quartier?: string;
      client_availability_mode?: string;
      client_availability_note?: string;
      priority?: string;
    } | null = null;
    if (lastDraftRaw) {
      try {
        lastDraft = JSON.parse(lastDraftRaw) as {
          ville?: string;
          arrondissement?: string;
          quartier?: string;
          client_availability_mode?: string;
          client_availability_note?: string;
          priority?: string;
        };
      } catch {
        window.localStorage.removeItem(DEMANDE_DRAFT_KEY);
      }
    }

    const nextAction =
      pendingDemandes > 0
        ? {
            title: "Suivre vos demandes ouvertes",
            description: `${pendingDemandes} demande(s) en attente d'attribution.`,
            cta: "Voir les demandes ouvertes",
            onClick: () => setClientStatusFilter("ouverte"),
          }
        : activeMissions > 0
          ? {
              title: "Mission en cours",
              description: `${activeMissions} mission(s) en cours. Vous pouvez suivre les mises a jour ci-dessous.`,
              cta: "Voir l'historique des services",
              onClick: () => window.scrollTo({ top: 680, behavior: "smooth" }),
            }
          : {
              title: "Publier un nouveau besoin",
              description: "Créez une nouvelle demande en quelques secondes.",
              cta: "Creer une demande",
              onClick: () => clientCreateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
            };

    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div className="dashboard-identity">
            <div
              className="profile-avatar-wrap"
              onClick={() => avatarInputRef.current?.click()}
              title={avatarUploadPending ? "Téléversement..." : "Changer la photo"}
            >
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {(userProfile?.username || claims?.username || "?")[0].toUpperCase()}
                </div>
              )}
              <span className="profile-avatar-overlay">{avatarUploadPending ? "⏳" : "✎"}</span>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleAvatarChange(e)}
            />
            <div>
              <h2>Espace Client</h2>
              <p>Bonjour, <strong>@{userProfile?.username || claims?.username || `#${userId}`}</strong></p>
            </div>
          </div>
          <div className="meta">
            <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
              Actualiser
            </button>
            <button type="button" className="ghost" onClick={() => void handleUnregister()}>
              Desinscription
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Se deconnecter
            </button>
          </div>
        </div>

        <section className="card role-hero role-hero--client">
          <div>
            <h3>Votre cockpit client</h3>
            <p>
              {dashboardPending
                ? "Synchronisation en cours de vos demandes et missions..."
                : `${pendingDemandes} demande(s) ouverte(s), ${activeMissions} mission(s) active(s).`}
            </p>
          </div>
          <div className="role-hero__actions">
            <button
              type="button"
              onClick={() => clientCreateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              disabled={dashboardPending}
            >
              {dashboardPending ? "Patientez..." : "Nouvelle demande"}
            </button>
            <button type="button" className="ghost" onClick={() => setClientStatusFilter("ouverte")} disabled={dashboardPending}>
              Mes demandes ouvertes
            </button>
          </div>
        </section>

        <section className="card recommendation-card">
          <div>
            <h3>Prochaine action recommandee</h3>
            <p>{nextAction.description}</p>
          </div>
          <button type="button" onClick={nextAction.onClick}>{nextAction.cta}</button>
        </section>

        <div className="quick-actions quick-actions-sticky">
          <button type="button" className="ghost" onClick={() => setClientStatusFilter("ouverte")}>Demandes ouvertes</button>
          <button
            type="button"
            className="ghost"
            onClick={() => clientCreateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            Nouvelle demande
          </button>
        </div>

        <section className="card stack today-overview-card">
          <div className="section-head">
            <h3>Vue d'ensemble en 5 secondes</h3>
            <span>{dashboardPending ? "Mise a jour..." : "A jour"}</span>
          </div>
          <div className="today-overview-grid">
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : (nextScheduledMission ? formatDateTime(nextScheduledMission.scheduled_at || undefined) : "Aucun ETA")}</strong>
              <span>Prochaine intervention</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : pendingDemandes}</strong>
              <span>Demandes ouvertes</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : highPriorityOpen}</strong>
              <span>Demandes urgentes</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : `${completionRate}%`}</strong>
              <span>Taux de missions terminees</span>
            </div>
          </div>
        </section>

        <div className="two-col">
          <section className="card stack matching-widget-card">
            <div className="section-head">
              <h3>Matching intelligent</h3>
              <span>{matchingPreviewPending ? "Analyse..." : "Temps reel"}</span>
            </div>
            {!latestOpenDemande ? <p className="helper-line">Publiez une demande pour voir les prestataires compatibles.</p> : null}
            {latestOpenDemande ? (
              <div className="matching-widget-head">
                <strong>Demande #{latestOpenDemande.id}</strong>
                <button
                  type="button"
                  className="ghost inline-ghost"
                  onClick={() => void loadClientMatchingPreview(token, latestOpenDemande.id)}
                  disabled={matchingPreviewPending}
                >
                  {matchingPreviewPending ? "Actualisation..." : "Actualiser"}
                </button>
              </div>
            ) : null}
            {latestOpenDemande && !matchingPreviewPending && matchingPreview ? (
              <p className="helper-line">{matchingPreview.available_count} prestataire(s) compatible(s) detecte(s).</p>
            ) : null}
            <ul className="list clean-list compact-list matching-candidates-list">
              {matchingPreviewPending ? renderSkeletonList("client-matching", 2) : null}
              {!matchingPreviewPending && latestOpenDemande && topCandidates.length === 0 ? <li>Aucun candidat pour le moment.</li> : null}
              {!matchingPreviewPending && topCandidates.map((candidate) => (
                <li key={`match-${candidate.user_id}`}>
                  <div className="matching-candidate-head">
                    <strong>{candidate.display_name}</strong>
                    <span className={scoreBarClass(candidate.score_total)}>{candidate.score_total}/100</span>
                  </div>
                  <div className="matching-candidate-meta">
                    Zone {candidate.score_zone} | Note {candidate.score_rating} | Fiabilite {candidate.score_completion}
                  </div>
                  <div className="matching-candidate-meta">
                    {candidate.distance_km != null ? `Distance estimee: ${candidate.distance_km.toFixed(1)} km` : "Distance: en cours d'estimation"}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack loyalty-gauge-card">
            <div className="section-head">
              <h3>Fidelite client</h3>
              <span>{clientLoyalty ? `${clientLoyalty.loyalty_points} pts` : "N/A"}</span>
            </div>
            <div className="loyalty-gauge-track">
              <div
                className="loyalty-gauge-fill"
                style={{ width: `${Math.max(0, Math.min(100, clientLoyalty?.progress_percent || 0))}%` }}
              />
            </div>
            <div className="loyalty-gauge-meta">
              <strong>{clientLoyalty ? `${clientLoyalty.completed_missions_count} missions terminees` : "0 mission"}</strong>
              <span>
                {clientLoyalty
                  ? `Prochain palier: ${clientLoyalty.next_milestone} missions`
                  : "Terminez des missions pour debloquer vos recompenses."}
              </span>
            </div>
          </section>
        </div>

        <div className="stats-grid">
          <article className={`metric-card ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>My requests</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : clientDemandes.length}</strong>
          </article>
          <article className={`metric-card ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>Available services</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : services.length}</strong>
          </article>
          <article className={`metric-card wide ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>Services history</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : clientMissions.length}</strong>
          </article>
        </div>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>My requests</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <div className="filter-row">
              <select className="styled-select" value={clientStatusFilter} onChange={(event) => setClientStatusFilter(event.target.value as ClientStatusFilter)}>
                <option value="all">Tous les statuts</option>
                <option value="ouverte">Ouverte</option>
                <option value="attribuee">Attribuée</option>
                <option value="annulee">Annulée</option>
                <option value="expiree">Expirée</option>
              </select>
              <input
                type="text"
                placeholder="Filtrer par lieu ou description"
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
              />
            </div>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("client-demandes") : null}
              {!dashboardPending && filteredDemandes.length === 0 ? <li>Aucune demande ne correspond au filtre.</li> : null}
              {!dashboardPending && filteredDemandes.map((demande) => {
                const linkedMission = clientMissions.find((m) => m.demande_id === demande.id);
                const rawEvents =
                  demande.events && demande.events.length > 0
                    ? demande.events
                    : ([{ id: -demande.id, event_type: "cree", created_at: demande.created_at }] as DemandeEvent[]);
                const eventGroups = groupEventsByDay(rawEvents);
                return (
                  <li key={demande.id}>
                    <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                      <span className="status-dot" />
                      <strong>Demande #{demande.id}</strong>
                      <span className={priorityClass(demande.priority)}>{priorityLabel(demande.priority)}</span>
                      <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                    </div>
                    <div className="demande-actions-row">
                      {demande.status === "ouverte" ? (
                        <button type="button" className="ghost inline-ghost" onClick={() => handleEditDemande(demande)} disabled={dashboardPending}>
                          Modifier
                        </button>
                      ) : null}
                      {demande.status === "ouverte" ? (
                        <button type="button" className="ghost inline-ghost" onClick={() => handleCancelDemande(demande.id)} disabled={dashboardPending}>
                          Annuler
                        </button>
                      ) : null}
                      <button type="button" className="ghost inline-ghost" onClick={() => void handleDuplicateDemande(demande)} disabled={dashboardPending}>
                        Dupliquer
                      </button>
                    </div>
                    {demande.status !== "annulee" ? (
                      <div className="progress-inline" aria-label="Progression de la demande">
                        {demandeProgressSteps(demande.status).map((step) => (
                          <span
                            key={step.key}
                            className={`progress-pill ${step.done ? "done" : ""} ${step.active ? "active" : ""}`.trim()}
                          >
                            {step.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="timeline-line">Demande arretee par annulation.</div>
                    )}
                    {linkedMission?.scheduled_at ? (
                      <div className="eta-line">
                        <span className="eta-icon">📅</span>
                        <span>Intervention prevue le {formatDateTime(linkedMission.scheduled_at)}</span>
                      </div>
                    ) : null}
                    {renderPrestataireTrust(linkedMission?.prestataire_summary)}
                    <div className="event-timeline-grouped">
                      {eventGroups.map((group) => (
                        <div key={group.day} className="timeline-day-group">
                          <div className="timeline-day-label">{group.day}</div>
                          <ul className="event-timeline">
                            {group.events.map((ev) => {
                              const stepBadge = demandeEventStepBadge(ev);
                              return (
                                <li key={ev.id} className={`timeline-item timeline-item--${ev.event_type}`}>
                                  <span className="timeline-item__bullet" />
                                  <div>
                                    <div className="timeline-line timeline-line--event">
                                      <strong>{demandeEventText(ev)}</strong>
                                      {stepBadge ? (
                                        <span className={`step-badge step-badge--${stepBadge.key}`}>{stepBadge.label}</span>
                                      ) : null}
                                      {demandeEventActor(ev) !== "Systeme" ? ` — ${demandeEventActor(ev)}` : ""}
                                    </div>
                                    <div className="timeline-line">{formatDateTime(ev.created_at)}</div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="demande-meta">{demandeGeoLabel(demande)} — {demande.description}</div>
                    <div className="timeline-line">{clientAvailabilityLabel(demande)}</div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card stack">
            <div className="section-head">
              <h3>Historique des services rendus</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("client-history") : null}
              {!dashboardPending && clientMissions.length === 0 ? <li>Aucun service rendu pour le moment.</li> : null}
              {!dashboardPending && clientMissions.map((mission) => (
                <li key={mission.id}>
                  <div className="status-line blue">
                    <span className="status-dot" />
                    <strong>Mission #{mission.id}</strong>
                    <span className={statusChipClass(mission.status)}>{demandeStatusLabel(mission.status)}</span>
                  </div>
                  {mission.scheduled_at ? (
                    <div className="eta-line">
                      <span className="eta-icon">📅</span>
                      <span>Prevue le {formatDateTime(mission.scheduled_at)}</span>
                    </div>
                  ) : null}
                  {renderPrestataireTrust(mission.prestataire_summary)}
                  <div className="timeline-line">Demande #{mission.demande_id} — Prestataire #{mission.prestataire_summary?.display_name || `#${mission.prestataire_id}`}</div>
                  <div className="timeline-line">Creation: {formatDateTime(mission.created_at)}</div>
                  <div className="timeline-line">Mise a jour: {formatDateTime(mission.updated_at)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="two-col">
          <form className="card stack" onSubmit={handleCreateDemande} ref={clientCreateFormRef}>
            <div className="section-head">
              <h3>Create request</h3>
              {lastDraft ? (
                <span>Dernieres preferences memorisees</span>
              ) : (
                <span>Creation rapide</span>
              )}
            </div>
            <label>
              <span>Description</span>
              <textarea name="description" required />
            </label>
            <label>
              <span>Ville</span>
              <input type="text" name="ville" placeholder="Ex: Douala" defaultValue={lastDraft?.ville || ""} required />
            </label>
            <label>
              <span>Arrondissement</span>
              <input
                type="text"
                name="arrondissement"
                placeholder="Ex: Douala 5"
                defaultValue={lastDraft?.arrondissement || ""}
                required
              />
            </label>
            <label>
              <span>Quartier</span>
              <input type="text" name="quartier" placeholder="Ex: Makepe" defaultValue={lastDraft?.quartier || ""} required />
            </label>
            <label>
              <span>Disponibilite client</span>
              <select className="styled-select" name="client_availability_mode" defaultValue={lastDraft?.client_availability_mode || "flexible"}>
                <option value="flexible">Flexible</option>
                <option value="fixe">Planning fixe</option>
              </select>
            </label>
            <label>
              <span>Details disponibilite (ex: Lun-Ven 18h-20h)</span>
              <input
                type="text"
                name="client_availability_note"
                placeholder="Optionnel si flexible"
                defaultValue={lastDraft?.client_availability_note || ""}
              />
            </label>
            <label>
              <span>Priorité</span>
              <select className="styled-select" name="priority" defaultValue={lastDraft?.priority || "normale"}>
                <option value="haute">🔴 Urgente</option>
                <option value="normale">🔵 Normale</option>
                <option value="basse">🟢 Basse</option>
              </select>
            </label>
            <button type="submit" disabled={dashboardPending}>{dashboardPending ? "Traitement..." : "Create request"}</button>
          </form>

          <section className="card stack muted-card">
            <h3>Provider interaction</h3>
            <p>Use your request feed to contact and coordinate with prestataires.</p>
          </section>
        </div>
      </section>
    );
  }

  function renderPrestataireWorkspace(): JSX.Element {
    const ownServices = services.filter((service) => service.prestataire_id === userId);
    const providerMissions = missions.filter((mission) => mission.prestataire_id === userId);
    const completedProviderMissions = providerMissions.filter((mission) => mission.status === "terminee").length;
    const myTrust = providerMissions.find((m) => m.prestataire_summary != null)?.prestataire_summary?.trust ?? null;
    const noteClient = myTrust?.rating ?? null;
    const tauxAcceptation =
      providerMissions.length > 0 ? Math.round((completedProviderMissions / providerMissions.length) * 100) : null;
    const nowDate = new Date();
    const revenusMonth = providerMissions
      .filter((m) => {
        const d = new Date(m.updated_at);
        return (
          m.status === "terminee" &&
          d.getMonth() === nowDate.getMonth() &&
          d.getFullYear() === nowDate.getFullYear()
        );
      })
      .reduce((sum, m) => {
        const svc = ownServices.find((s) => s.id === m.service_id);
        return sum + (svc ? svc.price : 0);
      }, 0);
    const perfScore =
      tauxAcceptation !== null && noteClient !== null
        ? Math.round(tauxAcceptation * 0.5 + (noteClient / 5) * 100 * 0.5)
        : tauxAcceptation ?? (noteClient !== null ? Math.round((noteClient / 5) * 100) : null);
    const allVilles = Array.from(new Set(demandes.map((d) => cleanGeo(d.ville)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const demandesByVille =
      prestataireVilleFilter === "all"
        ? demandes
        : demandes.filter((d) => cleanGeo(d.ville) === prestataireVilleFilter);
    const allArrondissements = Array.from(new Set(demandesByVille.map((d) => cleanGeo(d.arrondissement)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    const demandesByArrondissement =
      prestataireArrondissementFilter === "all"
        ? demandesByVille
        : demandesByVille.filter((d) => cleanGeo(d.arrondissement) === prestataireArrondissementFilter);
    const allQuartiers = Array.from(new Set(demandesByArrondissement.map((d) => cleanGeo(d.quartier)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );

    const matchingDemandes = demandes.filter((demande) => {
      const matchesStatus = prestataireStatusFilter === "all" || demande.status === prestataireStatusFilter;
      const matchesVille = prestataireVilleFilter === "all" || cleanGeo(demande.ville) === prestataireVilleFilter;
      const matchesArrondissement =
        prestataireArrondissementFilter === "all" || cleanGeo(demande.arrondissement) === prestataireArrondissementFilter;
      const matchesQuartier = prestataireQuartierFilter === "all" || cleanGeo(demande.quartier) === prestataireQuartierFilter;
      return matchesStatus && matchesVille && matchesArrondissement && matchesQuartier;
    });

    const topOpportunities = matchingDemandes.slice(0, 3);
    const newOpportunities = matchingDemandes.filter((d) => d.status === "ouverte");
    const confirmMissions = providerMissions.filter((m) => missionPipelineStatus(m.status) === "pending");
    const activeMissionsCol = providerMissions.filter((m) => missionPipelineStatus(m.status) === "active");
    const closingMissions = providerMissions.filter((m) => missionPipelineStatus(m.status) === "done");
    const demandeById = new Map<number, Demande>(demandes.map((demande) => [demande.id, demande]));
    const idQuery = pipelineIdQuery.trim().toLowerCase().replace(/^#/, "");
    const matchesOpportunityId = (demande: Demande): boolean => {
      if (!idQuery) {
        return true;
      }
      return String(demande.id).includes(idQuery);
    };
    const matchesMissionOrDemandeId = (mission: Mission): boolean => {
      if (!idQuery) {
        return true;
      }
      return String(mission.id).includes(idQuery) || String(mission.demande_id).includes(idQuery);
    };
    const keepOpportunity = (demande: Demande): boolean => {
      if (!matchesOpportunityId(demande)) {
        return false;
      }
      if (pipelineCardFilter === "all") {
        return true;
      }
      if (pipelineCardFilter === "urgent") {
        return demande.priority === "haute";
      }
      return false;
    };
    const keepMission = (mission: Mission): boolean => {
      if (!matchesMissionOrDemandeId(mission)) {
        return false;
      }
      if (pipelineCardFilter === "all") {
        return true;
      }
      if (pipelineCardFilter === "scheduled") {
        return mission.scheduled_at != null;
      }
      if (pipelineCardFilter === "urgent") {
        const linkedDemande = demandeById.get(mission.demande_id);
        return linkedDemande?.priority === "haute";
      }
      return true;
    };
    const shownOpportunities = newOpportunities.filter(keepOpportunity).slice(0, pipelineVisibleCount);
    const shownConfirmMissions = confirmMissions.filter(keepMission).slice(0, pipelineVisibleCount);
    const shownActiveMissions = activeMissionsCol.filter(keepMission).slice(0, pipelineVisibleCount);
    const shownClosingMissions = closingMissions.filter(keepMission).slice(0, pipelineVisibleCount);
    const pipelineCardCount =
      shownOpportunities.length + shownConfirmMissions.length + shownActiveMissions.length + shownClosingMissions.length;
    const atRiskProviderMissions = providerMissions.filter((mission) => {
      if (mission.status !== "en_cours" || !mission.scheduled_at) {
        return false;
      }
      const scheduledAt = Date.parse(mission.scheduled_at);
      if (Number.isNaN(scheduledAt)) {
        return false;
      }
      const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;
      return scheduledAt <= twoHoursFromNow;
    });
    const recommendation =
      ownServices.length === 0
        ? {
            title: "Publiez votre premier service",
            description: "Un service bien decrit augmente vos chances d'etre choisi.",
            cta: "Creer un service",
            onClick: () => prestataireCreateServiceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
          }
        : {
            title: "Nouvelles opportunites disponibles",
            description: `${matchingDemandes.length} demande(s) correspond(ent) a votre flux actuel.`,
            cta: "Voir les demandes",
            onClick: () => window.scrollTo({ top: 700, behavior: "smooth" }),
          };

    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div className="dashboard-identity">
            <div
              className="profile-avatar-wrap"
              onClick={() => avatarInputRef.current?.click()}
              title={avatarUploadPending ? "Téléversement..." : "Changer la photo"}
            >
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {(userProfile?.username || claims?.username || "?")[0].toUpperCase()}
                </div>
              )}
              <span className="profile-avatar-overlay">{avatarUploadPending ? "⏳" : "✎"}</span>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleAvatarChange(e)}
            />
            <div>
              <h2>Espace Prestataire</h2>
              <p>Bonjour, <strong>@{userProfile?.username || claims?.username || `#${userId}`}</strong></p>
            </div>
          </div>
          <div className="meta">
            <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
              Actualiser
            </button>
            <button type="button" className="ghost" onClick={() => void handleUnregister()}>
              Desinscription
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Se deconnecter
            </button>
          </div>
        </div>

        <section className="card role-hero role-hero--provider">
          <div>
            <h3>Votre cockpit prestataire</h3>
            <p>
              {dashboardPending
                ? "Synchronisation du pipeline et des opportunites..."
                : `${providerMissions.length} mission(s), ${newOpportunities.length} opportunite(s) disponible(s).`}
            </p>
          </div>
          <div className="role-hero__actions">
            <button
              type="button"
              onClick={() => prestataireCreateServiceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              disabled={dashboardPending}
            >
              {dashboardPending ? "Patientez..." : "Creer un service"}
            </button>
            <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("ouverte")} disabled={dashboardPending}>
              Voir opportunites
            </button>
          </div>
        </section>

        {atRiskProviderMissions.length > 0 ? (
          <section className="card risk-banner risk-banner--provider">
            <div className="risk-banner__head">
              <h3>At-risk: intervention a surveiller</h3>
              <span>{atRiskProviderMissions.length} mission(s) proche(s) d'echeance</span>
            </div>
            <ul className="risk-banner__list">
              {atRiskProviderMissions.slice(0, 4).map((mission) => (
                <li key={mission.id} className="risk-banner__item">
                  <strong>Mission #{mission.id}</strong>
                  <span>Demande #{mission.demande_id}</span>
                  <span>Echeance: {formatDateTime(mission.scheduled_at || undefined)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card recommendation-card provider-reco">
          <div>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.description}</p>
          </div>
          <button type="button" onClick={recommendation.onClick}>{recommendation.cta}</button>
        </section>

        <div className="quick-actions">
          <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("ouverte")}>Demandes ouvertes</button>
          <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("all")}>Tout le marche</button>
        </div>

        <div className="filter-row provider-filter-row">
          <select
            className="styled-select"
            value={prestataireVilleFilter}
            onChange={(event) => {
              setPrestataireVilleFilter(event.target.value);
              setPrestataireArrondissementFilter("all");
              setPrestataireQuartierFilter("all");
            }}
          >
            <option value="all">Toutes les villes</option>
            {allVilles.map((ville) => (
              <option key={ville} value={ville}>{ville}</option>
            ))}
          </select>
          <select
            className="styled-select"
            value={prestataireArrondissementFilter}
            onChange={(event) => {
              setPrestataireArrondissementFilter(event.target.value);
              setPrestataireQuartierFilter("all");
            }}
          >
            <option value="all">Tous les arrondissements</option>
            {allArrondissements.map((arr) => (
              <option key={arr} value={arr}>{arr}</option>
            ))}
          </select>
          <select className="styled-select" value={prestataireQuartierFilter} onChange={(event) => setPrestataireQuartierFilter(event.target.value)}>
            <option value="all">Tous les quartiers</option>
            {allQuartiers.map((quartier) => (
              <option key={quartier} value={quartier}>{quartier}</option>
            ))}
          </select>
        </div>

        <section className="card perf-kpi-bloc">
          <div className="perf-kpi-head">
            <div>
              <h3>Score de performance</h3>
              <span className="perf-kpi-score-label">Mis a jour en temps reel</span>
            </div>
            <div className={`perf-kpi-score ${dashboardPending ? "skeleton-card" : ""}`}>
              {dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : (perfScore !== null ? perfScore : "—")}<span>/100</span>
            </div>
          </div>
          <div className="perf-kpi-grid">
            <div className={`perf-kpi-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : (tauxAcceptation !== null ? `${tauxAcceptation}%` : "—")}</strong>
              <span>Taux d'acceptation</span>
            </div>
            <div className={`perf-kpi-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>
                {dashboardPending
                  ? <span className="skeleton-line skeleton-line--md" />
                  : (myTrust?.average_response_minutes != null
                  ? myTrust.average_response_minutes < 60
                    ? `${myTrust.average_response_minutes} min`
                    : `${Math.floor(myTrust.average_response_minutes / 60)} h${myTrust.average_response_minutes % 60 > 0 ? ` ${myTrust.average_response_minutes % 60} min` : ""}`
                  : "—")}
              </strong>
              <span>Temps de reponse</span>
            </div>
            <div className={`perf-kpi-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : (noteClient !== null ? `${noteClient.toFixed(1)}/5` : "—")}</strong>
              <span>Note client</span>
            </div>
            <div className={`perf-kpi-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : (revenusMonth > 0 ? `${revenusMonth.toLocaleString("fr-FR")} FCFA` : "—")}</strong>
              <span>Revenus du mois</span>
            </div>
          </div>
        </section>

        <section className="card stack badges-section-card">
          <div className="section-head">
            <h3>Mes badges</h3>
            <span>{dashboardPending ? "Loading..." : `${userBadges.length} badge(s)`}</span>
          </div>
          <ul className="badges-grid clean-list">
            {dashboardPending ? renderSkeletonList("provider-badges", 2) : null}
            {!dashboardPending && userBadges.length === 0 ? <li>Aucun badge pour l'instant. Continuez vos missions.</li> : null}
            {!dashboardPending && userBadges.map((badge) => (
              <li key={`badge-${badge.id}`} className="badge-chip">
                <strong>{badgeLabel(badge.slug)}</strong>
                <span>Attribue le {formatDateTime(badge.awarded_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>Open requests feed</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <div className="helper-line">Opportunites prioritaires (3 plus recentes)</div>
            <ul className="list clean-list compact-list">
              {dashboardPending ? renderSkeletonList("provider-opportunities", 2) : null}
              {!dashboardPending && topOpportunities.length === 0 ? <li>Aucune opportunite pour ce filtre.</li> : null}
              {!dashboardPending && topOpportunities.map((demande) => (
                <li key={`top-${demande.id}`} onClick={() => openDemandDetailModal(demande)} style={{ cursor: 'pointer' }} title="Cliquez pour voir les details">
                  <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                    <span className="status-dot" />
                    <strong>Demande #{demande.id}</strong>
                    <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                  </div>
                  <div>{demandeGeoLabel(demande)} - {demande.description}</div>
                  <div className="timeline-line">{clientAvailabilityLabel(demande)}</div>
                </li>
              ))}
            </ul>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("provider-feed") : null}
              {!dashboardPending && matchingDemandes.length === 0 ? <li>No requests yet.</li> : null}
              {!dashboardPending && matchingDemandes.map((demande) => (
                <li key={demande.id} onClick={() => openDemandDetailModal(demande)} style={{ cursor: 'pointer' }} title="Cliquez pour voir les details">
                  <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                    <span className="status-dot" />
                    <strong>Demande #{demande.id}</strong>
                    <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                  </div>
                  <div>{demandeGeoLabel(demande)} - {demande.description}</div>
                  <div className="timeline-line">{clientAvailabilityLabel(demande)}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack">
            <div className="section-head">
              <h3>My service catalog</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("provider-services") : null}
              {!dashboardPending && ownServices.length === 0 ? <li>No services yet.</li> : null}
              {!dashboardPending && ownServices.map((service) => (
                <li key={service.id}>
                  <strong>#{service.id}</strong> {service.name} - {service.price}
                  <div className="timeline-line">Disponibilites: {service.availability_slots}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="two-col">
          <form className="card stack" onSubmit={handleCreateService} ref={prestataireCreateServiceRef}>
            <h3>Create service</h3>
            <label>
              <span>Name</span>
              <input type="text" name="name" required />
            </label>
            <label>
              <span>Description</span>
              <textarea name="description" required />
            </label>
            <label>
              <span>Disponibilite (obligatoire)</span>
              <textarea name="availability_slots" placeholder="Ex: Lun-Ven 08h-17h, Sam 09h-12h" minLength={3} required />
            </label>
            <label>
              <span>Price</span>
              <input type="number" name="price" min="0" step="1" required />
            </label>
            <button type="submit" disabled={dashboardPending}>{dashboardPending ? "Traitement..." : "Create service"}</button>
          </form>

          <section className="card stack muted-card">
            <h3>Mission readiness</h3>
            <p>Keep your offer clear and pricing updated to improve request matching.</p>
          </section>
        </div>

        <section className="card stack pipeline-section">
          <div className="section-head">
            <h3>Pipeline des missions</h3>
            <span>{dashboardPending ? "Loading..." : `${providerMissions.length} mission(s)`}</span>
          </div>
          <div className="pipeline-toolbar">
            <label>
              <span>Affichage</span>
              <select
                className="styled-select"
                value={pipelineVisibleCount}
                onChange={(event) => setPipelineVisibleCount(Number(event.target.value) as 5 | 10)}
              >
                <option value={5}>5 cartes / colonne</option>
                <option value={10}>10 cartes / colonne</option>
              </select>
            </label>
            <label>
              <span>Filtre</span>
              <select
                className="styled-select"
                value={pipelineCardFilter}
                onChange={(event) => setPipelineCardFilter(event.target.value as PipelineCardFilter)}
              >
                <option value="all">Toutes les cartes</option>
                <option value="urgent">Priorite urgente</option>
                <option value="scheduled">Intervention planifiee</option>
              </select>
            </label>
            <label>
              <span>Recherche ID</span>
              <input
                type="text"
                value={pipelineIdQuery}
                onChange={(event) => setPipelineIdQuery(event.target.value)}
                placeholder="Mission #12 ou Demande #34"
                className="pipeline-search-input"
              />
            </label>
          </div>
          {providerMissions.length === 0 && newOpportunities.length === 0 ? (
            <p className="helper-line">Aucune mission assignee pour le moment. Acceptez une demande pour commencer.</p>
          ) : pipelineCardCount === 0 ? (
            <p className="helper-line">Aucune carte ne correspond au filtre selectionne.</p>
          ) : (
            <div className="pipeline-board">

              {/* Col 1: Nouvelles opportunités */}
              <div className="pipeline-col pipeline-col--new">
                <div className="pipeline-col__header">
                  <span className="pipeline-col__dot" />
                  <strong>Nouvelles opportunités</strong>
                  <span className="pipeline-count">{shownOpportunities.length}</span>
                </div>
                {shownOpportunities.map((demande) => (
                  <div
                    key={`opp-${demande.id}`}
                    className="pipeline-card pipeline-card--new"
                    onClick={() => openDemandDetailModal(demande)}
                    title="Voir les details"
                  >
                    <div className="pipeline-card__title">Demande #{demande.id}</div>
                    <div className="pipeline-card__meta">{demandeGeoLabel(demande)}</div>
                    <div className="pipeline-card__meta">{demande.description.slice(0, 55)}{demande.description.length > 55 ? "…" : ""}</div>
                    <span className={priorityClass(demande.priority)}>{priorityLabel(demande.priority)}</span>
                  </div>
                ))}
                {shownOpportunities.length === 0 ? <div className="pipeline-empty">Aucune opportunite</div> : null}
              </div>

              {/* Col 2: À confirmer */}
              <div className="pipeline-col pipeline-col--pending">
                <div className="pipeline-col__header">
                  <span className="pipeline-col__dot" />
                  <strong>À confirmer</strong>
                  <span className="pipeline-count">{shownConfirmMissions.length}</span>
                </div>
                {shownConfirmMissions.map((m) => (
                  <div key={m.id} className="pipeline-card">
                    <div className="pipeline-card__title">Mission #{m.id}</div>
                    <div className="pipeline-card__meta">Demande #{m.demande_id}</div>
                    <div className="pipeline-card__meta">Depuis: {formatDateTime(m.created_at)}</div>
                    {m.scheduled_at ? <div className="pipeline-card__eta">📅 {formatDateTime(m.scheduled_at)}</div> : null}
                    <div className="pipeline-card__actions">
                      <button
                        type="button"
                        className="pipeline-btn pipeline-btn--start"
                        disabled={dashboardPending || missionPendingId === m.id}
                        onClick={() => void handleUpdateMissionStatus(m.id, "en_cours")}
                      >
                        {missionPendingId === m.id ? "Traitement..." : "Démarrer"}
                      </button>
                    </div>
                  </div>
                ))}
                {shownConfirmMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
              </div>

              {/* Col 3: En cours */}
              <div className="pipeline-col pipeline-col--active">
                <div className="pipeline-col__header">
                  <span className="pipeline-col__dot" />
                  <strong>En cours</strong>
                  <span className="pipeline-count">{shownActiveMissions.length}</span>
                </div>
                {shownActiveMissions.map((m) => (
                  <div key={m.id} className="pipeline-card pipeline-card--active">
                    <div className="pipeline-card__title">Mission #{m.id}</div>
                    <div className="pipeline-card__meta">Demande #{m.demande_id}</div>
                    <div className="pipeline-card__meta">Depuis: {formatDateTime(m.updated_at)}</div>
                    {m.scheduled_at ? <div className="pipeline-card__eta">📅 {formatDateTime(m.scheduled_at)}</div> : null}
                    <div className="pipeline-card__actions">
                      <button
                        type="button"
                        className="pipeline-btn pipeline-btn--done"
                        disabled={dashboardPending || missionPendingId === m.id}
                        onClick={() => void handleUpdateMissionStatus(m.id, "terminee")}
                      >
                        {missionPendingId === m.id ? "Traitement..." : "Terminer"}
                      </button>
                    </div>
                  </div>
                ))}
                {shownActiveMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
              </div>

              {/* Col 4: À clôturer */}
              <div className="pipeline-col pipeline-col--closing">
                <div className="pipeline-col__header">
                  <span className="pipeline-col__dot" />
                  <strong>À clôturer</strong>
                  <span className="pipeline-count">{shownClosingMissions.length}</span>
                </div>
                {shownClosingMissions.map((m) => (
                  <div key={m.id} className="pipeline-card pipeline-card--closing">
                    <div className="pipeline-card__title">Mission #{m.id}</div>
                    <div className="pipeline-card__meta">Demande #{m.demande_id}</div>
                    <div className="pipeline-card__meta">Cloturee: {formatDateTime(m.updated_at)}</div>
                  </div>
                ))}
                {shownClosingMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
              </div>

            </div>
          )}
        </section>
      </section>
    );
  }

  function renderAdminWorkspace(): JSX.Element {
    const providerUsers = users.filter((user) => user.role === "prestataire");
    const managedUsers = users
      .slice()
      .sort((a, b) => a.role.localeCompare(b.role) || a.id - b.id);
    const providerRows = providerUsers.map((user) => ({
      user,
      provider: prestataires.find((item) => item.user_id === user.id) || null,
    }));
    const openDemandes = demandes.filter((demande) => demande.status === "ouverte").length;
    const activeMissionsAdmin = missions.filter((mission) => mission.status === "en_cours").length;
    const verifiedProviders = providerRows.filter((row) => row.provider?.verified).length;
    const pendingVerification = providerRows.length - verifiedProviders;
    const atRiskAdminMissions = adminAtRisk?.missions ?? [];

    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div>
            <h2>Console Admin</h2>
            <p>Espace restreint pour la supervision de la plateforme et les contrôles transversaux.</p>
          </div>
          <div className="meta">
            <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
              Actualiser
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Se deconnecter
            </button>
          </div>
        </div>

        <section className="card role-hero role-hero--admin">
          <div>
            <h3>Pilotage global de la plateforme</h3>
            <p>
              {dashboardPending
                ? "Consolidation des indicateurs en cours..."
                : `${demandes.length} demandes, ${missions.length} missions, ${providerRows.length} prestataire(s).`}
            </p>
          </div>
          <div className="role-hero__actions">
            <button type="button" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
              {dashboardPending ? "Actualisation..." : "Actualiser le tableau"}
            </button>
            <button type="button" className="ghost" onClick={() => window.scrollTo({ top: 1000, behavior: "smooth" })}>
              Vérifications prestataires
            </button>
          </div>
        </section>

        {atRiskAdminMissions.length > 0 ? (
          <section className="card risk-banner risk-banner--admin">
            <div className="risk-banner__head">
              <h3>At-risk: missions en cours proches de l'horaire prevu</h3>
              <span>{atRiskAdminMissions.length} mission(s) detectee(s)</span>
            </div>
            <ul className="risk-banner__list">
              {atRiskAdminMissions.slice(0, 6).map((item) => (
                <li key={item.mission_id} className="risk-banner__item">
                  <strong>Mission #{item.mission_id}</strong>
                  <span>Demande #{item.demande_id}</span>
                  <span>Prestataire #{item.prestataire_id}</span>
                  <span>Echeance: {formatDateTime(item.scheduled_at || undefined)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="quick-actions">
          <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>Actualiser</button>
          <button type="button" className="ghost" onClick={logout}>Se deconnecter</button>
        </div>

        <section className="card recommendation-card admin-reco">
          <div>
            <h3>Action prioritaire</h3>
            <p>
              {pendingVerification > 0
                ? `${pendingVerification} prestataire(s) a verifier pour renforcer la confiance.`
                : "Aucune verification en attente. Vous pouvez suivre les demandes ouvertes."}
            </p>
          </div>
          <button type="button" onClick={() => window.scrollTo({ top: 1000, behavior: "smooth" })}>Traiter maintenant</button>
        </section>

        <div className="stats-grid">
          <article className={`metric-card ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>Demandes ouvertes</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : openDemandes}</strong>
          </article>
          <article className={`metric-card ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>Missions actives</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : activeMissionsAdmin}</strong>
          </article>
          <article className={`metric-card wide ${dashboardPending ? "skeleton-card" : ""}`}>
            <span>Prestataires verifies</span>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--lg" /> : (providerRows.length === 0 ? "0" : `${verifiedProviders}/${providerRows.length}`)}</strong>
          </article>
        </div>

        <section className="card stack today-overview-card">
          <div className="section-head">
            <h3>Alertes operationnelles</h3>
            <span>{dashboardPending ? "Mise a jour..." : "A surveiller"}</span>
          </div>
          <div className="today-overview-grid">
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : pendingVerification}</strong>
              <span>Prestataires en attente</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : openDemandes}</strong>
              <span>Demandes a attribuer</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : services.length}</strong>
              <span>Services publies</span>
            </div>
            <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
              <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : users.length}</strong>
              <span>Comptes suivis</span>
            </div>
          </div>
        </section>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>Requests overview</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("admin-demandes") : null}
              {!dashboardPending && demandes.length === 0 ? <li>No requests yet.</li> : null}
              {!dashboardPending && demandes.map((demande) => (
                <li key={demande.id}>
                  <strong>#{demande.id}</strong> [{demande.status}] {demandeGeoLabel(demande)} - {demande.description}
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack">
            <div className="section-head">
              <h3>Services overview</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {dashboardPending ? renderSkeletonList("admin-services") : null}
              {!dashboardPending && services.length === 0 ? <li>No services yet.</li> : null}
              {!dashboardPending && services.map((service) => (
                <li key={service.id}>
                  <strong>#{service.id}</strong> {service.name} - {service.price} (provider {service.prestataire_id})
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card stack">
          <div className="section-head">
            <h3>Verification prestataires</h3>
            <span>{dashboardPending ? "Mise a jour..." : `${providerRows.length} comptes prestataires`}</span>
          </div>
          <ul className="list clean-list">
            {dashboardPending ? renderSkeletonList("admin-verify") : null}
            {!dashboardPending && providerRows.length === 0 ? <li>Aucun prestataire.</li> : null}
            {!dashboardPending && providerRows.map(({ user, provider }) => (
              <li key={user.id} className="admin-provider-row">
                <div className="admin-provider-copy">
                  <strong>{user.first_name} {user.last_name}</strong>
                  <div className="timeline-line">@{user.username} — {formatCameroonPhone(user.phone)}</div>
                  <div className="timeline-line">{user.email}</div>
                </div>
                <div className="admin-provider-actions">
                  <span className={provider?.verified ? "trust-badge trust-badge--verified" : "trust-badge"}>
                    {provider?.verified ? "Verifie" : "Non verifie"}
                  </span>
                  <button
                    type="button"
                    className="ghost inline-ghost"
                    onClick={() => void handleTogglePrestataireVerified(user.id, !provider?.verified)}
                  >
                    {provider?.verified ? "Retirer la verification" : "Marquer comme verifie"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card stack">
          <div className="section-head">
            <h3>Gestion des comptes et roles</h3>
            <span>{dashboardPending ? "Mise a jour..." : `${managedUsers.length} comptes`}</span>
          </div>
          <ul className="list clean-list">
            {dashboardPending ? renderSkeletonList("admin-accounts") : null}
            {!dashboardPending && managedUsers.length === 0 ? <li>Aucun compte utilisateur.</li> : null}
            {!dashboardPending && managedUsers.map((user) => {
              const isSelf = user.id === currentUserId();
              const draftRole = adminRoleDraftByUserId[user.id] ?? user.role;
              const roleChanged = draftRole !== user.role;
              const isPendingRow = adminActionUserId === user.id;
              const roleStatusId = `admin-user-role-current-${user.id}`;
              const roleHelpId = `admin-user-role-help-${user.id}`;
              const selfProtectedId = `admin-user-self-protected-${user.id}`;

              return (
                <li key={`admin-user-${user.id}`} className="admin-provider-row admin-account-row">
                  <div className="admin-provider-copy">
                    <strong>{user.first_name} {user.last_name}</strong>
                    <div className="timeline-line">@{user.username} — {formatCameroonPhone(user.phone)}</div>
                    <div className="timeline-line">{user.email}</div>
                    <div id={roleStatusId} className="timeline-line">Role actuel: {user.role}</div>
                  </div>
                  <div className="admin-provider-actions admin-account-actions">
                    <label className="admin-role-picker">
                      <span id={roleHelpId} className="helper-line">Nouveau role</span>
                      <select
                        className="styled-select"
                        value={draftRole}
                        disabled={isPendingRow}
                        aria-label={`Nouveau role pour ${user.username}`}
                        aria-describedby={`${roleStatusId} ${roleHelpId}`}
                        onChange={(event) =>
                          setAdminRoleDraftByUserId((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as Role,
                          }))
                        }
                      >
                        <option value="client">client</option>
                        <option value="prestataire">prestataire</option>
                        <option value="admin">admin</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="ghost inline-ghost"
                      disabled={isPendingRow || !roleChanged || isSelf}
                      aria-label={`Appliquer le role ${draftRole} pour ${user.username}`}
                      aria-describedby={roleStatusId}
                      onClick={() => void handleAdminChangeUserRole(user, draftRole)}
                    >
                      {isPendingRow && adminActionKind === "role" ? "Mise a jour..." : "Appliquer role"}
                    </button>
                    <button
                      type="button"
                      className="ghost inline-ghost danger"
                      disabled={isPendingRow || isSelf}
                      aria-label={`Supprimer le compte ${user.username}`}
                      aria-describedby={isSelf ? `${roleStatusId} ${selfProtectedId}` : roleStatusId}
                      onClick={() => void handleAdminDeleteUser(user)}
                    >
                      {isPendingRow && adminActionKind === "delete" ? "Suppression..." : "Supprimer"}
                    </button>
                    {isSelf ? <span id={selfProtectedId} className="helper-line">Compte courant protege</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />
      <div className="bg-glow bg-glow-c" />
      <header className="app-header">
        <span className="eyebrow">Services à Domicile</span>
        <h1>ChezVous Services+</h1>
        <p>Trouvez des prestataires de confiance près de chez vous, et gérez vos missions en toute sérénité.</p>
      </header>

      <section className="services-strip">
        <p className="services-strip__label">Nos services disponibles</p>
        <ul className="services-strip__list">
          <li className="service-chip service-chip--menage">
            🧹 Ménage
          </li>
          <li className="service-chip service-chip--plomberie">
            🔧 Plomberie
          </li>
          <li className="service-chip service-chip--electricite">
            ⚡ Électricité
          </li>
        </ul>
      </section>

      <main className="layout">
        <Routes>
          <Route
            path="/"
            element={
              isLoggedIn ? (
                <Navigate to={roleHomePath(role)} replace />
              ) : (
                <section className="panel auth-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Bienvenue sur ChezVous Services+</h2>
                      <p>Choisissez votre profil pour continuer.</p>
                    </div>
                  </div>
                  <div className="choice-grid">
                    <article className="card stack role-card">
                      <span className="role-icon">🏠</span>
                      <h3>Client</h3>
                      <p>Publiez vos besoins, suivez vos missions et trouvez des prestataires de qualité.</p>
                      <button type="button" onClick={() => navigate("/auth/client")}>Accès client</button>
                    </article>

                    <article className="card stack role-card">
                      <span className="role-icon">🛠️</span>
                      <h3>Prestataire</h3>
                      <p>Proposez vos services, recevez des missions et développez votre activité.</p>
                      <button type="button" onClick={() => navigate("/auth/prestataire")}>Accès prestataire</button>
                    </article>
                  </div>
                  <p className="subtle-note">Seuls les profils publics sont accessibles depuis cette page.</p>
                </section>
              )
            }
          />

          <Route path="/auth/client" element={isLoggedIn ? <Navigate to={roleHomePath(role)} replace /> : renderPublicAuth("client")} />
          <Route path="/auth/prestataire" element={isLoggedIn ? <Navigate to={roleHomePath(role)} replace /> : renderPublicAuth("prestataire")} />

          <Route
            path={HIDDEN_ADMIN_PATH}
            element={
              !isLoggedIn ? (
                <section className="panel auth-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Accès Admin Sécurisé</h2>
                      <p>Accès restreint — non visible des utilisateurs publics.</p>
                    </div>
                    <span className="status-pill">restricted</span>
                  </div>
                  <form className="card stack" onSubmit={(event) => void handleLogin(event, "admin")}>
                    <h3>Connexion admin</h3>
                    <label>
                      <span>Phone</span>
                      <input type="text" name="phone" required />
                    </label>
                    <label>
                      <span>Password</span>
                      <input type="password" name="password" required />
                    </label>
                    <button type="submit" disabled={loginPending}>
                      {loginPending ? "Connexion..." : "Acceder a la console admin"}
                    </button>
                  </form>
                </section>
              ) : role !== "admin" ? (
                <Navigate to={roleHomePath(role)} replace />
              ) : (
                renderAdminWorkspace()
              )
            }
          />

          <Route
            path="/espace/client"
            element={!isLoggedIn ? <Navigate to="/auth/client" replace /> : role !== "client" ? <Navigate to={roleHomePath(role)} replace /> : renderClientWorkspace()}
          />

          <Route
            path="/espace/prestataire"
            element={
              !isLoggedIn ? <Navigate to="/auth/prestataire" replace /> : role !== "prestataire" ? <Navigate to={roleHomePath(role)} replace /> : renderPrestataireWorkspace()
            }
          />

          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to={isLoggedIn ? roleHomePath(role) : "/"} replace />} />
          <Route path="*" element={<Navigate to={isLoggedIn ? roleHomePath(role) : "/"} replace />} />
        </Routes>
      </main>

      {selectedDemandForDetail ? (
        <div className={`demand-detail-modal ${demandDetailClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Details de la demande">
          <div className="demand-detail-panel">
            <div className="demand-detail-header">
              <div>
                <h2>Demande #{selectedDemandForDetail.id}</h2>
                <span className={statusChipClass(selectedDemandForDetail.status)}>{demandeStatusLabel(selectedDemandForDetail.status)}</span>
              </div>
              <button type="button" className="ghost" onClick={closeDemandDetailModal} title="Fermer">✕</button>
            </div>

            <div className="demand-detail-content">
              <section className="demand-section">
                <h3>Description</h3>
                <p className="demand-description">{selectedDemandForDetail.description}</p>
              </section>

              <section className="demand-section">
                <h3>Localisation</h3>
                <div className="demand-geo-grid">
                  <div>
                    <strong>Adresse</strong>
                    <p>{selectedDemandForDetail.location}</p>
                  </div>
                  <div>
                    <strong>Ville</strong>
                    <p>{selectedDemandForDetail.ville || "—"}</p>
                  </div>
                  <div>
                    <strong>Arrondissement</strong>
                    <p>{selectedDemandForDetail.arrondissement || "—"}</p>
                  </div>
                  <div>
                    <strong>Quartier</strong>
                    <p>{selectedDemandForDetail.quartier || "—"}</p>
                  </div>
                </div>
              </section>

              <section className="demand-section">
                <h3>Disponibilités du client</h3>
                <div className="demand-availability">
                  <div>
                    <strong>Mode</strong>
                    <p>{selectedDemandForDetail.client_availability_mode === "fixe" ? "Planning fixe" : "Flexible"}</p>
                  </div>
                  {selectedDemandForDetail.client_availability_note && (
                    <div>
                      <strong>Détails</strong>
                      <p>{selectedDemandForDetail.client_availability_note}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="demand-section">
                <h3>Priorité</h3>
                <div className="priority-badge" data-priority={selectedDemandForDetail.priority}>
                  {selectedDemandForDetail.priority === "haute" && "🔴 Urgente"}
                  {selectedDemandForDetail.priority === "normale" && "🔵 Normale"}
                  {selectedDemandForDetail.priority === "basse" && "🟢 Basse"}
                </div>
              </section>

              {selectedDemandForDetail.events && selectedDemandForDetail.events.length > 0 && (
                <section className="demand-section">
                  <h3>Historique</h3>
                  <ul className="timeline clean-list">
                    {selectedDemandForDetail.events.map((event) => {
                      const stepBadge = demandeEventStepBadge(event);
                      return (
                        <li key={event.id} className="timeline-item">
                          <span className="timeline-marker" />
                          <div className="timeline-content">
                            <div className="timeline-line timeline-line--event">
                              <strong className="timeline-event-title">{demandeEventText(event)}</strong>
                              {stepBadge ? (
                                <span className={`step-badge step-badge--${stepBadge.key}`}>{stepBadge.label}</span>
                              ) : null}
                            </div>
                            {event.previous_status && event.new_status ? (
                              <p className="timeline-detail">Transition: {formatStatusLabel(event.previous_status)} {"->"} {formatStatusLabel(event.new_status)}</p>
                            ) : null}
                            {demandeEventActor(event) !== "Systeme" ? (
                              <p className="timeline-detail">Par: {demandeEventActor(event)}</p>
                            ) : null}
                            <time className="timeline-time">{formatDateTime(event.created_at)}</time>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            <div className="demand-detail-actions">
              <button type="button" className="ghost" onClick={closeDemandDetailModal}>Fermer</button>
            </div>
          </div>
        </div>
      ) : null}

      {editDemandeTarget && editDemandeDraft ? (
        <div className={`action-modal ${editModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Modifier la demande">
          <form className="action-modal__panel stack" onSubmit={(event) => void handleConfirmEditDemande(event)}>
            <div className="section-head">
              <h3>Modifier la demande #{editDemandeTarget.id}</h3>
              <button type="button" className="ghost" onClick={closeEditDemandeModal} disabled={editDemandePending}>✕</button>
            </div>
            <label>
              <span>Description</span>
              <textarea
                value={editDemandeDraft.description}
                onChange={(event) => setEditDemandeDraft((prev) => prev ? { ...prev, description: event.target.value } : prev)}
                required
              />
            </label>
            <div className="two-col">
              <label>
                <span>Ville</span>
                <input
                  type="text"
                  value={editDemandeDraft.ville}
                  onChange={(event) => setEditDemandeDraft((prev) => prev ? { ...prev, ville: event.target.value } : prev)}
                  required
                />
              </label>
              <label>
                <span>Arrondissement</span>
                <input
                  type="text"
                  value={editDemandeDraft.arrondissement}
                  onChange={(event) => setEditDemandeDraft((prev) => prev ? { ...prev, arrondissement: event.target.value } : prev)}
                  required
                />
              </label>
            </div>
            <div className="two-col">
              <label>
                <span>Quartier</span>
                <input
                  type="text"
                  value={editDemandeDraft.quartier}
                  onChange={(event) => setEditDemandeDraft((prev) => prev ? { ...prev, quartier: event.target.value } : prev)}
                  required
                />
              </label>
              <label>
                <span>Priorité</span>
                <select
                  className="styled-select"
                  value={editDemandeDraft.priority}
                  onChange={(event) => setEditDemandeDraft((prev) => prev ? { ...prev, priority: event.target.value } : prev)}
                >
                  <option value="haute">🔴 Urgente</option>
                  <option value="normale">🔵 Normale</option>
                  <option value="basse">🟢 Basse</option>
                </select>
              </label>
            </div>
            <label>
              <span>Disponibilité client</span>
              <select
                className="styled-select"
                value={editDemandeDraft.client_availability_mode}
                onChange={(event) =>
                  setEditDemandeDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          client_availability_mode: event.target.value === "fixe" ? "fixe" : "flexible",
                        }
                      : prev
                  )
                }
              >
                <option value="flexible">Flexible</option>
                <option value="fixe">Planning fixe</option>
              </select>
            </label>
            <label>
              <span>Détails disponibilité</span>
              <input
                type="text"
                value={editDemandeDraft.client_availability_note}
                onChange={(event) =>
                  setEditDemandeDraft((prev) => prev ? { ...prev, client_availability_note: event.target.value } : prev)
                }
                placeholder="Optionnel si flexible"
              />
            </label>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeEditDemandeModal} disabled={editDemandePending}>Annuler</button>
              <button type="submit" disabled={editDemandePending}>{editDemandePending ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {demandeCancelId !== null ? (
        <div className={`action-modal ${cancelModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Confirmer l'annulation">
          <div className="action-modal__panel stack">
            <h3>Annuler la demande #{demandeCancelId} ?</h3>
            <p>Cette action est irreversible pour cette demande.</p>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeCancelDemandeModal}>Retour</button>
              <button type="button" onClick={() => void confirmCancelDemande()}>Confirmer l'annulation</button>
            </div>
          </div>
        </div>
      ) : null}

      {unregisterModalOpen ? (
        <div className={`action-modal ${unregisterModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Confirmer la desinscription">
          <div className="action-modal__panel stack">
            <h3>Confirmer la désinscription</h3>
            <p>Entrez votre mot de passe pour supprimer votre compte.</p>
            <label>
              <span>Mot de passe</span>
              <input
                type="password"
                value={unregisterPassword}
                onChange={(event) => setUnregisterPassword(event.target.value)}
                placeholder="Votre mot de passe"
              />
            </label>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeUnregisterModal} disabled={unregisterPending}>Annuler</button>
              <button type="button" onClick={() => void confirmUnregister()} disabled={unregisterPending}>
                {unregisterPending ? "Suppression..." : "Supprimer mon compte"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cropModalOpen && cropImageSize ? (
        <div className={`avatar-crop-modal ${cropModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Recadrer la photo de profil">
          <div className="avatar-crop-panel">
            <h3>Recadrer la photo</h3>
            <p>Faites glisser l'image et ajustez le zoom.</p>

            <div
              className="avatar-crop-stage"
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
              onPointerCancel={onCropPointerUp}
            >
              <img
                src={cropSourceDataUrl}
                alt="Apercu recadrage"
                className="avatar-crop-image"
                draggable={false}
                style={{
                  width: `${avatarDisplaySize(cropImageSize.width, cropImageSize.height, cropZoom).width}px`,
                  height: `${avatarDisplaySize(cropImageSize.width, cropImageSize.height, cropZoom).height}px`,
                  transform: `translate(-50%, -50%) translate(${cropOffsetX}px, ${cropOffsetY}px)`,
                }}
              />
              <div className="avatar-crop-mask" />
            </div>

            <div className="avatar-crop-controls">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(event) => handleCropZoomChange(Number(event.target.value))}
              />
            </div>

            <div className="avatar-crop-actions">
              <button type="button" className="ghost" onClick={closeCropModal} disabled={cropPending}>Annuler</button>
              <button type="button" onClick={() => void confirmCropSelection()} disabled={cropPending}>
                {cropPending ? "Application..." : "Appliquer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
  );
}

export default function App(): JSX.Element {
  return <AppShell />;
}


