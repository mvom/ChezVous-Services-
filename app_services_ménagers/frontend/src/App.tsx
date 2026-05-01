import { FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

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
  price: number;
  created_at: string;
  updated_at: string;
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
};

type ToastState = {
  kind: "ok" | "err";
  message: string;
} | null;

type AuthMode = "login" | "register";

type ClientStatusFilter = "all" | "ouverte" | "attribuee" | "annulee" | "expiree";
type PrestataireStatusFilter = "all" | "ouverte" | "attribuee";

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

const API_BASE = "http://localhost:8000/api/v1";
const TOKEN_KEY = "sm_token";
const HIDDEN_ADMIN_PATH = "/_staff/console";

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
  if (status === "ouverte") return "Ouverte";
  if (status === "attribuee") return "Attribuée";
  if (status === "annulee") return "Annulée";
  if (status === "expiree") return "Expirée";
  if (status === "en_attente") return "En attente";
  if (status === "acceptee") return "Acceptée";
  if (status === "confirmee") return "Confirmée";
  if (status === "en_cours") return "En cours";
  if (status === "terminee") return "Terminée";
  if (status === "litige") return "Litige";
  return status;
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
  if (!status) {
    return "statut inconnu";
  }
  return status.replace(/_/g, " ");
}

function demandeEventText(event: DemandeEvent): string {
  if (event.event_type === "cree") {
    return "Demande creee";
  }
  if (event.event_type === "attribuee") {
    return "Demande attribuee";
  }
  if (event.event_type === "en_cours") {
    return "Mission en cours";
  }
  if (event.event_type === "terminee") {
    return "Mission terminee";
  }
  if (event.previous_status && event.new_status) {
    return `Transition: ${formatStatusLabel(event.previous_status)} -> ${formatStatusLabel(event.new_status)}`;
  }
  if (event.new_status) {
    return `Statut: ${formatStatusLabel(event.new_status)}`;
  }
  return formatStatusLabel(event.event_type);
}

function demandeEventActor(event: DemandeEvent): string {
  if (event.actor_label) {
    return event.actor_label;
  }
  if (event.actor_user_id) {
    return `Utilisateur #${event.actor_user_id}`;
  }
  return "Systeme";
}

function priorityLabel(priority: string): string {
  if (priority === "haute") return "URGENT";
  if (priority === "basse") return "Basse";
  return "Normale";
}

function priorityClass(priority: string): string {
  if (priority === "haute") return "priority-badge priority-haute";
  if (priority === "basse") return "priority-badge priority-basse";
  return "priority-badge priority-normale";
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

function missionKanbanStatus(status: string): "pending" | "active" | "done" | "other" {
  if (status === "en_attente" || status === "acceptee" || status === "confirmee") return "pending";
  if (status === "en_cours") return "active";
  if (status === "terminee") return "done";
  return "other";
}

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
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>("all");
  const [clientQuery, setClientQuery] = useState("");
  const [prestataireStatusFilter, setPrestataireStatusFilter] = useState<PrestataireStatusFilter>("ouverte");
  const [prestataireVilleFilter, setPrestataireVilleFilter] = useState("all");
  const [prestataireArrondissementFilter, setPrestataireArrondissementFilter] = useState("all");
  const [prestataireQuartierFilter, setPrestataireQuartierFilter] = useState("all");
  const [authModeByRole, setAuthModeByRole] = useState<Record<Extract<Role, "client" | "prestataire">, AuthMode>>({
    client: "register",
    prestataire: "register",
  });
  const clientCreateFormRef = useRef<HTMLFormElement | null>(null);
  const prestataireCreateServiceRef = useRef<HTMLFormElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAvatarRef = useRef<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);

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
      setUserProfile(null);
      window.localStorage.removeItem(TOKEN_KEY);
      navigate("/", { replace: true });
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
    void refreshDashboard(nextClaims, token);
  }, [token]);

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

  async function refreshDashboard(nextClaims: JwtClaims, nextToken: string) {
    if (!nextClaims.sub) {
      return;
    }

    try {
      setDashboardPending(true);
      const [nextDemandes, nextServices, nextMissions] = await Promise.all([
        apiFetch<Demande[]>("/demandes", { headers: authHeaders(nextToken) }),
        apiFetch<Service[]>("/services", { headers: authHeaders(nextToken) }),
        apiFetch<Mission[]>("/missions", { headers: authHeaders(nextToken) }),
      ]);
      setDemandes(nextDemandes);
      setServices(nextServices);
      setMissions(nextMissions);
      navigate(roleHomePath(nextClaims.role), { replace: true });
      void fetchUserProfile(nextToken);
    } catch (error) {
      setToken("");
      setClaims(null);
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Session expired" });
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
        throw new Error("Unable to read role from token");
      }
      if (expectedRole && nextClaims.role !== expectedRole) {
        throw new Error("This account is not allowed on this access page");
      }

      form.reset();
      setToken(result.access_token);
      setToast({ kind: "ok", message: "Login successful" });
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Login failed" });
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

      // Capture pending avatar if provided
      const avatarFile = (form.elements.namedItem("avatar") as HTMLInputElement | null)?.files?.[0];
      if (avatarFile) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => { pendingAvatarRef.current = reader.result as string; resolve(); };
          reader.readAsDataURL(avatarFile);
        });
      }
      form.reset();
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
    try {
      await apiFetch<void>("/demandes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          client_id: currentUserId(),
          description: String(formData.get("description") || ""),
          location: [ville, arrondissement, quartier].filter(Boolean).join(", "),
          ville,
          arrondissement,
          quartier,
          priority: String(formData.get("priority") || "normale"),
        }),
      });
      setToast({ kind: "ok", message: "Request created" });
      form.reset();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Request creation failed" });
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
          "Le service est enregistre, mais l'actualisation de l'ecran a echoue. Cliquez sur Refresh.",
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
    }
  }

  async function handleUnregister() {
    if (!token) {
      return;
    }
    const password = window.prompt("Entrez votre mot de passe pour confirmer la desinscription :");
    if (!password) {
      return;
    }

    try {
      await apiFetch<{ detail: string }>("/auth/unregister", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ password }),
      });
      logout();
      setToast({ kind: "ok", message: "Compte supprime. Verification dans MailHog." });
      navigate("/", { replace: true });
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Desinscription impossible" });
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 450_000) {
      setToast({ kind: "err", message: "Image trop grande. Maximum 450 Ko." });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        setAvatarUploadPending(true);
        await apiFetch<UserProfile>("/auth/me/avatar", {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ avatar_url: base64 }),
        });
        setUserProfile((prev) => prev ? { ...prev, avatar_url: base64 } : prev);
        setToast({ kind: "ok", message: "Photo de profil mise à jour !" });
      } catch (error) {
        setToast({ kind: "err", message: error instanceof Error ? error.message : "Erreur lors du téléversement." });
      } finally {
        setAvatarUploadPending(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    event.target.value = "";
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
              <span>Photo de profil <em style={{ fontWeight: 400, opacity: 0.7 }}>(optionnelle)</em></span>
              <input type="file" name="avatar" accept="image/*" />
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
              Refresh
            </button>
            <button type="button" className="ghost" onClick={() => void handleUnregister()}>
              Desinscription
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <section className="card recommendation-card">
          <div>
            <h3>Prochaine action recommandee</h3>
            <p>{nextAction.description}</p>
          </div>
          <button type="button" onClick={nextAction.onClick}>{nextAction.cta}</button>
        </section>

        <div className="quick-actions">
          <button type="button" className="ghost" onClick={() => setClientStatusFilter("ouverte")}>Demandes ouvertes</button>
          <button
            type="button"
            className="ghost"
            onClick={() => clientCreateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            Nouvelle demande
          </button>
          <button type="button" className="ghost" onClick={() => setClientStatusFilter("all")}>Tout afficher</button>
        </div>

        <div className="stats-grid">
          <article className="metric-card">
            <span>My requests</span>
            <strong>{clientDemandes.length}</strong>
          </article>
          <article className="metric-card">
            <span>Available services</span>
            <strong>{services.length}</strong>
          </article>
          <article className="metric-card wide">
            <span>Services history</span>
            <strong>{clientMissions.length}</strong>
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
              {filteredDemandes.length === 0 ? <li>Aucune demande ne correspond au filtre.</li> : null}
              {filteredDemandes.map((demande) => {
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
                    {linkedMission?.scheduled_at ? (
                      <div className="eta-line">
                        <span className="eta-icon">📅</span>
                        <span>Intervention prevue le {formatDateTime(linkedMission.scheduled_at)}</span>
                      </div>
                    ) : null}
                    <div className="event-timeline-grouped">
                      {eventGroups.map((group) => (
                        <div key={group.day} className="timeline-day-group">
                          <div className="timeline-day-label">{group.day}</div>
                          <ul className="event-timeline">
                            {group.events.map((ev) => (
                              <li key={ev.id} className={`timeline-item timeline-item--${ev.event_type}`}>
                                <span className="timeline-item__bullet" />
                                <div>
                                  <div className="timeline-line">
                                    <strong>{demandeEventText(ev)}</strong>
                                    {demandeEventActor(ev) !== "Systeme" ? ` — ${demandeEventActor(ev)}` : ""}
                                  </div>
                                  <div className="timeline-line">{formatDateTime(ev.created_at)}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="demande-meta">{demandeGeoLabel(demande)} — {demande.description}</div>
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
              {clientMissions.length === 0 ? <li>Aucun service rendu pour le moment.</li> : null}
              {clientMissions.map((mission) => (
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
                  <div className="timeline-line">Demande #{mission.demande_id} — Prestataire #{mission.prestataire_id}</div>
                  <div className="timeline-line">Creation: {formatDateTime(mission.created_at)}</div>
                  <div className="timeline-line">Mise a jour: {formatDateTime(mission.updated_at)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="two-col">
          <form className="card stack" onSubmit={handleCreateDemande} ref={clientCreateFormRef}>
            <h3>Create request</h3>
            <label>
              <span>Description</span>
              <textarea name="description" required />
            </label>
            <label>
              <span>Ville</span>
              <input type="text" name="ville" placeholder="Ex: Douala" required />
            </label>
            <label>
              <span>Arrondissement</span>
              <input type="text" name="arrondissement" placeholder="Ex: Douala 5" required />
            </label>
            <label>
              <span>Quartier</span>
              <input type="text" name="quartier" placeholder="Ex: Makepe" required />
            </label>
            <label>
              <span>Priorité</span>
              <select className="styled-select" name="priority" defaultValue="normale">
                <option value="haute">🔴 Urgente</option>
                <option value="normale">🔵 Normale</option>
                <option value="basse">🟢 Basse</option>
              </select>
            </label>
            <button type="submit">Create request</button>
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
    const activeProviderMissions = providerMissions.filter((mission) => mission.status === "en_cours").length;
    const completedProviderMissions = providerMissions.filter((mission) => mission.status === "terminee").length;
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
              Refresh
            </button>
            <button type="button" className="ghost" onClick={() => void handleUnregister()}>
              Desinscription
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <section className="card recommendation-card provider-reco">
          <div>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.description}</p>
          </div>
          <button type="button" onClick={recommendation.onClick}>{recommendation.cta}</button>
        </section>

        <div className="quick-actions">
          <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("ouverte")}>Demandes ouvertes</button>
          <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("attribuee")}>Demandes attribuees</button>
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

        <div className="stats-grid">
          <article className="metric-card">
            <span>Open requests</span>
            <strong>{matchingDemandes.length}</strong>
          </article>
          <article className="metric-card">
            <span>My services</span>
            <strong>{ownServices.length}</strong>
          </article>
          <article className="metric-card wide">
            <span>Missions actives / terminees</span>
            <strong>{activeProviderMissions} / {completedProviderMissions}</strong>
          </article>
        </div>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>Open requests feed</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <div className="helper-line">Opportunites prioritaires (3 plus recentes)</div>
            <ul className="list clean-list compact-list">
              {topOpportunities.length === 0 ? <li>Aucune opportunite pour ce filtre.</li> : null}
              {topOpportunities.map((demande) => (
                <li key={`top-${demande.id}`}>
                  <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                    <span className="status-dot" />
                    <strong>Demande #{demande.id}</strong>
                    <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                  </div>
                  <div>{demandeGeoLabel(demande)} - {demande.description}</div>
                </li>
              ))}
            </ul>
            <ul className="list clean-list">
              {matchingDemandes.length === 0 ? <li>No requests yet.</li> : null}
              {matchingDemandes.map((demande) => (
                <li key={demande.id}>
                  <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                    <span className="status-dot" />
                    <strong>Demande #{demande.id}</strong>
                    <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                  </div>
                  <div>{demandeGeoLabel(demande)} - {demande.description}</div>
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
              {ownServices.length === 0 ? <li>No services yet.</li> : null}
              {ownServices.map((service) => (
                <li key={service.id}>
                  <strong>#{service.id}</strong> {service.name} - {service.price}
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
              <span>Price</span>
              <input type="number" name="price" min="0" step="1" required />
            </label>
            <button type="submit">Create service</button>
          </form>

          <section className="card stack muted-card">
            <h3>Mission readiness</h3>
            <p>Keep your offer clear and pricing updated to improve request matching.</p>
          </section>
        </div>

        <section className="card stack kanban-section">
          <div className="section-head">
            <h3>Mes missions — Kanban</h3>
            <span>{dashboardPending ? "Loading..." : `${providerMissions.length} mission(s)`}</span>
          </div>
          {providerMissions.length === 0 ? (
            <p className="helper-line">Aucune mission assignee pour le moment. Acceptez une demande pour commencer.</p>
          ) : (
            <div className="kanban-board">
              {/* Column: En attente / Acceptée */}
              <div className="kanban-col kanban-col--pending">
                <div className="kanban-col__header">
                  <span className="kanban-col__dot" />
                  <strong>En attente</strong>
                  <span className="kanban-count">{providerMissions.filter((m) => missionKanbanStatus(m.status) === "pending").length}</span>
                </div>
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "pending").map((m) => (
                  <div key={m.id} className="kanban-card">
                    <div className="kanban-card__title">Mission #{m.id}</div>
                    <div className="kanban-card__meta">Demande #{m.demande_id}</div>
                    <div className="kanban-card__meta">Depuis: {formatDateTime(m.created_at)}</div>
                    {m.scheduled_at ? (
                      <div className="kanban-card__eta">📅 {formatDateTime(m.scheduled_at)}</div>
                    ) : null}
                    <div className="kanban-card__actions">
                      <button
                        type="button"
                        className="kanban-btn kanban-btn--start"
                        onClick={() => void handleUpdateMissionStatus(m.id, "en_cours")}
                      >
                        Démarrer
                      </button>
                    </div>
                  </div>
                ))}
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "pending").length === 0 ? (
                  <div className="kanban-empty">Aucune mission</div>
                ) : null}
              </div>

              {/* Column: En cours */}
              <div className="kanban-col kanban-col--active">
                <div className="kanban-col__header">
                  <span className="kanban-col__dot" />
                  <strong>En cours</strong>
                  <span className="kanban-count">{providerMissions.filter((m) => missionKanbanStatus(m.status) === "active").length}</span>
                </div>
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "active").map((m) => (
                  <div key={m.id} className="kanban-card kanban-card--active">
                    <div className="kanban-card__title">Mission #{m.id}</div>
                    <div className="kanban-card__meta">Demande #{m.demande_id}</div>
                    <div className="kanban-card__meta">Depuis: {formatDateTime(m.updated_at)}</div>
                    {m.scheduled_at ? (
                      <div className="kanban-card__eta">📅 {formatDateTime(m.scheduled_at)}</div>
                    ) : null}
                    <div className="kanban-card__actions">
                      <button
                        type="button"
                        className="kanban-btn kanban-btn--done"
                        onClick={() => void handleUpdateMissionStatus(m.id, "terminee")}
                      >
                        Terminer
                      </button>
                    </div>
                  </div>
                ))}
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "active").length === 0 ? (
                  <div className="kanban-empty">Aucune mission</div>
                ) : null}
              </div>

              {/* Column: Terminée */}
              <div className="kanban-col kanban-col--done">
                <div className="kanban-col__header">
                  <span className="kanban-col__dot" />
                  <strong>Terminée</strong>
                  <span className="kanban-count">{providerMissions.filter((m) => missionKanbanStatus(m.status) === "done").length}</span>
                </div>
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "done").map((m) => (
                  <div key={m.id} className="kanban-card kanban-card--done">
                    <div className="kanban-card__title">Mission #{m.id}</div>
                    <div className="kanban-card__meta">Demande #{m.demande_id}</div>
                    <div className="kanban-card__meta">Terminee: {formatDateTime(m.updated_at)}</div>
                  </div>
                ))}
                {providerMissions.filter((m) => missionKanbanStatus(m.status) === "done").length === 0 ? (
                  <div className="kanban-empty">Aucune mission</div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </section>
    );
  }

  function renderAdminWorkspace(): JSX.Element {
    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div>
            <h2>Console Admin</h2>
            <p>Espace restreint pour la supervision de la plateforme et les contrôles transversaux.</p>
          </div>
          <div className="meta">
            <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
              Refresh
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <article className="metric-card">
            <span>Total requests</span>
            <strong>{demandes.length}</strong>
          </article>
          <article className="metric-card">
            <span>Total services</span>
            <strong>{services.length}</strong>
          </article>
          <article className="metric-card wide">
            <span>Workspace</span>
            <strong>Admin</strong>
          </article>
        </div>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>Requests overview</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {demandes.length === 0 ? <li>No requests yet.</li> : null}
              {demandes.map((demande) => (
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
              {services.length === 0 ? <li>No services yet.</li> : null}
              {services.map((service) => (
                <li key={service.id}>
                  <strong>#{service.id}</strong> {service.name} - {service.price} (provider {service.prestataire_id})
                </li>
              ))}
            </ul>
          </section>
        </div>
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
                    <h3>Admin login</h3>
                    <label>
                      <span>Phone</span>
                      <input type="text" name="phone" required />
                    </label>
                    <label>
                      <span>Password</span>
                      <input type="password" name="password" required />
                    </label>
                    <button type="submit" disabled={loginPending}>
                      {loginPending ? "Signing in..." : "Enter admin console"}
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

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
  );
}

export default function App(): JSX.Element {
  return <AppShell />;
}
