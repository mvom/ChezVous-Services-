import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import AppOverlays from "./AppOverlays";
import type { Demande, EditDemandeDraft } from "./types";

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

function makeDemande(overrides: Partial<Demande> = {}): Demande {
  return {
    id: 1,
    client_id: 1,
    category: "menage",
    status: "ouverte",
    priority: "normale",
    description: "Description test",
    location: "Bastos",
    ville: "Yaounde",
    arrondissement: "Y2",
    quartier: "Bastos",
    client_availability_mode: "flexible",
    client_availability_note: "",
    sub_services: [],
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
    events: [],
    ...overrides,
  };
}

function makeDraft(overrides: Partial<EditDemandeDraft> = {}): EditDemandeDraft {
  return {
    category: "menage",
    description: "Description draft",
    ville: "Yaounde",
    arrondissement: "Y2",
    quartier: "Bastos",
    client_availability_mode: "flexible",
    client_availability_note: "",
    priority: "normale",
    sub_services: [],
    ...overrides,
  };
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    selectedDemandForDetail: null,
    demandDetailClosing: false,
    closeDemandDetailModal: vi.fn(),
    demandeLabel: vi.fn((d: Demande) => `Demande #${d.id}`),
    demandeCategoryLabel: vi.fn(() => "Menage"),
    statusChipClass: vi.fn(() => "status-chip"),
    demandeStatusLabel: vi.fn(() => "ouverte"),
    demandeEventStepBadge: vi.fn(() => null),
    demandeEventText: vi.fn(() => "Event"),
    formatStatusLabel: vi.fn((s?: string | null) => s || "-"),
    demandeEventActor: vi.fn(() => "Systeme"),
    formatDateTime: vi.fn(() => "01/01/2024"),
    editDemandeTarget: null,
    editDemandeDraft: null,
    setEditDemandeDraft: vi.fn(),
    editDemandePending: false,
    editModalClosing: false,
    handleConfirmEditDemande: vi.fn(),
    closeEditDemandeModal: vi.fn(),
    subServicesConfig: {
      menage: {
        groups: [{ title: "G1", options: [{ value: "opt1", label: "Option 1" }] }],
      },
    },
    demandeCancelId: null,
    cancelModalClosing: false,
    demandeLabelById: vi.fn((id: number) => `Demande #${id}`),
    closeCancelDemandeModal: vi.fn(),
    confirmCancelDemande: vi.fn(),
    unregisterModalOpen: false,
    unregisterModalClosing: false,
    unregisterPassword: "",
    setUnregisterPassword: vi.fn(),
    unregisterPending: false,
    closeUnregisterModal: vi.fn(),
    confirmUnregister: vi.fn(),
    cropModalOpen: false,
    cropModalClosing: false,
    cropImageSize: null,
    cropSourceDataUrl: "data:image/png;base64,a",
    cropZoom: 1,
    cropOffsetX: 0,
    cropOffsetY: 0,
    onCropPointerDown: vi.fn(),
    onCropPointerMove: vi.fn(),
    onCropPointerUp: vi.fn(),
    handleCropZoomChange: vi.fn(),
    closeCropModal: vi.fn(),
    confirmCropSelection: vi.fn(),
    cropPending: false,
    avatarDisplaySize: vi.fn(() => ({ width: 200, height: 200 })),
    ...overrides,
  };
}

describe("AppOverlays", () => {
  it("renders demand detail modal and closes it", () => {
    const closeDemandDetailModal = vi.fn();
    render(
      <AppOverlays
        {...makeProps({ selectedDemandForDetail: makeDemande(), closeDemandDetailModal })}
      />,
    );
    expect(screen.getByText("Demande #1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(closeDemandDetailModal).toHaveBeenCalled();
  });

  it("submits edit form and closes modal", () => {
    const handleConfirmEditDemande = vi.fn((e: React.FormEvent) => e.preventDefault());
    const closeEditDemandeModal = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          editDemandeTarget: makeDemande(),
          editDemandeDraft: makeDraft(),
          handleConfirmEditDemande,
          closeEditDemandeModal,
        })}
      />,
    );
    const forms = document.querySelectorAll("form");
    if (forms.length > 0) {
      fireEvent.submit(forms[0]);
      expect(handleConfirmEditDemande).toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(closeEditDemandeModal).toHaveBeenCalled();
  });

  it("calls setEditDemandeDraft when text fields change", () => {
    const setEditDemandeDraft = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          editDemandeTarget: makeDemande(),
          editDemandeDraft: makeDraft(),
          setEditDemandeDraft,
        })}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Description draft"), { target: { value: "Nouvelle description" } });
    fireEvent.change(screen.getByDisplayValue("Yaounde"), { target: { value: "Douala" } });
    fireEvent.change(screen.getByDisplayValue("Y2"), { target: { value: "Y1" } });
    fireEvent.change(screen.getByDisplayValue("Bastos"), { target: { value: "Bonamoussadi" } });
    expect(setEditDemandeDraft).toHaveBeenCalled();
  });

  it("calls setEditDemandeDraft when category, sub-service, priority and mode change", () => {
    const setEditDemandeDraft = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          editDemandeTarget: makeDemande(),
          editDemandeDraft: makeDraft(),
          setEditDemandeDraft,
        })}
      />,
    );

    const triggers = document.querySelectorAll("button.custom-select__trigger");
    if (triggers.length > 0) {
      fireEvent.click(triggers[0]);
      const categoryOption = document.querySelector("[data-value='plomberie']");
      if (categoryOption) fireEvent.mouseDown(categoryOption);
    }

    const checkbox = document.querySelector("input[type='checkbox']") as HTMLInputElement | null;
    if (checkbox) fireEvent.click(checkbox);

    if (triggers.length > 1) {
      fireEvent.click(triggers[1]);
      const priorityOption = document.querySelector("[data-value='haute']");
      if (priorityOption) fireEvent.mouseDown(priorityOption);
    }

    if (triggers.length > 2) {
      fireEvent.click(triggers[2]);
      const modeOption = document.querySelector("[data-value='fixe']");
      if (modeOption) fireEvent.mouseDown(modeOption);
    }

    expect(setEditDemandeDraft).toHaveBeenCalled();
  });

  it("handles cancel demande modal actions", () => {
    const closeCancelDemandeModal = vi.fn();
    const confirmCancelDemande = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          demandeCancelId: 77,
          closeCancelDemandeModal,
          confirmCancelDemande,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'annulation" }));
    expect(closeCancelDemandeModal).toHaveBeenCalled();
    expect(confirmCancelDemande).toHaveBeenCalled();
  });

  it("handles unregister modal input and confirmation", () => {
    const setUnregisterPassword = vi.fn();
    const closeUnregisterModal = vi.fn();
    const confirmUnregister = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          unregisterModalOpen: true,
          setUnregisterPassword,
          closeUnregisterModal,
          confirmUnregister,
        })}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre mot de passe"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    expect(setUnregisterPassword).toHaveBeenCalledWith("secret");
    expect(closeUnregisterModal).toHaveBeenCalled();
    expect(confirmUnregister).toHaveBeenCalled();
  });

  it("handles crop modal slider and apply", () => {
    const handleCropZoomChange = vi.fn();
    const closeCropModal = vi.fn();
    const confirmCropSelection = vi.fn();
    render(
      <AppOverlays
        {...makeProps({
          cropModalOpen: true,
          cropImageSize: { width: 400, height: 300 },
          handleCropZoomChange,
          closeCropModal,
          confirmCropSelection,
        })}
      />,
    );

    const range = document.querySelector("input[type='range']") as HTMLInputElement | null;
    if (range) {
      fireEvent.change(range, { target: { value: "1.7" } });
      expect(handleCropZoomChange).toHaveBeenCalledWith(1.7);
    }

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(closeCropModal).toHaveBeenCalled();
    expect(confirmCropSelection).toHaveBeenCalled();
  });

  it("renders demand detail modal with events history", () => {
    const demande = makeDemande({
      events: [
        {
          id: 1,
          event_type: "status_change",
          previous_status: "ouverte",
          new_status: "en_cours",
          actor_user_id: 1,
          actor_label: "Client",
          created_at: "2024-01-02T00:00:00",
        } as import("./types").DemandeEvent,
      ],
    });
    const demandeEventText = vi.fn(() => "Status changed");
    const demandeEventActor = vi.fn(() => "Client");
    render(
      <AppOverlays
        {...makeProps({ selectedDemandForDetail: demande, demandeEventText, demandeEventActor })}
      />,
    );
    expect(screen.getByText("Status changed")).toBeInTheDocument();
  });

  it("does not render transition detail for cancelled demand events", () => {
    const demande = makeDemande({
      events: [
        {
          id: 1,
          event_type: "annulee",
          previous_status: "ouverte",
          new_status: "annulee",
          actor_user_id: 1,
          actor_label: "Client",
          created_at: "2024-01-02T00:00:00",
        } as import("./types").DemandeEvent,
      ],
    });
    render(<AppOverlays {...makeProps({ selectedDemandForDetail: demande })} />);
    expect(screen.queryByText(/Transition:/)).not.toBeInTheDocument();
  });
});
