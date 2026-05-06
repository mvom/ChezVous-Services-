// ── Prestataire Workspace ────────────────────────────────────────────────────
// Previously: renderPrestataireWorkspace() inside AppShell

import React from "react";
import CustomSelect from "../../CustomSelect";
import RoleSwitchActions from "../../RoleSwitchActions";
import type { DemandeCategory, Mission, PipelineCardFilter } from "../../types";
import type { usePrestataireDashboardViewModel } from "./usePrestataireDashboardViewModel";
import {
  badgeLabel,
  cleanGeo,
  clientAvailabilityLabel,
  demandeCategoryLabel,
  demandeGeoLabel,
  demandeStatusLabel,
  demandeStatusTone,
  formatDateTime,
  formatServicePrice,
  missionPipelineStatus,
  priorityClass,
  priorityLabel,
  statusChipClass,
} from "../../utils";

const ALL_CATEGORIES: DemandeCategory[] = [
  "menage", "plomberie", "electricite", "mecanique_auto",
  "soudure", "evenementiel", "reparation_electronique", "climatisation",
];

function SkeletonList({ prefix, count = 3 }: { prefix: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={`${prefix}-${i}`} className="skeleton-item">
          <div className="skeleton-line skeleton-line--lg" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--sm" />
        </li>
      ))}
    </>
  );
}

type PrestataireDashboardViewModel = ReturnType<typeof usePrestataireDashboardViewModel>;

export default function PrestataireWorkspace({ vm }: { vm: PrestataireDashboardViewModel }): React.JSX.Element {
  const ctx = vm;
  const {
    demandes, missions, services, userId, claims, token,
    userProfile, avatarInputRef, avatarUploadPending, handleAvatarChange,
    role, dashboardPending, refreshDashboard,
    userBadges,
    prestataireStatusFilter, setPrestataireStatusFilter,
    prestataireCategoryFilter, setPrestataireCategoryFilter,
    prestataireVilleFilter, setPrestataireVilleFilter,
    prestataireArrondissementFilter, setPrestataireArrondissementFilter,
    prestataireQuartierFilter, setPrestataireQuartierFilter,
    pipelineVisibleCount, setPipelineVisibleCount,
    pipelineCardFilter, setPipelineCardFilter,
    pipelineIdQuery, setPipelineIdQuery,
    missionPendingId,
    prestataireCreateServiceRef,
    visibilityMode, visibilityPending, handleVisibilityChange,
    zonePrefVille, setZonePrefVille,
    zonePrefArrondissement, setZonePrefArrondissement,
    zonePrefQuartier, setZonePrefQuartier,
    zonePrefPending, handleZonePreferenceChange,
    zoneNotifications, notifsPanelOpen, setNotifsPanelOpen, handleMarkAllNotifsRead,
    handleCreateService, handleUpdateMissionStatus,
    handleUnregister, logout,
    openDemandDetailModal,
    demandeLabel, missionLabel, demandeLabelById,
    switchableRoles, canSwitchRole, switchRolePending, addRolePending, handleSwitchRole, handleAddRole,
  } = ctx;

  const ownServices = services.filter((s) => s.prestataire_id === userId);
  const providerMissions = missions.filter((m) => m.prestataire_id === userId);
  const completedProviderMissions = providerMissions.filter((m) => m.status === "terminee").length;
  const myTrust = providerMissions.find((m) => m.prestataire_summary != null)?.prestataire_summary?.trust ?? null;
  const noteClient = myTrust?.rating ?? null;
  const tauxAcceptation =
    providerMissions.length > 0 ? Math.round((completedProviderMissions / providerMissions.length) * 100) : null;
  const nowDate = new Date();
  const revenusMonth = providerMissions
    .filter((m) => {
      const d = new Date(m.updated_at);
      return m.status === "terminee" && d.getMonth() === nowDate.getMonth() && d.getFullYear() === nowDate.getFullYear();
    })
    .reduce((sum, m) => {
      const svc = ownServices.find((s) => s.id === m.service_id);
      return sum + (svc?.price ?? 0);
    }, 0);
  const perfScore =
    tauxAcceptation !== null && noteClient !== null
      ? Math.round(tauxAcceptation * 0.5 + (noteClient / 5) * 100 * 0.5)
      : tauxAcceptation ?? (noteClient !== null ? Math.round((noteClient / 5) * 100) : null);

  const allVilles = Array.from(new Set(demandes.map((d) => cleanGeo(d.ville)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const demandesByVille =
    prestataireVilleFilter === "all" ? demandes : demandes.filter((d) => cleanGeo(d.ville) === prestataireVilleFilter);
  const allArrondissements = Array.from(new Set(demandesByVille.map((d) => cleanGeo(d.arrondissement)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const demandesByArrondissement =
    prestataireArrondissementFilter === "all"
      ? demandesByVille
      : demandesByVille.filter((d) => cleanGeo(d.arrondissement) === prestataireArrondissementFilter);
  const allQuartiers = Array.from(new Set(demandesByArrondissement.map((d) => cleanGeo(d.quartier)).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const matchingDemandes = demandes.filter((d) => {
    const matchesStatus = prestataireStatusFilter === "all" || d.status === prestataireStatusFilter;
    const matchesCategory = prestataireCategoryFilter === "all" || (d.category || "menage") === prestataireCategoryFilter;
    const matchesVille = prestataireVilleFilter === "all" || cleanGeo(d.ville) === prestataireVilleFilter;
    const matchesArrondissement =
      prestataireArrondissementFilter === "all" || cleanGeo(d.arrondissement) === prestataireArrondissementFilter;
    const matchesQuartier = prestataireQuartierFilter === "all" || cleanGeo(d.quartier) === prestataireQuartierFilter;
    return matchesStatus && matchesCategory && matchesVille && matchesArrondissement && matchesQuartier;
  });

  const topOpportunities = matchingDemandes.slice(0, 3);
  const newOpportunities = matchingDemandes.filter((d) => d.status === "ouverte");
  const confirmMissions = providerMissions.filter((m) => missionPipelineStatus(m.status) === "pending");
  const activeMissionsCol = providerMissions.filter((m) => missionPipelineStatus(m.status) === "active");
  const closingMissions = providerMissions.filter((m) => missionPipelineStatus(m.status) === "done");
  const demandeById = new Map(demandes.map((d) => [d.id, d]));
  const idQuery = pipelineIdQuery.trim().toLowerCase().replace(/^#/, "");

  const matchesOpportunityId = (d: typeof demandes[0]) => {
    if (!idQuery) return true;
    return String(d.id).includes(idQuery) || demandeLabel(d).toLowerCase().includes(idQuery);
  };
  const matchesMissionOrDemandeId = (m: Mission) => {
    if (!idQuery) return true;
    return (
      String(m.id).includes(idQuery) ||
      String(m.demande_id).includes(idQuery) ||
      missionLabel(m).toLowerCase().includes(idQuery) ||
      demandeLabelById(m.demande_id).toLowerCase().includes(idQuery)
    );
  };
  const keepOpportunity = (d: typeof demandes[0]) => {
    if (!matchesOpportunityId(d)) return false;
    if (pipelineCardFilter === "all") return true;
    if (pipelineCardFilter === "urgent") return d.priority === "haute";
    return false;
  };
  const keepMission = (m: Mission) => {
    if (!matchesMissionOrDemandeId(m)) return false;
    if (pipelineCardFilter === "all") return true;
    if (pipelineCardFilter === "scheduled") return m.scheduled_at != null;
    if (pipelineCardFilter === "urgent") {
      const linked = demandeById.get(m.demande_id);
      return linked?.priority === "haute";
    }
    return true;
  };

  const shownOpportunities = newOpportunities.filter(keepOpportunity).slice(0, pipelineVisibleCount);
  const shownConfirmMissions = confirmMissions.filter(keepMission).slice(0, pipelineVisibleCount);
  const shownActiveMissions = activeMissionsCol.filter(keepMission).slice(0, pipelineVisibleCount);
  const shownClosingMissions = closingMissions.filter(keepMission).slice(0, pipelineVisibleCount);
  const pipelineCardCount =
    shownOpportunities.length + shownConfirmMissions.length + shownActiveMissions.length + shownClosingMissions.length;

  function handleZonePrefSubmit(event: React.FormEvent<HTMLFormElement>): void {
    void handleZonePreferenceChange(event);
  }

  function handleZonePrefVilleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setZonePrefVille(event.target.value);
  }

  function handleZonePrefArrondissementChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setZonePrefArrondissement(event.target.value);
  }

  function handleZonePrefQuartierChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setZonePrefQuartier(event.target.value);
  }

  function handleZonePrefClear(): void {
    setZonePrefVille("");
    setZonePrefArrondissement("");
    setZonePrefQuartier("");
  }

  function handleToggleNotifsPanel(): void {
    setNotifsPanelOpen((v) => !v);
  }

  function handleVisibilityOptionClick(event: React.MouseEvent<HTMLButtonElement>): void {
    const mode = event.currentTarget.dataset.mode as "public" | "discret" | "anonyme";
    void handleVisibilityChange(mode);
  }

  function renderVisibilityOption(mode: "public" | "discret" | "anonyme"): React.JSX.Element {
    return (
      <button
        key={mode}
        type="button"
        data-mode={mode}
        className={`visibility-option ${visibilityMode === mode ? "visibility-option--active" : ""}`}
        onClick={handleVisibilityOptionClick}
        disabled={visibilityPending || visibilityMode === mode}
      >
        <span className="visibility-option__icon">
          {mode === "public" ? "🌐" : mode === "discret" ? "🔒" : "👤"}
        </span>
        <span className="visibility-option__label">
          {mode === "public" ? "Public" : mode === "discret" ? "Discret" : "Anonyme"}
        </span>
        <span className="visibility-option__desc">
          {mode === "public" ? "Nom complet visible" : mode === "discret" ? "Prénom + initiale (ex\u00a0: Brice M.)" : "Identité masquée"}
        </span>
      </button>
    );
  }

  const atRiskProviderMissions = providerMissions.filter((m) => {
    if (m.status !== "en_cours" || !m.scheduled_at) return false;
    const scheduledAt = Date.parse(m.scheduled_at);
    if (Number.isNaN(scheduledAt)) return false;
    return scheduledAt <= Date.now() + 2 * 60 * 60 * 1000;
  });

  const recommendation =
    ownServices.length === 0
      ? {
          title: "Publiez votre premier service",
          description: "Un service bien décrit augmente vos chances d'être choisi.",
          cta: "Créer un service",
          onClick: () => prestataireCreateServiceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        }
      : {
          title: "Nouvelles opportunités disponibles",
          description: `${matchingDemandes.length} demande(s) correspond(ent) à votre flux actuel.`,
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
            ref={avatarInputRef as React.RefObject<HTMLInputElement>}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => void handleAvatarChange(e)}
          />
          <div>
            <h2 className="role-space-title">Espace Prestataire</h2>
            <p>Bonjour, <strong>@{userProfile?.username || claims?.username || `#${userId}`}</strong></p>
          </div>
        </div>
        <div className="meta">
          <RoleSwitchActions
            activeRole={role}
            switchableRoles={switchableRoles}
            canSwitchRole={canSwitchRole}
            switchRolePending={switchRolePending}
            addRolePending={addRolePending}
            dashboardPending={dashboardPending}
            addRoleTarget="client"
            onSwitchRole={(item) => void handleSwitchRole(item)}
            onAddRole={(item) => void handleAddRole(item)}
          />
          <button type="button" className="ghost" onClick={() => void refreshDashboard(claims!, token)} disabled={dashboardPending}>
            Actualiser
          </button>
          <button type="button" className="ghost" onClick={() => void handleUnregister()}>
            Désinscription
          </button>
          <button type="button" className="ghost" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </div>

      <section className="card role-hero role-hero--provider">
        <div>
          <h3>Votre cockpit prestataire</h3>
          <p>
            {dashboardPending
              ? "Synchronisation du pipeline et des opportunités..."
              : `${providerMissions.length} mission(s), ${newOpportunities.length} opportunité(s) disponible(s).`}
          </p>
        </div>
        <div className="role-hero__actions">
          <button
            type="button"
            onClick={() => prestataireCreateServiceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            disabled={dashboardPending}
          >
            {dashboardPending ? "Patientez..." : "Créer un service"}
          </button>
          <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("ouverte")} disabled={dashboardPending}>
            Voir opportunités
          </button>
        </div>
      </section>

      <section className="card visibility-card">
        <div className="visibility-card__head">
          <div>
            <h3>Mode de visibilité</h3>
            <p className="helper-line">Contrôle comment votre identité apparaît côté client lors des missions.</p>
          </div>
          <span className={`visibility-badge visibility-badge--${visibilityMode}`}>
            {visibilityMode === "public" ? "🌐 Public" : visibilityMode === "discret" ? "🔒 Discret" : "👤 Anonyme"}
          </span>
        </div>
        <div className="visibility-card__options">
          {(["public", "discret", "anonyme"] as const).map(renderVisibilityOption)}
        </div>
      </section>

      <section className="card zone-pref-card">
        <div className="zone-pref-card__head">
          <div>
            <h3>Zone d'intervention préférée</h3>
            <p className="helper-line">Vous serez notifié dès qu'une demande est publiée dans cette zone.</p>
          </div>
          {(zonePrefVille || zonePrefArrondissement || zonePrefQuartier) && (
            <span className="zone-pref-badge">📍 {[zonePrefVille, zonePrefArrondissement, zonePrefQuartier].filter(Boolean).join(", ")}</span>
          )}
        </div>
        <form className="zone-pref-form" onSubmit={handleZonePrefSubmit}>
          <div className="zone-pref-fields">
            <div className="form-field">
              <label htmlFor="zpVille">Ville</label>
              <input id="zpVille" type="text" placeholder="ex: Douala" value={zonePrefVille} onChange={handleZonePrefVilleChange} disabled={zonePrefPending} />
            </div>
            <div className="form-field">
              <label htmlFor="zpArr">Arrondissement</label>
              <input id="zpArr" type="text" placeholder="ex: Douala 5 (optionnel)" value={zonePrefArrondissement} onChange={handleZonePrefArrondissementChange} disabled={zonePrefPending} />
            </div>
            <div className="form-field">
              <label htmlFor="zpQuartier">Quartier</label>
              <input id="zpQuartier" type="text" placeholder="ex: Makepe (optionnel)" value={zonePrefQuartier} onChange={handleZonePrefQuartierChange} disabled={zonePrefPending} />
            </div>
          </div>
          <div className="zone-pref-actions">
            <button type="submit" disabled={zonePrefPending}>{zonePrefPending ? "Enregistrement..." : "Enregistrer la zone"}</button>
            {(zonePrefVille || zonePrefArrondissement || zonePrefQuartier) && (
              <button type="button" className="ghost" disabled={zonePrefPending} onClick={handleZonePrefClear}>
                Effacer
              </button>
            )}
          </div>
        </form>
      </section>

      {zoneNotifications.length > 0 && (
        <section className="card zone-notifs-card">
          <div className="zone-notifs-card__head">
            <div>
              <h3>
                🔔 Alertes zone
                {zoneNotifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="notif-badge">{zoneNotifications.filter((n) => !n.is_read).length}</span>
                )}
              </h3>
              <p className="helper-line">Nouvelles demandes publiées dans votre zone préférée.</p>
            </div>
            {zoneNotifications.some((n) => !n.is_read) && (
              <button type="button" className="ghost" onClick={() => void handleMarkAllNotifsRead()}>Tout marquer lu</button>
            )}
          </div>
          <ul className="zone-notifs-list">
            {zoneNotifications.slice(0, notifsPanelOpen ? undefined : 5).map((n) => (
              <li key={n.id} className={`zone-notif-item ${n.is_read ? "zone-notif-item--read" : ""}`}>
                <span className="zone-notif-dot" />
                <span className="zone-notif-msg">{n.message}</span>
                <span className="zone-notif-time">{new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
          {zoneNotifications.length > 5 && (
            <button type="button" className="ghost" onClick={handleToggleNotifsPanel}>
              {notifsPanelOpen ? "Voir moins" : `Voir toutes (${zoneNotifications.length})`}
            </button>
          )}
        </section>
      )}

      {atRiskProviderMissions.length > 0 ? (
        <section className="card risk-banner risk-banner--provider">
          <div className="risk-banner__head">
            <h3>At-risk: intervention à surveiller</h3>
            <span>{atRiskProviderMissions.length} mission(s) proche(s) d'échéance</span>
          </div>
          <ul className="risk-banner__list">
            {atRiskProviderMissions.slice(0, 4).map((mission) => (
              <li key={mission.id} className="risk-banner__item">
                <strong>{missionLabel(mission)}</strong>
                <span>{demandeLabelById(mission.demande_id)}</span>
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
        <button type="button" className="ghost" onClick={() => setPrestataireStatusFilter("all")}>Tout le marché</button>
      </div>

      <div className="filter-row provider-filter-row">
        <CustomSelect
          value={prestataireCategoryFilter}
          onChange={(v) => setPrestataireCategoryFilter(v as DemandeCategory | "all")}
          options={[
            { value: "all", label: "Toutes les catégories" },
            ...ALL_CATEGORIES.map((c) => ({ value: c, label: demandeCategoryLabel(c) })),
          ]}
        />
        <CustomSelect
          value={prestataireVilleFilter}
          onChange={(v) => { setPrestataireVilleFilter(v); setPrestataireArrondissementFilter("all"); setPrestataireQuartierFilter("all"); }}
          options={[{ value: "all", label: "Toutes les villes" }, ...allVilles.map((v) => ({ value: v, label: v }))]}
        />
        <CustomSelect
          value={prestataireArrondissementFilter}
          onChange={(v) => { setPrestataireArrondissementFilter(v); setPrestataireQuartierFilter("all"); }}
          options={[{ value: "all", label: "Tous les arrondissements" }, ...allArrondissements.map((v) => ({ value: v, label: v }))]}
        />
        <CustomSelect
          value={prestataireQuartierFilter}
          onChange={(v) => setPrestataireQuartierFilter(v)}
          options={[{ value: "all", label: "Tous les quartiers" }, ...allQuartiers.map((v) => ({ value: v, label: v }))]}
        />
      </div>

      <section className="card perf-kpi-bloc">
        <div className="perf-kpi-head">
          <div>
            <h3>Score de performance</h3>
            <span className="perf-kpi-score-label">Mis à jour en temps réel</span>
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
          {dashboardPending ? <SkeletonList prefix="provider-badges" count={2} /> : null}
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
            <h3>Flux des demandes ouvertes</h3>
            <span>{dashboardPending ? "Chargement..." : "À jour"}</span>
          </div>
          <div className="helper-line">Opportunités prioritaires (3 plus récentes)</div>
          <ul className="list clean-list compact-list">
            {dashboardPending ? <SkeletonList prefix="provider-opportunities" count={2} /> : null}
            {!dashboardPending && topOpportunities.length === 0 ? <li>Aucune opportunite pour ce filtre.</li> : null}
            {!dashboardPending && topOpportunities.map((demande) => (
              <li key={`top-${demande.id}`} onClick={() => openDemandDetailModal(demande)} style={{ cursor: "pointer" }} title="Cliquez pour voir les details">
                <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                  <span className="status-dot" />
                  <strong>{demandeLabel(demande)}</strong>
                  <span className="status-chip">{demandeCategoryLabel(demande.category)}</span>
                  <span className={statusChipClass(demande.status)}>{demandeStatusLabel(demande.status)}</span>
                </div>
                <div>{demandeGeoLabel(demande)} - {demande.description}</div>
                <div className="timeline-line">{clientAvailabilityLabel(demande)}</div>
              </li>
            ))}
          </ul>
          <ul className="list clean-list">
            {dashboardPending ? <SkeletonList prefix="provider-feed" /> : null}
            {!dashboardPending && matchingDemandes.length === 0 ? <li>Aucune demande pour le moment.</li> : null}
            {!dashboardPending && matchingDemandes.map((demande) => (
              <li key={demande.id} onClick={() => openDemandDetailModal(demande)} style={{ cursor: "pointer" }} title="Cliquez pour voir les details">
                <div className={`status-line ${demandeStatusTone(demande.status)}`}>
                  <span className="status-dot" />
                  <strong>{demandeLabel(demande)}</strong>
                  <span className="status-chip">{demandeCategoryLabel(demande.category)}</span>
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
            <h3>Mon catalogue de services</h3>
            <span>{dashboardPending ? "Chargement..." : "À jour"}</span>
          </div>
          <ul className="list clean-list">
            {dashboardPending ? <SkeletonList prefix="provider-services" /> : null}
            {!dashboardPending && ownServices.length === 0 ? <li>Aucun service pour le moment.</li> : null}
            {!dashboardPending && ownServices.map((service) => (
              <li key={service.id}>
                <strong>#{service.id}</strong> {service.name} - {formatServicePrice(service.price)}
                <div className="timeline-line">Disponibilités : {service.availability_slots}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="two-col">
        <form className="card stack" onSubmit={(e) => void handleCreateService(e)} ref={prestataireCreateServiceRef as React.RefObject<HTMLFormElement>}>
          <h3>Créer un service</h3>
          <label>
            <span>Nom</span>
            <input type="text" name="name" required />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description" required />
          </label>
          <label>
            <span>Disponibilité (obligatoire)</span>
            <textarea name="availability_slots" placeholder="Ex: Lun-Ven 08h-17h, Sam 09h-12h" minLength={3} required />
          </label>
          <label>
            <span>Prix (optionnel)</span>
            <input type="number" name="price" min="0" step="1" placeholder="Laissez vide pour: À discuter" />
          </label>
          <button type="submit" disabled={dashboardPending}>{dashboardPending ? "Traitement..." : "Créer un service"}</button>
        </form>

        <section className="card stack muted-card">
          <h3>Préparation aux missions</h3>
          <p>Gardez votre offre claire et votre tarif à jour pour améliorer la mise en relation.</p>
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
            <CustomSelect
              value={String(pipelineVisibleCount)}
              onChange={(v) => setPipelineVisibleCount(Number(v) as 5 | 10)}
              options={[{ value: "5", label: "5 cartes / colonne" }, { value: "10", label: "10 cartes / colonne" }]}
            />
          </label>
          <label>
            <span>Filtre</span>
            <CustomSelect
              value={pipelineCardFilter}
              onChange={(v) => setPipelineCardFilter(v as PipelineCardFilter)}
              options={[
                { value: "all", label: "Toutes les cartes" },
                { value: "urgent", label: "Priorite urgente" },
                { value: "scheduled", label: "Intervention planifiee" },
              ]}
            />
          </label>
          <label>
            <span>Recherche ID</span>
            <input type="text" value={pipelineIdQuery} onChange={(e) => setPipelineIdQuery(e.target.value)} placeholder="SRV-AL-20260502-001 ou DEM-AL-20260502-002" className="pipeline-search-input" />
          </label>
        </div>
        {providerMissions.length === 0 && newOpportunities.length === 0 ? (
          <p className="helper-line">Aucune mission assignée pour le moment. Acceptez une demande pour commencer.</p>
        ) : pipelineCardCount === 0 ? (
          <p className="helper-line">Aucune carte ne correspond au filtre selectionne.</p>
        ) : (
          <div className="pipeline-board">
            <div className="pipeline-col pipeline-col--new">
              <div className="pipeline-col__header">
                <span className="pipeline-col__dot" />
                <strong>Nouvelles opportunités</strong>
                <span className="pipeline-count">{shownOpportunities.length}</span>
              </div>
              {shownOpportunities.map((demande) => (
                <div key={`opp-${demande.id}`} className="pipeline-card pipeline-card--new" onClick={() => openDemandDetailModal(demande)} title="Voir les details">
                  <div className="pipeline-card__title">{demandeLabel(demande)}</div>
                  <div className="pipeline-card__meta">{demandeGeoLabel(demande)}</div>
                  <div className="pipeline-card__meta">{demande.description.slice(0, 55)}{demande.description.length > 55 ? "…" : ""}</div>
                  <span className={priorityClass(demande.priority)}>{priorityLabel(demande.priority)}</span>
                </div>
              ))}
              {shownOpportunities.length === 0 ? <div className="pipeline-empty">Aucune opportunite</div> : null}
            </div>

            <div className="pipeline-col pipeline-col--pending">
              <div className="pipeline-col__header">
                <span className="pipeline-col__dot" />
                <strong>À confirmer</strong>
                <span className="pipeline-count">{shownConfirmMissions.length}</span>
              </div>
              {shownConfirmMissions.map((m) => (
                <div key={m.id} className="pipeline-card">
                  <div className="pipeline-card__title">{missionLabel(m)}</div>
                  <div className="pipeline-card__meta">{demandeLabelById(m.demande_id)}</div>
                  <div className="pipeline-card__meta">Depuis: {formatDateTime(m.created_at)}</div>
                  {m.scheduled_at ? <div className="pipeline-card__eta">📅 {formatDateTime(m.scheduled_at)}</div> : null}
                  <div className="pipeline-card__actions">
                    <button type="button" className="pipeline-btn pipeline-btn--start" disabled={dashboardPending || missionPendingId === m.id} onClick={() => void handleUpdateMissionStatus(m.id, "en_cours")}>
                      {missionPendingId === m.id ? "Traitement..." : "Démarrer"}
                    </button>
                  </div>
                </div>
              ))}
              {shownConfirmMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
            </div>

            <div className="pipeline-col pipeline-col--active">
              <div className="pipeline-col__header">
                <span className="pipeline-col__dot" />
                <strong>En cours</strong>
                <span className="pipeline-count">{shownActiveMissions.length}</span>
              </div>
              {shownActiveMissions.map((m) => (
                <div key={m.id} className="pipeline-card pipeline-card--active">
                  <div className="pipeline-card__title">{missionLabel(m)}</div>
                  <div className="pipeline-card__meta">{demandeLabelById(m.demande_id)}</div>
                  <div className="pipeline-card__meta">Depuis: {formatDateTime(m.updated_at)}</div>
                  {m.scheduled_at ? <div className="pipeline-card__eta">📅 {formatDateTime(m.scheduled_at)}</div> : null}
                  <div className="pipeline-card__actions">
                    <button type="button" className="pipeline-btn pipeline-btn--done" disabled={dashboardPending || missionPendingId === m.id} onClick={() => void handleUpdateMissionStatus(m.id, "terminee")}>
                      {missionPendingId === m.id ? "Traitement..." : "Terminer"}
                    </button>
                  </div>
                </div>
              ))}
              {shownActiveMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
            </div>

            <div className="pipeline-col pipeline-col--closing">
              <div className="pipeline-col__header">
                <span className="pipeline-col__dot" />
                <strong>À clôturer</strong>
                <span className="pipeline-count">{shownClosingMissions.length}</span>
              </div>
              {shownClosingMissions.map((m) => (
                <div key={m.id} className="pipeline-card pipeline-card--closing">
                  <div className="pipeline-card__title">{missionLabel(m)}</div>
                  <div className="pipeline-card__meta">{demandeLabelById(m.demande_id)}</div>
                  <div className="pipeline-card__meta">Cloturee: {formatDateTime(m.updated_at)}</div>
                </div>
              ))}
              {shownClosingMissions.length === 0 ? <div className="pipeline-empty">Aucune mission</div> : null}
            </div>
          </div>
        )}
      </section>

      {/* Unregister section */}
      <section className="card stack desinscription-section">
        <h3>Désinscription</h3>
        <p>Supprimer définitivement votre compte prestataire.</p>
        <button type="button" className="ghost danger" onClick={() => void handleUnregister()}>Désinscription</button>
      </section>
    </section>
  );
}
