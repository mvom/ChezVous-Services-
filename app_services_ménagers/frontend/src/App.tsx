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
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

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
      navigate("/login", { replace: true });
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
      navigate("/dashboard", { replace: true });
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
      setToken(result.access_token);
      setToast({ kind: "ok", message: "Login successful" });
      event.currentTarget.reset();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Login failed" });
    } finally {
      setLoginPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
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
          role: String(formData.get("role") || "client"),
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
  const canCreateDemande = role === "client" || role === "admin";
  const canCreateService = role === "prestataire" || role === "admin";
  const isLoggedIn = Boolean(token && claims);

  return (
    <div className="app-shell">
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />
      <header className="app-header">
        <span className="eyebrow">Phase 1</span>
        <h1>Services Menagers</h1>
        <p>React + TypeScript frontend connected to the FastAPI backend.</p>
      </header>

      <main className="layout">
        <Routes>
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <section className="panel auth-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Authentication</h2>
                      <p>Use the existing API roles to enter the platform.</p>
                    </div>
                    <span className="status-pill">FastAPI live</span>
                  </div>
                  <div className="two-col">
                    <form className="card stack" onSubmit={handleLogin}>
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

                    <form className="card stack" onSubmit={handleRegister}>
                      <h3>Create account</h3>
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
                      <label>
                        <span>Role</span>
                        <select name="role" defaultValue="client" required>
                          <option value="client">Client</option>
                          <option value="prestataire">Provider</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                      <button type="submit" disabled={registerPending}>
                        {registerPending ? "Creating..." : "Register"}
                      </button>
                    </form>
                  </div>
                </section>
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              !isLoggedIn ? (
                <Navigate to="/login" replace />
              ) : (
                <section className="panel dashboard-panel">
                  <div className="dashboard-title">
                    <div>
                      <h2>Operational dashboard</h2>
                      <p>Connected as role <strong>{role}</strong> with user id <strong>{currentUserId()}</strong>.</p>
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
                      <span>Requests</span>
                      <strong>{demandes.length}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Services</span>
                      <strong>{services.length}</strong>
                    </article>
                    <article className="metric-card wide">
                      <span>API Base</span>
                      <strong>{API_BASE}</strong>
                    </article>
                  </div>

                  <div className="two-col">
                    <section className="card stack">
                      <div className="section-head">
                        <h3>Requests</h3>
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
                        <h3>Services</h3>
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
                    {canCreateDemande ? (
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
                    ) : (
                      <section className="card stack muted-card">
                        <h3>Requests</h3>
                        <p>This role cannot create requests.</p>
                      </section>
                    )}

                    {canCreateService ? (
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
                    ) : (
                      <section className="card stack muted-card">
                        <h3>Services</h3>
                        <p>This role cannot create services.</p>
                      </section>
                    )}
                  </div>
                </section>
              )
            }
          />
          <Route path="*" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </main>

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
  );
}

export default function App(): JSX.Element {
  return <AppShell />;
}
