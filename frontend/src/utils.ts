// ── Pure utility functions ───────────────────────────────────────────────────
// No JSX, no React imports — these are pure TS functions.

import {
  AVAILABILITY_LABELS,
  EVENT_TEXT,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STEP_LABELS,
} from "./labels";
import type { Demande, DemandeEvent, JwtClaims, PrestataireMissionSummary, Role, SessionResponse, ThemeMode } from "./types";
import {
  API_BASE,
  HIDDEN_ADMIN_PATH,
  THEME_PREF_KEY_PREFIX,
  TOKEN_REFRESH_SKEW_SECONDS,
} from "./constants";

// ── Geo helpers ───────────────────────────────────────────────────────────────

// Module-level token store — set after login/refresh, read by apiFetch
// Module-level token store — persisted in sessionStorage so it survives HMR/nav
const _TOKEN_KEY = "__cvs_auth_token__";
let _authToken: string | null = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(_TOKEN_KEY) : null;
export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (typeof sessionStorage !== "undefined") {
    if (token) sessionStorage.setItem(_TOKEN_KEY, token);
    else sessionStorage.removeItem(_TOKEN_KEY);
  }
}
export function getAuthToken(): string | null { return _authToken; }

export function cleanGeo(value?: string | null): string {
  return (value || "").trim();
}

export function demandeGeoLabel(demande: Demande): string {
  const parts = [cleanGeo(demande.ville), cleanGeo(demande.arrondissement), cleanGeo(demande.quartier)].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return (demande.location || "Localisation indisponible").trim();
}

export function clientAvailabilityLabel(demande: Demande): string {
  const mode = (demande.client_availability_mode || "flexible").toLowerCase();
  const note = (demande.client_availability_note || "").trim();
  const modeLabel = AVAILABILITY_LABELS[mode] ?? (note || AVAILABILITY_LABELS.fixe);
  return note && mode !== "flexible" ? `Disponibilité client : ${note}` : `Disponibilité client : ${modeLabel}`;
}

// ── Theme / Auth helpers ──────────────────────────────────────────────────────

export function themeStorageKey(username?: string): string {
  const normalized = (username || "guest").trim().toLowerCase();
  return `${THEME_PREF_KEY_PREFIX}:${normalized || "guest"}`;
}

export function readThemePreference(username?: string): ThemeMode {
  const stored = window.localStorage.getItem(themeStorageKey(username));
  return stored === "rose" ? "rose" : "violet";
}

export function sessionToClaims(r: SessionResponse): JwtClaims {
  const decoded = r.access_token ? decodeJwt(r.access_token) : null;
  return {
    sub: r.sub ?? decoded?.sub,
    role: r.role ?? r.active_role ?? decoded?.role,
    username: r.username ?? decoded?.username,
    exp: r.exp ?? decoded?.exp,
    token: r.access_token,
  };
}

export function decodeJwt(jwtToken: string): JwtClaims | null {
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

export function isTokenExpired(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp <= nowEpochSeconds;
}

export function shouldActualiserToken(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp - nowEpochSeconds <= TOKEN_REFRESH_SKEW_SECONDS;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (_authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${_authToken}`);
  }
  const url = `${API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", ...options, headers });
  } catch {
    // Retry once to absorb transient connection resets during container warm-up.
    try {
      response = await fetch(url, { credentials: "include", ...options, headers });
    } catch {
      throw new Error("Connexion API impossible. Verifiez que le backend est demarre (port 8000).");
    }
  }
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

export function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function roleHomePath(role?: Role): string {
  if (role === "client") return "/espace/client";
  if (role === "prestataire") return "/espace/prestataire";
  if (role === "admin") return HIDDEN_ADMIN_PATH;
  return "/";
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatCameroonPhone(value: string): string {
  const compact = value.replace(/\s+/g, "").trim();
  const normalized = compact.startsWith("+237") ? compact : `+237${compact.replace(/^\+/, "")}`;
  const digits = normalized.replace("+237", "");
  if (!/^\d{9}$/.test(digits)) {
    return value;
  }
  return `+237 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

export function normalizePersonName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function userFacingError(error: unknown, fallbackMessage: string, context: string): string {
  if (!(error instanceof Error)) return fallbackMessage;
  console.error(`[debug:${context}]`, error);
  const rawMessage = (error.message || "").trim();
  if (!rawMessage) return fallbackMessage;
  const lowered = rawMessage.toLowerCase();
  if (lowered.includes("cannot read properties of null") || lowered.includes("cannot read property")) {
    return fallbackMessage;
  }
  return rawMessage;
}

export function formatDateTime(value?: string): string {
  if (!value) return "Date indisponible";
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "Date indisponible";
  return asDate.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function demandeStatusTone(status: string): "green" | "blue" | "orange" | "gray" {
  if (status === "ouverte") return "green";
  if (status === "attribuee") return "blue";
  if (status === "annulee") return "orange";
  return "gray";
}

export function demandeStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusChipClass(status: string): string {
  const base = "status-chip";
  if (status === "ouverte") return `${base} chip-ouverte`;
  if (status === "attribuee") return `${base} chip-attribuee`;
  if (status === "annulee") return `${base} chip-annulee`;
  if (status === "expiree") return `${base} chip-expiree`;
  if (status === "en_cours") return `${base} chip-en-cours`;
  if (status === "terminee") return `${base} chip-terminee`;
  return base;
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) return "statut inconnu";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function demandeEventText(event: DemandeEvent): string {
  // 1. Si le type d'événement est connu, utiliser le label explicite
  if (EVENT_TEXT[event.event_type]) {
    // Cas spécial : modifiee avec new_status ouverte = publication
    if (event.event_type === "modifiee" && event.new_status === "ouverte") {
      return "Demande publiée";
    }
    // Cas spécial : annulee
    if (event.event_type === "annulee") {
      return "Demande annulée";
    }
    return EVENT_TEXT[event.event_type];
  }

  // 2. Si changement de statut explicite (hors annulation), afficher une phrase claire
  if (event.previous_status && event.new_status && event.previous_status !== event.new_status && event.new_status !== "annulee") {
    return `Statut mis à jour : ${formatStatusLabel(event.new_status)}`;
  }

  // 3. Si nouveau statut seul, afficher une phrase claire
  if (event.new_status) {
    return `Statut : ${formatStatusLabel(event.new_status)}`;
  }

  // 4. Fallback : label lisible du type d'événement
  return formatStatusLabel(event.event_type);
}

export type DemandeStepBadge = {
  key: "publiee" | "attribuee" | "en_cours" | "terminee" | "notee";
  label: string;
};

export function demandeEventStepBadge(event: DemandeEvent): DemandeStepBadge | null {
  const step = (event.new_status || event.event_type || "").toLowerCase();
  if (step === "cree" || step === "ouverte" || step === "publiee") return { key: "publiee", label: STEP_LABELS.publiee };
  if (step === "attribuee" || step === "acceptee" || step === "confirmee") return { key: "attribuee", label: STEP_LABELS.attribuee };
  if (step === "en_cours") return { key: "en_cours", label: STEP_LABELS.en_cours };
  if (step === "terminee") return { key: "terminee", label: STEP_LABELS.terminee };
  if (step === "notee") return { key: "notee", label: STEP_LABELS.notee };
  return null;
}

export function demandeEventActor(event: DemandeEvent): string {
  if (event.actor_label) return event.actor_label;
  if (event.actor_user_id) return `Utilisateur #${event.actor_user_id}`;
  return "Système";
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? "Normale";
}

export function priorityClass(priority: string): string {
  return PRIORITY_CLASSES[priority] ?? "priority-badge priority-normale";
}

export function demandeCategoryLabel(category?: string | null): string {
  if (category === "plomberie") return "Plomberie";
  if (category === "electricite") return "Électricité";
  if (category === "mecanique_auto") return "Mécanique automobile";
  if (category === "soudure") return "Soudure";
  if (category === "evenementiel") return "Événementiel";
  if (category === "reparation_electronique") return "Réparation électronique";
  if (category === "climatisation") return "Climatisation & Réfrigération";
  return "Ménage";
}

export function formatServicePrice(price: number | null | undefined): string {
  if (price == null) return "À discuter";
  return `${Number(price).toLocaleString("fr-FR")} FCFA`;
}

export function groupEventsByDay(events: DemandeEvent[]): { day: string; events: DemandeEvent[] }[] {
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

export function missionPipelineStatus(status: string): "pending" | "active" | "done" | "other" {
  if (status === "en_attente" || status === "acceptee" || status === "confirmee") return "pending";
  if (status === "en_cours") return "active";
  if (status === "terminee") return "done";
  return "other";
}

export function demandeProgressIndex(status: string): number {
  if (status === "ouverte") return 0;
  if (status === "attribuee") return 1;
  if (status === "en_cours") return 2;
  if (status === "terminee") return 3;
  return 0;
}

export function demandeProgressSteps(status: string): Array<{ key: string; label: string; done: boolean; active: boolean }> {
  const index = demandeProgressIndex(status);
  const raw = [
    { key: "ouverte", label: "Créée" },
    { key: "attribuee", label: "Acceptée" },
    { key: "en_cours", label: "En cours" },
    { key: "terminee", label: "Terminée" },
  ];
  return raw.map((step, i) => ({ ...step, done: i < index, active: i === index }));
}

export function formatResponseDelay(value?: number | null): string {
  if (value == null) return "Réponse : indisponible";
  if (value < 60) return `Réponse moyenne : ${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (minutes === 0) return `Réponse moyenne : ${hours} h`;
  return `Réponse moyenne : ${hours} h ${minutes} min`;
}

export function etaReliabilityLabel(value: number): string {
  if (value >= 85) return `ETA fiable : ${value}%`;
  if (value >= 60) return `ETA assez fiable : ${value}%`;
  return `ETA à confirmer : ${value}%`;
}

export function trustBadgeTone(value: number): string {
  if (value >= 85) return "trust-badge trust-badge--strong";
  if (value >= 60) return "trust-badge trust-badge--medium";
  return "trust-badge trust-badge--soft";
}

export function badgeLabel(slug: string): string {
  if (slug === "mission-5") return "Pro en progression (5 missions)";
  if (slug === "mission-10") return "Pro de confiance (10 missions)";
  if (slug === "mission-20") return "Pro élite (20 missions)";
  return slug;
}

export function scoreBarClass(value: number): string {
  if (value >= 85) return "score-pill score-pill--strong";
  if (value >= 60) return "score-pill score-pill--medium";
  return "score-pill score-pill--soft";
}

export function initialsFromText(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "CL";
  const tokens = raw
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  const compact = tokens[0] || raw;
  if (compact.length >= 2) return `${compact[0]}${compact[1]}`.toUpperCase();
  return `${compact[0] || "C"}L`.toUpperCase();
}

export function dateRefPart(value?: string | null): string {
  const parsed = value ? new Date(value) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, "0");
  const day = String(safe.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function demandRef(prefix: "DEM" | "SRV", initials: string, datePart: string, order: number): string {
  return `${prefix}-${initials}-${datePart}-${String(order).padStart(3, "0")}`;
}

export function initialsFromActorLabel(label?: string | null): string | null {
  const raw = (label || "").trim();
  if (!raw) return null;
  const actorName = raw.split("(")[0].trim();
  return actorName ? initialsFromText(actorName) : null;
}

// ── Render helpers (non-JSX returns) ─────────────────────────────────────────

export function prestataireTrustProps(summary: PrestataireMissionSummary) {
  const { trust } = summary;
  return {
    displayName: summary.display_name,
    rating: trust.rating.toFixed(1),
    verified: trust.verified,
    completedMissions: trust.completed_missions,
    responseDelay: formatResponseDelay(trust.average_response_minutes),
    etaClass: trustBadgeTone(trust.eta_reliability_percent),
    etaLabel: etaReliabilityLabel(trust.eta_reliability_percent),
  };
}
