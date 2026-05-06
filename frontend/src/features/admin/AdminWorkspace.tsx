// ── Admin Workspace ───────────────────────────────────────────────────────────
// Previously: renderAdminWorkspace() inside AppShell

import React from "react";
import CustomSelect from "../../CustomSelect";
import type { Role } from "../../types";
import type { useAdminDashboardViewModel } from "./useAdminDashboardViewModel";
import {
  demandeCategoryLabel,
  demandeGeoLabel,
  formatCameroonPhone,
  formatDateTime,
  formatServicePrice,
} from "../../utils";

function SkeletonList({ prefix, count = 3 }: { prefix: string; count?: number }) {
  const items: React.JSX.Element[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push(
      <li key={`${prefix}-${i}`} className="skeleton-item">
        <div className="skeleton-line skeleton-line--lg" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--sm" />
      </li>,
    );
  }

  return (
    <>{items}</>
  );
}

function compareUsersByRoleAndId(a: { role: string; id: number }, b: { role: string; id: number }): number {
  return a.role.localeCompare(b.role) || a.id - b.id;
}

type AdminDashboardViewModel = ReturnType<typeof useAdminDashboardViewModel>;

export default function AdminWorkspace({ vm }: { vm: AdminDashboardViewModel }): React.JSX.Element {
  const ctx = vm;
  const {
    demandes, missions, services, users, prestataires, userId,
    claims, token, dashboardPending, refreshDashboard,
    adminAtRisk,
    adminRoleDraftByUserId, setAdminRoleDraftByUserId,
    adminActionUserId, adminActionKind,
    handleTogglePrestataireVerified, handleAdminChangeUserRole, handleAdminDeleteUser,
    logout,
    demandeLabel, missionLabelById, demandeLabelById,
  } = ctx;

  const providerUsers = users.filter((u) => u.role === "prestataire");
  const managedUsers = users.slice().sort(compareUsersByRoleAndId);
  const providerRows = providerUsers.map((u) => ({ user: u, provider: prestataires.find((p) => p.user_id === u.id) || null }));
  const openDemandes = demandes.filter((d) => d.status === "ouverte").length;
  const activeMissionsAdmin = missions.filter((m) => m.status === "en_cours").length;
  const verifiedProviders = providerRows.filter((row) => row.provider?.verified).length;
  const pendingVerification = providerRows.length - verifiedProviders;
  const atRiskAdminMissions = adminAtRisk?.missions ?? [];

  function handleApplyUserRoleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    const nextRole = event.currentTarget.dataset.role as Role;
    const nextUserId = Number(event.currentTarget.dataset.userId);
    const user = users.find((candidate) => candidate.id === nextUserId);
    if (!user) return;
    void handleAdminChangeUserRole(user, nextRole);
  }

  function handleDeleteUserClick(event: React.MouseEvent<HTMLButtonElement>): void {
    const nextUserId = Number(event.currentTarget.dataset.userId);
    const user = users.find((candidate) => candidate.id === nextUserId);
    if (!user) return;
    void handleAdminDeleteUser(user);
  }

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
            Se déconnecter
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
            <span>{atRiskAdminMissions.length} mission(s) détectée(s)</span>
          </div>
          <ul className="risk-banner__list">
            {atRiskAdminMissions.slice(0, 6).map((item) => (
              <li key={item.mission_id} className="risk-banner__item">
                <strong>{missionLabelById(item.mission_id)}</strong>
                <span>{demandeLabelById(item.demande_id)}</span>
                <span>Prestataire #{item.prestataire_id}</span>
                <span>Echeance: {formatDateTime(item.scheduled_at || undefined)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="quick-actions">
        <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>Actualiser</button>
        <button type="button" className="ghost" onClick={logout}>Se déconnecter</button>
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
          <span>{dashboardPending ? "Mise à jour..." : "À surveiller"}</span>
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
            <h3>Vue d'ensemble des demandes</h3>
            <span>{dashboardPending ? "Chargement..." : "À jour"}</span>
          </div>
          <ul className="list clean-list">
            {dashboardPending ? <SkeletonList prefix="admin-demandes" /> : null}
            {!dashboardPending && demandes.length === 0 ? <li>Aucune demande pour le moment.</li> : null}
            {!dashboardPending && demandes.map((demande) => (
              <li key={demande.id}>
                <strong>{demandeLabel(demande)}</strong> [{demande.status}] [{demandeCategoryLabel(demande.category)}] {demandeGeoLabel(demande)} - {demande.description}
              </li>
            ))}
          </ul>
        </section>

        <section className="card stack">
          <div className="section-head">
            <h3>Vue d'ensemble des services</h3>
            <span>{dashboardPending ? "Chargement..." : "À jour"}</span>
          </div>
          <ul className="list clean-list">
            {dashboardPending ? <SkeletonList prefix="admin-services" /> : null}
            {!dashboardPending && services.length === 0 ? <li>Aucun service pour le moment.</li> : null}
            {!dashboardPending && services.map((service) => (
              <li key={service.id}>
                <strong>#{service.id}</strong> {service.name} - {formatServicePrice(service.price)} (provider {service.prestataire_id})
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card stack">
        <div className="section-head">
          <h3>Verification prestataires</h3>
          <span>{dashboardPending ? "Mise à jour..." : `${providerRows.length} comptes prestataires`}</span>
        </div>
        <ul className="list clean-list">
          {dashboardPending ? <SkeletonList prefix="admin-verify" /> : null}
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
                <button type="button" className="ghost inline-ghost" onClick={() => void handleTogglePrestataireVerified(user.id, !provider?.verified)}>
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
          <span>{dashboardPending ? "Mise à jour..." : `${managedUsers.length} comptes`}</span>
        </div>
        <ul className="list clean-list">
          {dashboardPending ? <SkeletonList prefix="admin-accounts" /> : null}
          {!dashboardPending && managedUsers.length === 0 ? <li>Aucun compte utilisateur.</li> : null}
          {!dashboardPending && managedUsers.map((user) => {
            const isSelf = user.id === userId;
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
                    <CustomSelect
                      value={draftRole}
                      disabled={isPendingRow}
                      aria-label={`Nouveau role pour ${user.username}`}
                      aria-describedby={`${roleStatusId} ${roleHelpId}`}
                      onChange={(v) => setAdminRoleDraftByUserId((prev) => ({ ...prev, [user.id]: v as Role }))}
                      options={[
                        { value: "client", label: "client" },
                        { value: "prestataire", label: "prestataire" },
                        { value: "admin", label: "admin" },
                      ]}
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost inline-ghost"
                    data-user-id={String(user.id)}
                    data-role={draftRole}
                    disabled={isPendingRow || !roleChanged || isSelf}
                    aria-label={`Appliquer le role ${draftRole} pour ${user.username}`}
                    aria-describedby={roleStatusId}
                    onClick={handleApplyUserRoleClick}
                  >
                    {isPendingRow && adminActionKind === "role" ? "Mise à jour..." : "Appliquer rôle"}
                  </button>
                  <button
                    type="button"
                    className="ghost inline-ghost danger"
                    data-user-id={String(user.id)}
                    disabled={isPendingRow || isSelf}
                    aria-label={`Supprimer le compte ${user.username}`}
                    aria-describedby={isSelf ? `${roleStatusId} ${selfProtectedId}` : roleStatusId}
                    onClick={handleDeleteUserClick}
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
