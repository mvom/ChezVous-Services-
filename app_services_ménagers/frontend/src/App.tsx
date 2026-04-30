import { FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

type Role = "client" | "prestataire" | "admin";

type JwtClaims = {
  sub?: string;
  role?: Role;
  exp?: number;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type Demande = {
  id: number;
  status: string;
  description: string;
  location: string;
};

type Service = {
  id: number;
  prestataire_id: number;
  name: string;
  description: string;
  price: number;
};

type ToastState = {
  kind: "ok" | "err";
  message: string;
} | null;

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
      window.localStorage.removeItem(TOKEN_KEY);
      navigate("/", { replace: true });
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
    void refreshDashboard(nextClaims, token);
  }, [token]);

  async function refreshDashboard(nextClaims: JwtClaims, nextToken: string) {
    if (!nextClaims.sub) {
      return;
    }

    try {
      setDashboardPending(true);
      const [nextDemandes, nextServices] = await Promise.all([
        apiFetch<Demande[]>("/demandes", { headers: authHeaders(nextToken) }),
        apiFetch<Service[]>("/services", { headers: authHeaders(nextToken) }),
      ]);
      setDemandes(nextDemandes);
      setServices(nextServices);
      navigate(roleHomePath(nextClaims.role), { replace: true });
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
    const formData = new FormData(event.currentTarget);

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

      setToken(result.access_token);
      setToast({ kind: "ok", message: "Login successful" });
      event.currentTarget.reset();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Login failed" });
    } finally {
      setLoginPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>, role: Extract<Role, "client" | "prestataire">) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setRegisterPending(true);
      await apiFetch<void>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: String(formData.get("full_name") || ""),
          phone: String(formData.get("phone") || ""),
          password: String(formData.get("password") || ""),
          role,
        }),
      });
      setToast({ kind: "ok", message: "Account created, now login" });
      event.currentTarget.reset();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Registration failed" });
    } finally {
      setRegisterPending(false);
    }
  }

  async function handleCreateDemande(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    try {
      await apiFetch<void>("/demandes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          client_id: currentUserId(),
          description: String(formData.get("description") || ""),
          location: String(formData.get("location") || ""),
        }),
      });
      setToast({ kind: "ok", message: "Request created" });
      event.currentTarget.reset();
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

    const formData = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      if (claims) {
        await refreshDashboard(claims, token);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Service creation failed" });
    }
  }

  function logout() {
    setToken("");
    setClaims(null);
    setDemandes([]);
    setServices([]);
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
        : "Proposez vos services et gérez les missions entrantes."

    return (
      <section className="panel auth-panel">
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="ghost" onClick={() => navigate("/")}>Back</button>
        </div>

        <div className="two-col">
          <form className="card stack" onSubmit={(event) => void handleLogin(event, roleForPage)}>
            <h3>Login</h3>
            <label>
              <span>Phone</span>
              <input type="text" name="phone" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" required />
            </label>
            <button type="submit" disabled={loginPending}>
              {loginPending ? "Signing in..." : "Login"}
            </button>
          </form>

          <form className="card stack" onSubmit={(event) => void handleRegister(event, roleForPage)}>
            <h3>Create {roleForPage} account</h3>
            <label>
              <span>Full name</span>
              <input type="text" name="full_name" required />
            </label>
            <label>
              <span>Phone</span>
              <input type="text" name="phone" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" minLength={8} required />
            </label>
            <button type="submit" disabled={registerPending}>
              {registerPending ? "Creating..." : "Register"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  function renderClientWorkspace(): JSX.Element {
    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div>
            <h2>Espace Client</h2>
            <p>Gérez vos demandes et consultez les services disponibles. ID utilisateur : <strong>{userId}</strong>.</p>
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
            <span>My requests</span>
            <strong>{demandes.length}</strong>
          </article>
          <article className="metric-card">
            <span>Available services</span>
            <strong>{services.length}</strong>
          </article>
          <article className="metric-card wide">
            <span>Workspace</span>
            <strong>Client</strong>
          </article>
        </div>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>My requests</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {demandes.length === 0 ? <li>No requests yet.</li> : null}
              {demandes.map((demande) => (
                <li key={demande.id}>
                  <strong>#{demande.id}</strong> [{demande.status}] {demande.location} - {demande.description}
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack">
            <div className="section-head">
              <h3>Provider catalog</h3>
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

        <div className="two-col">
          <form className="card stack" onSubmit={handleCreateDemande}>
            <h3>Create request</h3>
            <label>
              <span>Description</span>
              <textarea name="description" required />
            </label>
            <label>
              <span>Location</span>
              <input type="text" name="location" required />
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

    return (
      <section className="panel dashboard-panel">
        <div className="dashboard-title">
          <div>
            <h2>Espace Prestataire</h2>
            <p>Gérez vos services et suivez les demandes du marché. ID utilisateur : <strong>{userId}</strong>.</p>
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
            <span>Open requests</span>
            <strong>{demandes.length}</strong>
          </article>
          <article className="metric-card">
            <span>My services</span>
            <strong>{ownServices.length}</strong>
          </article>
          <article className="metric-card wide">
            <span>Workspace</span>
            <strong>Prestataire</strong>
          </article>
        </div>

        <div className="two-col">
          <section className="card stack">
            <div className="section-head">
              <h3>Open requests feed</h3>
              <span>{dashboardPending ? "Loading..." : "Synced"}</span>
            </div>
            <ul className="list clean-list">
              {demandes.length === 0 ? <li>No requests yet.</li> : null}
              {demandes.map((demande) => (
                <li key={demande.id}>
                  <strong>#{demande.id}</strong> [{demande.status}] {demande.location} - {demande.description}
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
          <form className="card stack" onSubmit={handleCreateService}>
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
                  <strong>#{demande.id}</strong> [{demande.status}] {demande.location} - {demande.description}
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
