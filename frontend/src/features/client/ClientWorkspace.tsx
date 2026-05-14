// ── Client Workspace ─────────────────────────────────────────────────────────
// Previously: renderClientWorkspace() inside AppShell
// Now: standalone React component consuming AppCtx

import React from "react";
import CustomSelect from "../../CustomSelect";
import RoleSwitchActions from "../../RoleSwitchActions";
import { DEMANDE_DRAFT_KEY, SUB_SERVICES_CONFIG } from "../../constants";
import type { DemandeCategory, DemandeEvent } from "../../types";
import type { useClientDashboardViewModel } from "./useClientDashboardViewModel";
import {
  clientAvailabilityLabel,
  demandeEventActor,
  demandeEventStepBadge,
  demandeEventText,
  demandeGeoLabel,
  demandeProgressSteps,
  demandeStatusLabel,
  demandeStatusTone,
  etaReliabilityLabel,
  formatDateTime,
  formatResponseDelay,
  groupEventsByDay,
  priorityClass,
  priorityLabel,
  scoreBarClass,
  statusChipClass,
  trustBadgeTone,
} from "../../utils";

// ── Inline helpers ────────────────────────────────────────────────────────────

function PrestataireTrustCard({ summary }: { summary: NonNullable<import("../../types").PrestataireMissionSummary> }) {
  const { trust } = summary;
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

// ── Main component ────────────────────────────────────────────────────────────

type ClientDashboardViewModel = ReturnType<typeof useClientDashboardViewModel>;

export default function ClientWorkspace({ vm }: { vm: ClientDashboardViewModel }): React.JSX.Element {
  const ctx = vm;
  const {
    demandes, userId, claims,
    userProfile, avatarInputRef, avatarUploadPending, handleAvatarChange,
    role, dashboardPending,
    clientStatusFilter, setClientStatusFilter, clientQuery, setClientQuery,
    clientCreateFormRef, newDemandeCategory, setNewDemandeCategory,
    newDemandeSubServices, setNewDemandeSubServices,
    handleCreateDemande, handleEditDemande, handleCancelDemande, handleDuplicateDemande,
    refreshClientDashboard,
    handleValidatePrestataire,
    handleUnregister,
    demandeLabel,
    logout,
    switchableRoles, canSwitchRole, switchRolePending, addRolePending, handleSwitchRole, handleAddRole,
    clientDemandes,
    clientMissions,
    filteredDemandes,
    pendingDemandes,
    activeMissions,
    topCandidates,
    matchingPreviewPending,
    latestOpenDemande,
  } = ctx;

  const lastDraftRaw = window.localStorage.getItem(DEMANDE_DRAFT_KEY);
  type LastDraftShape = {
    ville?: string;
    arrondissement?: string;
    quartier?: string;
    category?: string;
    client_availability_mode?: string;
    client_availability_note?: string;
    requested_datetime?: string;
    priority?: string;
  };
  let lastDraft: LastDraftShape | null = null;
  if (lastDraftRaw) {
    try {
      lastDraft = JSON.parse(lastDraftRaw) as LastDraftShape;
    } catch {
      window.localStorage.removeItem(DEMANDE_DRAFT_KEY);
    }
  }

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
            <h2 className="role-space-title">Espace Client</h2>
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
            addRoleTarget="prestataire"
            onSwitchRole={(item) => void handleSwitchRole(item)}
            onAddRole={(item) => void handleAddRole(item)}
          />
          <button type="button" className="ghost" onClick={() => void refreshClientDashboard()} disabled={dashboardPending}>
            Actualiser
          </button>
          <button type="button" className="ghost" onClick={logout}>
            Se déconnecter
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
      </section>

      <section className="card stack">
          <div className="section-head">
            <h3>Mes demandes</h3>
            <span>{dashboardPending ? "Chargement..." : "À jour"}</span>
          </div>
          <div className="filter-row">
            <CustomSelect
              value={clientStatusFilter}
              onChange={(v) => setClientStatusFilter(v as import("../../types").ClientStatusFilter)}
              options={[
                { value: "all", label: "Tous les statuts" },
                { value: "ouverte", label: "Ouverte" },
                { value: "attribuee", label: "Attribuée" },
                { value: "annulee", label: "Annulée" },
                { value: "expiree", label: "Expirée" },
              ]}
            />
            <input
              type="text"
              placeholder="Filtrer par lieu ou description"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
            />
          </div>
          <ul className="list clean-list">
            {dashboardPending ? <SkeletonList prefix="client-demandes" /> : null}
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
                    <strong>{demandeLabel(demande)}</strong>
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
                      <span>Intervention prévue le {formatDateTime(linkedMission.scheduled_at)}</span>
                    </div>
                  ) : null}
                  {linkedMission?.prestataire_summary ? <PrestataireTrustCard summary={linkedMission.prestataire_summary} /> : null}
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

      {latestOpenDemande && (topCandidates.length > 0 || matchingPreviewPending) ? (
        <section className="card stack">
          <div className="section-head">
            <h3>Meilleures correspondances</h3>
            <span>{matchingPreviewPending ? "Recherche en cours..." : `${topCandidates.length} prestataire(s) suggéré(s)`}</span>
          </div>
          {matchingPreviewPending ? (
            <ul className="list clean-list"><SkeletonList prefix="matching" count={3} /></ul>
          ) : (
            <ul className="list clean-list">
              {topCandidates.map((candidate) => (
                <li key={candidate.user_id} className="provider-trust-card">
                  <div className="provider-trust-head">
                    <strong>{candidate.display_name}</strong>
                    <span className="provider-trust-rating">Score {candidate.score_total}</span>
                  </div>
                  <div className="provider-trust-badges">
                    {candidate.trust.verified ? <span className="trust-badge trust-badge--verified">Vérifié</span> : null}
                    <span className="trust-badge">Note {candidate.trust.rating.toFixed(1)}/5</span>
                    <span className="trust-badge">{candidate.trust.completed_missions} missions</span>
                    {candidate.distance_km != null ? (
                      <span className="trust-badge">{candidate.distance_km.toFixed(1)} km</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="ghost inline-ghost"
                    disabled={dashboardPending}
                    onClick={() => void handleValidatePrestataire(latestOpenDemande.id, candidate.user_id)}
                  >
                    Valider ce prestataire
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <form className="card stack" onSubmit={(e) => void handleCreateDemande(e)} ref={clientCreateFormRef as React.RefObject<HTMLFormElement>}>
          <div className="section-head">
            <h3>Créer une demande</h3>
            {lastDraft ? (
              <span>Dernières préférences mémorisées</span>
            ) : (
              <span>Création rapide</span>
            )}
          </div>
          <label>
            <span>Catégorie de besoin</span>
            <CustomSelect
              name="category"
              value={newDemandeCategory}
              onChange={(v) => {
                setNewDemandeCategory(v as DemandeCategory);
                setNewDemandeSubServices([]);
              }}
              options={[
                { value: "menage", label: "🧹 Ménage" },
                { value: "plomberie", label: "🔧 Plomberie" },
                { value: "electricite", label: "⚡ Électricité" },
                { value: "mecanique_auto", label: "🔩 Mécanique automobile" },
                { value: "soudure", label: "🔥 Soudure" },
                { value: "evenementiel", label: "🎉 Événementiel" },
                { value: "reparation_electronique", label: "🛠️ Réparation électronique" },
                { value: "climatisation", label: "❄️ Climatisation & Réfrigération" },
              ]}
            />
          </label>
          {SUB_SERVICES_CONFIG[newDemandeCategory] && (
            <fieldset className="sub-services-fieldset">
              <legend>Options incluses</legend>
              {SUB_SERVICES_CONFIG[newDemandeCategory].groups.map((group) => (
                <div key={group.title} className="sub-services-group">
                  {group.title && <span className="sub-services-group__title">{group.title}</span>}
                  <div className="sub-services-options">
                    {group.options.map((opt) => (
                      <label key={opt.value} className="sub-service-checkbox">
                        <input
                          type="checkbox"
                          checked={newDemandeSubServices.includes(opt.value)}
                          onChange={(e) => {
                            setNewDemandeSubServices((prev) =>
                              e.target.checked ? [...prev, opt.value] : prev.filter((s) => s !== opt.value)
                            );
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          )}
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
            <span>Disponibilité client</span>
            <CustomSelect
              name="client_availability_mode"
              defaultValue={lastDraft?.client_availability_mode || "flexible"}
              options={[
                { value: "flexible", label: "Flexible" },
                { value: "fixe", label: "Planning fixe" },
              ]}
            />
          </label>
          <label>
            <span>Détails disponibilité (ex : Lun-Ven 18h-20h)</span>
            <input
              type="text"
              name="client_availability_note"
              placeholder="Optionnel si flexible"
              defaultValue={lastDraft?.client_availability_note || ""}
            />
          </label>
          <label>
            <span>Date/heure souhaitée (optionnelle)</span>
            <input
              type="datetime-local"
              name="requested_datetime"
              defaultValue={lastDraft?.requested_datetime || ""}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            />
          </label>
          <label>
            <span>Priorité</span>
            <CustomSelect
              name="priority"
              defaultValue={lastDraft?.priority || "normale"}
              options={[
                { value: "haute", label: "🔴 Urgente" },
                { value: "normale", label: "🔵 Normale" },
                { value: "basse", label: "🟢 Basse" },
              ]}
            />
          </label>
          <button type="submit" disabled={dashboardPending}>{dashboardPending ? "Traitement..." : "Créer une demande"}</button>
      </form>

      <button
        type="button"
        className="ghost dashboard-unregister-fab"
        onClick={() => handleUnregister()}
        title="Supprimer définitivement mon compte"
      >
        Désinscription
      </button>
    </section>
  );
}
