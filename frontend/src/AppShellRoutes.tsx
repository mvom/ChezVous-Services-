import type { FormEvent, JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminWorkspace from "./features/admin/AdminWorkspaceContainer";
import PublicAuth from "./features/auth/PublicAuth";
import ClientWorkspace from "./features/client/ClientWorkspaceContainer";
import PrestataireWorkspace from "./features/prestataire/PrestataireWorkspaceContainer";
import type { Role } from "./types";

type AppShellRoutesProps = {
  isLoggedIn: boolean;
  role: Role | undefined;
  hiddenAdminPath: string;
  loginPending: boolean;
  roleHomePath: (role?: Role) => string;
  handleClientAuthAccessClick: () => void;
  handlePrestataireAuthAccessClick: () => void;
  handleAdminLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AppShellRoutes({
  isLoggedIn,
  role,
  hiddenAdminPath,
  loginPending,
  roleHomePath,
  handleClientAuthAccessClick,
  handlePrestataireAuthAccessClick,
  handleAdminLoginSubmit,
}: AppShellRoutesProps): JSX.Element {
  return (
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
                  <button type="button" onClick={handleClientAuthAccessClick}>Accès client</button>
                </article>

                <article className="card stack role-card">
                  <span className="role-icon">🛠️</span>
                  <h3>Prestataire</h3>
                  <p>Proposez vos services, recevez des missions et développez votre activité.</p>
                  <button type="button" onClick={handlePrestataireAuthAccessClick}>Accès prestataire</button>
                </article>
              </div>
              <p className="subtle-note">Seuls les profils publics sont accessibles depuis cette page.</p>
            </section>
          )
        }
      />

      <Route path="/auth/client" element={isLoggedIn ? <Navigate to={roleHomePath(role)} replace /> : <PublicAuth roleForPage="client" />} />
      <Route path="/auth/prestataire" element={isLoggedIn ? <Navigate to={roleHomePath(role)} replace /> : <PublicAuth roleForPage="prestataire" />} />

      <Route
        path={hiddenAdminPath}
        element={
          !isLoggedIn ? (
            <section className="panel auth-panel">
              <div className="panel-heading">
                <div>
                  <h2>Accès Admin Sécurisé</h2>
                  <p>Accès restreint - non visible des utilisateurs publics.</p>
                </div>
                <span className="status-pill">restricted</span>
              </div>
              <form className="card stack" onSubmit={handleAdminLoginSubmit}>
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
            <AdminWorkspace />
          )
        }
      />

      <Route
        path="/espace/client"
        element={!isLoggedIn ? <Navigate to="/auth/client" replace /> : role !== "client" ? <Navigate to={roleHomePath(role)} replace /> : <ClientWorkspace />}
      />

      <Route
        path="/espace/prestataire"
        element={
          !isLoggedIn ? <Navigate to="/auth/prestataire" replace /> : role !== "prestataire" ? <Navigate to={roleHomePath(role)} replace /> : <PrestataireWorkspace />
        }
      />

      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/dashboard" element={<Navigate to={isLoggedIn ? roleHomePath(role) : "/"} replace />} />
      <Route path="*" element={<Navigate to={isLoggedIn ? roleHomePath(role) : "/"} replace />} />
    </Routes>
  );
}
