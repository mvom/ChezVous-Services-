import { ChangeEvent, Dispatch, FormEvent, PointerEventHandler, SetStateAction } from "react";
import CustomSelect from "./CustomSelect";
import type {
  Demande,
  DemandeCategory,
  DemandeEvent,
  DemandeStepBadge,
  EditDemandeDraft,
} from "./types";

type SubServicesConfig = Record<
  string,
  { groups: { title: string; options: { value: string; label: string }[] }[] }
>;

type AppOverlaysProps = {
  selectedDemandForDetail: Demande | null;
  demandDetailClosing: boolean;
  closeDemandDetailModal: () => void;
  demandeLabel: (demande: Demande) => string;
  demandeCategoryLabel: (category: DemandeCategory) => string;
  statusChipClass: (status: string) => string;
  demandeStatusLabel: (status: string) => string;
  demandeEventStepBadge: (event: DemandeEvent) => DemandeStepBadge | null;
  demandeEventText: (event: DemandeEvent) => string;
  formatStatusLabel: (status?: string | null) => string;
  demandeEventActor: (event: DemandeEvent) => string;
  formatDateTime: (value?: string) => string;
  editDemandeTarget: Demande | null;
  editDemandeDraft: EditDemandeDraft | null;
  setEditDemandeDraft: Dispatch<SetStateAction<EditDemandeDraft | null>>;
  editDemandePending: boolean;
  editModalClosing: boolean;
  handleConfirmEditDemande: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  closeEditDemandeModal: () => void;
  subServicesConfig: SubServicesConfig;
  demandeCancelId: number | null;
  cancelModalClosing: boolean;
  demandeLabelById: (id: number) => string;
  closeCancelDemandeModal: () => void;
  confirmCancelDemande: () => Promise<void> | void;
  unregisterModalOpen: boolean;
  unregisterModalClosing: boolean;
  unregisterPassword: string;
  setUnregisterPassword: Dispatch<SetStateAction<string>>;
  unregisterPending: boolean;
  closeUnregisterModal: () => void;
  confirmUnregister: () => Promise<void> | void;
  cropModalOpen: boolean;
  cropModalClosing: boolean;
  cropImageSize: { width: number; height: number } | null;
  cropSourceDataUrl: string;
  cropZoom: number;
  cropOffsetX: number;
  cropOffsetY: number;
  onCropPointerDown: PointerEventHandler<HTMLDivElement>;
  onCropPointerMove: PointerEventHandler<HTMLDivElement>;
  onCropPointerUp: PointerEventHandler<HTMLDivElement>;
  handleCropZoomChange: (nextZoom: number) => void;
  closeCropModal: () => void;
  confirmCropSelection: () => Promise<void> | void;
  cropPending: boolean;
  avatarDisplaySize: (width: number, height: number, zoom: number) => { width: number; height: number };
};

export default function AppOverlays({
  selectedDemandForDetail,
  demandDetailClosing,
  closeDemandDetailModal,
  demandeLabel,
  demandeCategoryLabel,
  statusChipClass,
  demandeStatusLabel,
  demandeEventStepBadge,
  demandeEventText,
  formatStatusLabel,
  demandeEventActor,
  formatDateTime,
  editDemandeTarget,
  editDemandeDraft,
  setEditDemandeDraft,
  editDemandePending,
  editModalClosing,
  handleConfirmEditDemande,
  closeEditDemandeModal,
  subServicesConfig,
  demandeCancelId,
  cancelModalClosing,
  demandeLabelById,
  closeCancelDemandeModal,
  confirmCancelDemande,
  unregisterModalOpen,
  unregisterModalClosing,
  unregisterPassword,
  setUnregisterPassword,
  unregisterPending,
  closeUnregisterModal,
  confirmUnregister,
  cropModalOpen,
  cropModalClosing,
  cropImageSize,
  cropSourceDataUrl,
  cropZoom,
  cropOffsetX,
  cropOffsetY,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
  handleCropZoomChange,
  closeCropModal,
  confirmCropSelection,
  cropPending,
  avatarDisplaySize,
}: AppOverlaysProps): JSX.Element {
  function updateEditDemandeDraft(updater: (prev: EditDemandeDraft) => EditDemandeDraft): void {
    setEditDemandeDraft((prev) => (prev ? updater(prev) : prev));
  }

  function handleEditFormSubmit(event: FormEvent<HTMLFormElement>): void {
    void handleConfirmEditDemande(event);
  }

  function handleEditCategoryChange(value: string): void {
    updateEditDemandeDraft((prev) => ({
      ...prev,
      category: value as DemandeCategory,
      sub_services: [],
    }));
  }

  function handleEditSubServiceChange(optionValue: string, checked: boolean): void {
    updateEditDemandeDraft((prev) => {
      const current = prev.sub_services || [];
      return {
        ...prev,
        sub_services: checked
          ? [...current, optionValue]
          : current.filter((subService) => subService !== optionValue),
      };
    });
  }

  function createEditSubServiceChangeHandler(optionValue: string): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>) => {
      handleEditSubServiceChange(optionValue, event.target.checked);
    };
  }

  function handleEditDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const nextValue = event.target.value;
    updateEditDemandeDraft((prev) => ({ ...prev, description: nextValue }));
  }

  function handleEditVilleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    updateEditDemandeDraft((prev) => ({ ...prev, ville: nextValue }));
  }

  function handleEditArrondissementChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    updateEditDemandeDraft((prev) => ({ ...prev, arrondissement: nextValue }));
  }

  function handleEditQuartierChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    updateEditDemandeDraft((prev) => ({ ...prev, quartier: nextValue }));
  }

  function handleEditPriorityChange(value: string): void {
    updateEditDemandeDraft((prev) => ({ ...prev, priority: value }));
  }

  function handleEditAvailabilityModeChange(value: string): void {
    updateEditDemandeDraft((prev) => ({
      ...prev,
      client_availability_mode: value === "fixe" ? "fixe" : "flexible",
    }));
  }

  function handleEditAvailabilityNoteChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    updateEditDemandeDraft((prev) => ({ ...prev, client_availability_note: nextValue }));
  }

  function handleCancelConfirmClick(): void {
    void confirmCancelDemande();
  }

  function handleUnregisterPasswordInputChange(event: ChangeEvent<HTMLInputElement>): void {
    setUnregisterPassword(event.target.value);
  }

  function handleUnregisterConfirmClick(): void {
    void confirmUnregister();
  }

  function handleCropZoomInputChange(event: ChangeEvent<HTMLInputElement>): void {
    handleCropZoomChange(Number(event.target.value));
  }

  function handleCropConfirmClick(): void {
    void confirmCropSelection();
  }

  return (
    <>
      {selectedDemandForDetail ? (
        <div className={`demand-detail-modal ${demandDetailClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Details de la demande">
          <div className="demand-detail-panel">
            <div className="demand-detail-header">
              <div>
                <h2>{demandeLabel(selectedDemandForDetail)}</h2>
                <span className={statusChipClass(selectedDemandForDetail.status)}>{demandeStatusLabel(selectedDemandForDetail.status)}</span>
              </div>
              <button type="button" className="ghost" onClick={closeDemandDetailModal} title="Fermer">✕</button>
            </div>

            <div className="demand-detail-content">
              <section className="demand-section">
                <h3>Catégorie</h3>
                <p>{demandeCategoryLabel(selectedDemandForDetail.category)}</p>
              </section>

              <section className="demand-section">
                <h3>Description</h3>
                <p className="demand-description">{selectedDemandForDetail.description}</p>
              </section>

              <section className="demand-section">
                <h3>Localisation</h3>
                <div className="demand-geo-grid">
                  <div>
                    <strong>Adresse</strong>
                    <p>{selectedDemandForDetail.location}</p>
                  </div>
                  <div>
                    <strong>Ville</strong>
                    <p>{selectedDemandForDetail.ville || "—"}</p>
                  </div>
                  <div>
                    <strong>Arrondissement</strong>
                    <p>{selectedDemandForDetail.arrondissement || "—"}</p>
                  </div>
                  <div>
                    <strong>Quartier</strong>
                    <p>{selectedDemandForDetail.quartier || "—"}</p>
                  </div>
                </div>
              </section>

              <section className="demand-section">
                <h3>Disponibilités du client</h3>
                <div className="demand-availability">
                  <div>
                    <strong>Mode</strong>
                    <p>{selectedDemandForDetail.client_availability_mode === "fixe" ? "Planning fixe" : "Flexible"}</p>
                  </div>
                  {selectedDemandForDetail.client_availability_note ? (
                    <div>
                      <strong>Détails</strong>
                      <p>{selectedDemandForDetail.client_availability_note}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="demand-section">
                <h3>Priorité</h3>
                <div className="priority-badge" data-priority={selectedDemandForDetail.priority}>
                  {selectedDemandForDetail.priority === "haute" && "🔴 Urgente"}
                  {selectedDemandForDetail.priority === "normale" && "🔵 Normale"}
                  {selectedDemandForDetail.priority === "basse" && "🟢 Basse"}
                </div>
              </section>

              {selectedDemandForDetail.events && selectedDemandForDetail.events.length > 0 ? (
                <section className="demand-section">
                  <h3>Historique</h3>
                  <ul className="timeline clean-list">
                    {selectedDemandForDetail.events.map((event) => {
                      const stepBadge = demandeEventStepBadge(event);
                      return (
                        <li key={event.id} className="timeline-item">
                          <span className="timeline-marker" />
                          <div className="timeline-content">
                            <div className="timeline-line timeline-line--event">
                              <strong className="timeline-event-title">{demandeEventText(event)}</strong>
                              {stepBadge ? (
                                <span className={`step-badge step-badge--${stepBadge.key}`}>{stepBadge.label}</span>
                              ) : null}
                            </div>
                            {event.previous_status && event.new_status ? (
                              <p className="timeline-detail">Transition: {formatStatusLabel(event.previous_status)} {"->"} {formatStatusLabel(event.new_status)}</p>
                            ) : null}
                            {demandeEventActor(event) !== "Systeme" ? (
                              <p className="timeline-detail">Par: {demandeEventActor(event)}</p>
                            ) : null}
                            <time className="timeline-time">{formatDateTime(event.created_at)}</time>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>

            <div className="demand-detail-actions">
              <button type="button" className="ghost" onClick={closeDemandDetailModal}>Fermer</button>
            </div>
          </div>
        </div>
      ) : null}

      {editDemandeTarget && editDemandeDraft ? (
        <div className={`action-modal ${editModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Modifier la demande">
          <form className="action-modal__panel stack" onSubmit={handleEditFormSubmit}>
            <div className="section-head">
              <h3>Modifier la demande {demandeLabel(editDemandeTarget)}</h3>
              <button type="button" className="ghost" onClick={closeEditDemandeModal} disabled={editDemandePending}>✕</button>
            </div>
            <label>
              <span>Catégorie de besoin</span>
              <CustomSelect
                value={editDemandeDraft.category}
                onChange={handleEditCategoryChange}
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
            {subServicesConfig[editDemandeDraft.category] ? (
              <fieldset className="sub-services-fieldset">
                <legend>Options incluses</legend>
                {subServicesConfig[editDemandeDraft.category].groups.map((group) => (
                  <div key={group.title} className="sub-services-group">
                    {group.title ? <span className="sub-services-group__title">{group.title}</span> : null}
                    <div className="sub-services-options">
                      {group.options.map((opt) => (
                        <label key={opt.value} className="sub-service-checkbox">
                          <input
                            type="checkbox"
                            checked={(editDemandeDraft.sub_services || []).includes(opt.value)}
                            onChange={createEditSubServiceChangeHandler(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
            ) : null}
            <label>
              <span>Description</span>
              <textarea
                value={editDemandeDraft.description}
                onChange={handleEditDescriptionChange}
                required
              />
            </label>
            <div className="two-col">
              <label>
                <span>Ville</span>
                <input
                  type="text"
                  value={editDemandeDraft.ville}
                  onChange={handleEditVilleChange}
                  required
                />
              </label>
              <label>
                <span>Arrondissement</span>
                <input
                  type="text"
                  value={editDemandeDraft.arrondissement}
                  onChange={handleEditArrondissementChange}
                  required
                />
              </label>
            </div>
            <div className="two-col">
              <label>
                <span>Quartier</span>
                <input
                  type="text"
                  value={editDemandeDraft.quartier}
                  onChange={handleEditQuartierChange}
                  required
                />
              </label>
              <label>
                <span>Priorité</span>
                <CustomSelect
                  value={editDemandeDraft.priority}
                  onChange={handleEditPriorityChange}
                  options={[
                    { value: "haute", label: "🔴 Urgente" },
                    { value: "normale", label: "🔵 Normale" },
                    { value: "basse", label: "🟢 Basse" },
                  ]}
                />
              </label>
            </div>
            <label>
              <span>Disponibilité client</span>
              <CustomSelect
                value={editDemandeDraft.client_availability_mode}
                onChange={handleEditAvailabilityModeChange}
                options={[
                  { value: "flexible", label: "Flexible" },
                  { value: "fixe", label: "Planning fixe" },
                ]}
              />
            </label>
            <label>
              <span>Détails disponibilité</span>
              <input
                type="text"
                value={editDemandeDraft.client_availability_note}
                onChange={handleEditAvailabilityNoteChange}
                placeholder="Optionnel si flexible"
              />
            </label>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeEditDemandeModal} disabled={editDemandePending}>Annuler</button>
              <button type="submit" disabled={editDemandePending}>{editDemandePending ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {demandeCancelId !== null ? (
        <div className={`action-modal ${cancelModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Confirmer l'annulation">
          <div className="action-modal__panel stack">
            <h3>Annuler la demande {demandeLabelById(demandeCancelId)} ?</h3>
            <p>Cette action est irreversible pour cette demande.</p>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeCancelDemandeModal}>Retour</button>
              <button type="button" onClick={handleCancelConfirmClick}>Confirmer l'annulation</button>
            </div>
          </div>
        </div>
      ) : null}

      {unregisterModalOpen ? (
        <div className={`action-modal ${unregisterModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Confirmer la désinscription">
          <div className="action-modal__panel stack">
            <h3>Confirmer la désinscription</h3>
            <p>Entrez votre mot de passe pour supprimer votre compte.</p>
            <label>
              <span>Mot de passe</span>
              <input
                type="password"
                value={unregisterPassword}
                onChange={handleUnregisterPasswordInputChange}
                placeholder="Votre mot de passe"
              />
            </label>
            <div className="action-modal__actions">
              <button type="button" className="ghost" onClick={closeUnregisterModal} disabled={unregisterPending}>Annuler</button>
              <button type="button" onClick={handleUnregisterConfirmClick} disabled={unregisterPending}>
                {unregisterPending ? "Suppression..." : "Supprimer mon compte"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cropModalOpen && cropImageSize ? (
        <div className={`avatar-crop-modal ${cropModalClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Recadrer la photo de profil">
          <div className="avatar-crop-panel">
            <h3>Recadrer la photo</h3>
            <p>Faites glisser l'image et ajustez le zoom.</p>

            <div
              className="avatar-crop-stage"
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
              onPointerCancel={onCropPointerUp}
            >
              <img
                src={cropSourceDataUrl}
                alt="Apercu recadrage"
                className="avatar-crop-image"
                draggable={false}
                style={{
                  width: `${avatarDisplaySize(cropImageSize.width, cropImageSize.height, cropZoom).width}px`,
                  height: `${avatarDisplaySize(cropImageSize.width, cropImageSize.height, cropZoom).height}px`,
                  transform: `translate(-50%, -50%) translate(${cropOffsetX}px, ${cropOffsetY}px)`,
                }}
              />
              <div className="avatar-crop-mask" />
            </div>

            <div className="avatar-crop-controls">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={handleCropZoomInputChange}
              />
            </div>

            <div className="avatar-crop-actions">
              <button type="button" className="ghost" onClick={closeCropModal} disabled={cropPending}>Annuler</button>
              <button type="button" onClick={handleCropConfirmClick} disabled={cropPending}>
                {cropPending ? "Application..." : "Appliquer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}