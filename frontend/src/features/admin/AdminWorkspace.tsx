// ── Admin Workspace ───────────────────────────────────────────────────────────
// Previously: renderAdminWorkspace() inside AppShell

import React, { useRef } from "react";
import CustomSelect from "../../CustomSelect";
import type { DemandeCategory, Role } from "../../types";
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

/**
 * Determine user status: "client" | "prestataire" | "client/prestataire"
 */
function getUserStatus(user: { role: string }, hasPrestataire: boolean): string {
  if (user.role === "prestataire" && hasPrestataire) return "prestataire";
  if (user.role === "client" && hasPrestataire) return "client/prestataire";
  return user.role === "prestataire" ? "prestataire" : "client";
}

const ALL_DEMANDE_CATEGORIES: DemandeCategory[] = [
  "menage",
  "plomberie",
  "electricite",
  "mecanique_auto",
  "soudure",
  "evenementiel",
  "reparation_electronique",
  "climatisation",
];

type AdminDashboardViewModel = ReturnType<typeof useAdminDashboardViewModel>;

export default function AdminWorkspace({ vm }: { vm: AdminDashboardViewModel }): React.JSX.Element {
  const unifiedUsersRef = useRef<HTMLDivElement>(null);

  const ctx = vm;
  const {
    demandes, missions, services, users, prestataires, userId,
    claims, token, dashboardPending, refreshDashboard,
    adminAtRisk,
    adminRoleDraftByUserId, setAdminRoleDraftByUserId,
    adminActionUserId, adminActionKind,
    adminUserRoleFilter, setAdminUserRoleFilter,
    adminUserQuery, setAdminUserQuery,
    adminDemandeQuery, setAdminDemandeQuery,
    adminMissionStatusFilter, setAdminMissionStatusFilter,
    adminMissionCategoryFilter, setAdminMissionCategoryFilter,
    adminMissionQuery, setAdminMissionQuery,
    selectedMissionId, setSelectedMissionId,
    handleTogglePrestataireVerified, handleAdminChangeUserRole, handleAdminDeleteUser,
    logout,
    demandeLabel, missionLabelById, demandeLabelById,
  } = ctx;

  const providerUsers = users.filter((u) => u.role === "prestataire");
  const managedUsers = users.slice().sort(compareUsersByRoleAndId);
  const providerRows = providerUsers.map((u) => ({ user: u, provider: prestataires.find((p) => p.user_id === u.id) || null }));

  // Create unified user list with status and provider info
  const unifiedUsers = managedUsers.map((user) => {
    const prestataire = prestataires.find((p) => p.user_id === user.id);
    const status = getUserStatus(user, !!prestataire);
    return { user, prestataire: prestataire || null, status };
  });

  const userRoleFilter = adminUserRoleFilter || "all";
  const userQuery = adminUserQuery || "";
  const demandeQuery = adminDemandeQuery || "";
  const missionStatusFilter = adminMissionStatusFilter || "all";
  const missionCategoryFilter = adminMissionCategoryFilter || "all";
  const missionQuery = adminMissionQuery || "";
  const expandedMissionId = selectedMissionId || null;
  const demandeById = new Map(demandes.map((d) => [d.id, d]));
  const openDemandes = demandes.filter((d) => d.status === "ouverte").length;
  const activeMissionsAdmin = missions.filter((m) => m.status === "en_cours").length;
  const verifiedProviders = providerRows.filter((row) => row.provider?.verified).length;
  const pendingVerification = providerRows.length - verifiedProviders;
  const atRiskAdminMissions = adminAtRisk?.missions ?? [];
  const availableMissionCategories = ALL_DEMANDE_CATEGORIES;

  // Count users by status
  const clientsCount = unifiedUsers.filter((u) => u.status === "client").length;
  const prestatairesCount = unifiedUsers.filter((u) => u.status === "prestataire").length;
  const dualCount = unifiedUsers.filter((u) => u.status === "client/prestataire").length;

  const loweredUserQuery = userQuery.trim().toLowerCase();
  const loweredDemandeQuery = demandeQuery.trim().toLowerCase();
  const loweredMissionQuery = missionQuery.trim().toLowerCase();

  const filteredDemandes = demandes.filter((demande) => {
    if (!loweredDemandeQuery) return true;
    return (
      demandeLabel(demande).toLowerCase().includes(loweredDemandeQuery) ||
      demande.description.toLowerCase().includes(loweredDemandeQuery) ||
      demandeGeoLabel(demande).toLowerCase().includes(loweredDemandeQuery)
    );
  });

  const filteredUnifiedUsers = unifiedUsers.filter((row) => {
    const statusOk =
      userRoleFilter === "all" ||
      (userRoleFilter === "client" && (row.status === "client" || row.status === "client/prestataire")) ||
      (userRoleFilter === "prestataire" && (row.status === "prestataire" || row.status === "client/prestataire")) ||
      row.user.role === userRoleFilter;
    if (!statusOk) return false;
    if (!loweredUserQuery) return true;
    return (
      `${row.user.first_name} ${row.user.last_name}`.toLowerCase().includes(loweredUserQuery) ||
      row.user.username.toLowerCase().includes(loweredUserQuery) ||
      row.user.email.toLowerCase().includes(loweredUserQuery) ||
      formatCameroonPhone(row.user.phone).toLowerCase().includes(loweredUserQuery)
    );
  });

  const filteredMissions = missions.filter((mission) => {
    const statusOk = missionStatusFilter === "all" || mission.status === missionStatusFilter;
    if (!statusOk) return false;
    const linkedDemande = demandeById.get(mission.demande_id);
    const categoryOk = missionCategoryFilter === "all" || linkedDemande?.category === missionCategoryFilter;
    if (!categoryOk) return false;
    if (!loweredMissionQuery) return true;
    return (
      missionLabelById(mission.id).toLowerCase().includes(loweredMissionQuery) ||
      demandeLabelById(mission.demande_id).toLowerCase().includes(loweredMissionQuery) ||
      String(mission.id).includes(loweredMissionQuery) ||
      String(mission.demande_id).includes(loweredMissionQuery)
    );
  });

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
          <button type="button" onClick={() => void refreshDashboard(claims!)} disabled={dashboardPending}>
            {dashboardPending ? "Actualisation..." : "Actualiser le tableau"}
          </button>
          <button type="button" className="ghost" onClick={() => unifiedUsersRef.current?.scrollIntoView({ behavior: "smooth" })}>
            Vérifications prestataires
          </button>
        </div>
      </section>

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
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : clientsCount}</strong>
            <span>Clients</span>
          </div>
          <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : prestatairesCount}</strong>
            <span>Prestataires</span>
          </div>
          <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : dualCount}</strong>
            <span>Client/Prestataire</span>
          </div>
          <div className={`today-overview-item ${dashboardPending ? "skeleton-card" : ""}`}>
            <strong>{dashboardPending ? <span className="skeleton-line skeleton-line--md" /> : pendingVerification}</strong>
            <span>A certifier</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="section-head">
          <h3>Missions globales</h3>
          <span>{dashboardPending ? "Mise à jour..." : `${filteredMissions.length} mission(s)`}</span>
        </div>
        <div className="filter-row">
          <CustomSelect
            value={missionStatusFilter}
            onChange={(v) => setAdminMissionStatusFilter(v as "all" | "attribuee" | "en_cours" | "terminee" | "annulee")}
            options={[
              { value: "all", label: "Tous les statuts" },
              { value: "attribuee", label: "Attribuée" },
              { value: "en_cours", label: "En cours" },
              { value: "terminee", label: "Terminée" },
              { value: "annulee", label: "Annulée" },
            ]}
          />
          <CustomSelect
            value={missionCategoryFilter}
            onChange={(v) => setAdminMissionCategoryFilter(v as DemandeCategory | "all")}
            options={[
              { value: "all", label: "Tous les domaines" },
              ...availableMissionCategories.map((c) => ({ value: c, label: demandeCategoryLabel(c) })),
            ]}
          />
          <input
            type="text"
            value={missionQuery}
            onChange={(event) => setAdminMissionQuery(event.target.value)}
            placeholder="Recherche mission (code mission / demande)"
          />
        </div>
        <ul className="list clean-list">
          {!dashboardPending && filteredMissions.length === 0 ? <li>Aucune mission pour ce filtre.</li> : null}
          {!dashboardPending && filteredMissions.map((mission) => {
            const expanded = expandedMissionId === mission.id;
            const linkedDemande = demandeById.get(mission.demande_id);
            return (
              <li key={`admin-mission-${mission.id}`}>
                <div className="status-line blue">
                  <span className="status-dot" />
                  <strong>{missionLabelById(mission.id)}</strong>
                  <span className="status-chip">{mission.status}</span>
                  {linkedDemande?.category ? <span className="status-chip">{demandeCategoryLabel(linkedDemande.category)}</span> : null}
                </div>
                <div className="demande-actions-row">
                  <button
                    type="button"
                    className="ghost inline-ghost"
                    onClick={() => setSelectedMissionId(expanded ? null : mission.id)}
                    title="Voir les détails"
                  >
                    {expanded ? "🔽" : "🔍"}
                  </button>
                </div>
                <div className="timeline-line">{demandeLabelById(mission.demande_id)}</div>
                {expanded ? (
                  <div className="timeline-line">
                    Client #{mission.client_id} — Prestataire #{mission.prestataire_id}
                    {mission.scheduled_at ? ` — Prévue le ${formatDateTime(mission.scheduled_at)}` : ""}
                    {linkedDemande ? ` — ${demandeGeoLabel(linkedDemande)}` : ""}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack" ref={unifiedUsersRef}>
        <div className="section-head">
          <h3>Utilisateurs & Prestataires</h3>
          <span>{dashboardPending ? "Mise à jour..." : `${filteredUnifiedUsers.length} comptes`}</span>
        </div>
        <div className="filter-row">
          <CustomSelect
            value={userRoleFilter}
            onChange={(v) => setAdminUserRoleFilter(v as Role | "all")}
            options={[
              { value: "all", label: "Tous les rôles" },
              { value: "client", label: "Clients" },
              { value: "prestataire", label: "Prestataires" },
              { value: "admin", label: "Admins" },
            ]}
          />
          <input
            type="text"
            value={userQuery}
            onChange={(event) => setAdminUserQuery(event.target.value)}
            placeholder="Recherche rapide (nom, username, email, téléphone)"
          />
        </div>
        <ul className="list clean-list">
          {dashboardPending ? <SkeletonList prefix="admin-unified-users" /> : null}
          {!dashboardPending && filteredUnifiedUsers.length === 0 ? <li>Aucun compte utilisateur pour ce filtre.</li> : null}
          {!dashboardPending && filteredUnifiedUsers.map(({ user, prestataire, status }) => {
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
                  <div className="timeline-line">
                    <span className="status-chip">{status}</span>
                    {prestataire && (
                      <span className={prestataire.verified ? "trust-badge trust-badge--verified" : "trust-badge"}>
                        {prestataire.verified ? "Certifié" : "À certifier"}
                      </span>
                    )}
                  </div>
                  <div id={roleStatusId} className="timeline-line">Rôle: {user.role}</div>
                </div>
                <div className="admin-provider-actions admin-account-actions">
                  {prestataire && (
                    <button type="button" className="ghost inline-ghost" onClick={() => void handleTogglePrestataireVerified(user.id, !prestataire.verified)}>
                      {prestataire.verified ? "Retirer cert." : "Certifier"}
                    </button>
                  )}
                  <label className="admin-role-picker">
                    <span id={roleHelpId} className="helper-line">Nouveau rôle</span>
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
                    {isPendingRow && adminActionKind === "role" ? "Mise à jour..." : "Appliquer"}
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
                  {isSelf ? <span id={selfProtectedId} className="helper-line">Compte protégé</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
