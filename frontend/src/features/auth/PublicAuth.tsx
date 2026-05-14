// ── Public Auth ───────────────────────────────────────────────────────────────
// Previously: renderPublicAuth() inside AppShell

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppCtx } from "../../AppContext";
import type { Role } from "../../types";
import { formatCameroonPhone, normalizePersonName } from "../../utils";

interface Props {
  roleForPage: Extract<Role, "client" | "prestataire">;
}

export default function PublicAuth({ roleForPage }: Props): React.JSX.Element {
  const navigate = useNavigate();
  const ctx = useAppCtx();
  const {
    handleLogin, handleRegister, loginPending, registerPending,
    authModeByRole, setAuthModeByRole,
    registerAvatarInputRef, handleRegisterAvatarSelected,
  } = ctx;

  const title = roleForPage === "client" ? "Espace Client" : "Espace Prestataire";
  const subtitle =
    roleForPage === "client"
      ? "Créez des demandes et suivez vos missions à domicile."
      : "Proposez vos services et gérez les missions entrantes.";
  const authMode = authModeByRole[roleForPage];

  function handlePersonNameBlur(event: React.FocusEvent<HTMLInputElement>): void {
    event.currentTarget.value = normalizePersonName(event.currentTarget.value);
  }

  function handlePhoneBlur(event: React.FocusEvent<HTMLInputElement>): void {
    event.currentTarget.value = formatCameroonPhone(event.currentTarget.value);
  }

  return (
    <section className="panel auth-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="ghost" onClick={() => navigate("/")}>Retour</button>
      </div>

      <div className="auth-switch-banner">
        {authMode === "register" ? (
          <p>
            Deja inscrit ?
            <button type="button" className="text-btn" onClick={() => setAuthModeByRole((prev) => ({ ...prev, [roleForPage]: "login" }))}>
              Connectez-vous
            </button>
          </p>
        ) : (
          <p>
            Pas encore inscrit ?
            <button type="button" className="text-btn" onClick={() => setAuthModeByRole((prev) => ({ ...prev, [roleForPage]: "register" }))}>
              Creez votre compte
            </button>
          </p>
        )}
      </div>

      {authMode === "login" ? (
        <form className="card stack auth-single-card" onSubmit={(e) => void handleLogin(e, roleForPage)}>
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
        <form className="card stack auth-single-card" onSubmit={(e) => void handleRegister(e, roleForPage)}>
          <h3>Inscription {roleForPage}</h3>
          <label>
            <span>Prenom</span>
            <input type="text" name="first_name" onBlur={handlePersonNameBlur} required />
          </label>
          <label>
            <span>Nom</span>
            <input type="text" name="last_name" onBlur={handlePersonNameBlur} required />
          </label>
          <label>
            <span>Username</span>
            <input type="text" name="username" placeholder="ex: qa.flow.77745442" minLength={3} required />
            <small className="helper-line">Exemple : qa.flow.77745442 (lettres minuscules, chiffres, point ou underscore)</small>
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
              placeholder="+2376 XX XXX XXX"
              pattern="\+2376\s\d{2}\s\d{3}\s\d{3}"
              onBlur={handlePhoneBlur}
              required
            />
            <small className="helper-line">Format automatique : +2376 XX XXX XXX</small>
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
            <input ref={registerAvatarInputRef as React.RefObject<HTMLInputElement>} type="file" name="avatar" accept="image/*" onChange={(e) => void handleRegisterAvatarSelected(e)} />
          </label>
          <button type="submit" disabled={registerPending}>
            {registerPending ? "Création..." : "S'inscrire"}
          </button>
        </form>
      )}
    </section>
  );
}
