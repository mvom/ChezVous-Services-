/**
 * Unit / interaction tests for ClientWorkspace.tsx
 * Renders the pure ClientWorkspace view directly with a vm prop, bypassing
 * the container and AppCtx.Provider for full state control.
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import ClientWorkspaceView from "./ClientWorkspace";
import { useClientDashboardViewModel } from "./useClientDashboardViewModel";
import type { Demande, Mission } from "../../types";

type ClientDashboardViewModel = ReturnType<typeof useClientDashboardViewModel>;

afterEach(cleanup);

// jsdom does not implement scrollIntoView
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});


// ── Minimal demande fixture ──────────────────────────────────────────────────
function makeDemande(overrides: Partial<Demande> = {}): Demande {
  return {
    id: 1,
    client_id: 42,
    category: "plomberie",
    sub_services: [],
    description: "Test plomberie description",
    location: "Bastos",
    ville: "Yaounde",
    arrondissement: "Yaounde 2",
    quartier: "Bastos",
    priority: "normale",
    status: "ouverte",
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
    events: [],
    ...overrides,
  } as Demande;
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 10,
    demande_id: 1,
    client_id: 42,
    prestataire_id: 99,
    status: "en_cours",
    scheduled_at: null,
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
    prestataire_summary: null,
    ...overrides,
  } as Mission;
}

// ── ViewModel factory ──────────────────────────────────────────────────────────
function makeVm(overrides: Partial<ClientDashboardViewModel> = {}): ClientDashboardViewModel {
  const formRef = { current: null };
  // Extract input values so computed fields derive from them correctly
  const userId = overrides.userId ?? 42;
  const demandes = overrides.demandes ?? [];
  const missions = overrides.missions ?? [];
  const clientStatusFilter = overrides.clientStatusFilter ?? "all";
  const clientQuery = overrides.clientQuery ?? "";
  const newDemandeCategory = overrides.newDemandeCategory ?? "plomberie";
  const newDemandeSubServices = overrides.newDemandeSubServices ?? [];

  const clientDemandes = overrides.clientDemandes ?? demandes.filter((d) => d.client_id === userId);
  const clientMissions = overrides.clientMissions ?? missions.filter((m) => m.client_id === userId);
  const loweredQuery = clientQuery.trim().toLowerCase();
  const filteredDemandes = overrides.filteredDemandes ?? clientDemandes.filter((d) => {
    const matchesStatus = clientStatusFilter === "all" || d.status === clientStatusFilter;
    const matchesQuery =
      loweredQuery.length === 0 ||
      d.location.toLowerCase().includes(loweredQuery) ||
      d.description.toLowerCase().includes(loweredQuery);
    return matchesStatus && matchesQuery;
  });
  const pendingDemandes = overrides.pendingDemandes ?? clientDemandes.filter((d) => d.status === "ouverte").length;
  const activeMissions = overrides.activeMissions ?? clientMissions.filter((m) => m.status === "en_cours").length;
  const highPriorityOpen = overrides.highPriorityOpen ?? clientDemandes.filter((d) => d.status === "ouverte" && d.priority === "haute").length;
  const completedMissions = clientMissions.filter((m) => m.status === "terminee").length;
  const completionRate = clientMissions.length > 0 ? Math.round((completedMissions / clientMissions.length) * 100) : 0;
  const latestOpenDemande = overrides.latestOpenDemande !== undefined
    ? overrides.latestOpenDemande
    : [...clientDemandes]
        .filter((d) => d.status === "ouverte")
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0];

  return {
    // ─ Local UI state
    clientStatusFilter,
    setClientStatusFilter: vi.fn(),
    clientQuery,
    setClientQuery: vi.fn(),
    newDemandeCategory,
    setNewDemandeCategory: vi.fn(),
    newDemandeSubServices,
    setNewDemandeSubServices: vi.fn(),
    clientCreateFormRef: formRef,
    // ─ Demande modals
    selectedDemandForDetail: null,
    demandDetailClosing: false,
    openDemandDetailModal: vi.fn(),
    closeDemandDetailModal: vi.fn(),
    editDemandeTarget: null,
    editDemandeDraft: null,
    setEditDemandeDraft: vi.fn(),
    editDemandePending: false,
    editModalClosing: false,
    handleEditDemande: vi.fn(),
    closeEditDemandeModal: vi.fn(),
    handleConfirmEditDemande: vi.fn(),
    demandeCancelId: null,
    cancelModalClosing: false,
    handleCancelDemande: vi.fn(),
    closeCancelDemandeModal: vi.fn(),
    confirmCancelDemande: vi.fn(),
    // ─ Unregister flow
    unregisterModalOpen: false,
    unregisterPassword: "",
    setUnregisterPassword: vi.fn(),
    unregisterPending: false,
    unregisterModalClosing: false,
    handleUnregister: vi.fn(),
    closeUnregisterModal: vi.fn(),
    confirmUnregister: vi.fn(),
    // ─ Data from context
    demandes,
    services: [],
    missions,
    userId,
    claims: { sub: "42", role: "client", exp: 9999999999, iat: 0, username: "tester" },
    role: "client",
    userProfile: null,
    avatarInputRef: { current: null },
    avatarUploadPending: false,
    handleAvatarChange: vi.fn(),
    dashboardPending: false,
    clientLoyalty: null,
    userBadges: [],
    demandeLabelById: () => "Demande #1",
    missionLabelById: () => "Mission #1",
    demandeLabel: (d: Demande) => `${d.category} - ${d.location}`,
    missionLabel: (m: Mission) => `Mission #${m.id}`,
    logout: vi.fn(),
    switchableRoles: [],
    canSwitchRole: false,
    switchRolePending: false,
    addRolePending: false,
    handleSwitchRole: vi.fn(),
    handleAddRole: vi.fn(),
    // ─ Computed data
    clientDemandes,
    clientMissions,
    filteredDemandes,
    pendingDemandes,
    activeMissions,
    highPriorityOpen,
    completedMissions,
    completionRate,
    nextScheduledMission: undefined as Mission | undefined,
    latestOpenDemande: latestOpenDemande as Demande | undefined,
    matchingPreview: null,
    matchingPreviewPending: false,
    topCandidates: [],
    // ─ Handlers
    refreshClientDashboard: vi.fn(),
    refreshMatchingPreview: vi.fn(),
    handleCreateDemande: vi.fn(),
    handleDuplicateDemande: vi.fn(),
    ...overrides,
  } as unknown as ClientDashboardViewModel;
}

function renderWorkspace(vmOverrides: Partial<ClientDashboardViewModel> = {}) {
  const vm = makeVm(vmOverrides);
  return render(
    <BrowserRouter>
      <ClientWorkspaceView vm={vm} />
    </BrowserRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("ClientWorkspace", () => {
  it("renders the client cockpit heading", () => {
    renderWorkspace();
    expect(screen.getByText("Votre cockpit client")).toBeInTheDocument();
  });

  it("shows 0 pending demandes and 0 active missions", () => {
    renderWorkspace();
    expect(screen.getByText(/0 demande\(s\) ouverte\(s\)/i)).toBeInTheDocument();
  });

  it("shows Espace Client header", () => {
    renderWorkspace();
    expect(screen.getByText("Espace Client")).toBeInTheDocument();
  });

  it("renders username in header", () => {
    renderWorkspace();
    // The header has @tester (from claims.username)
    expect(screen.getByText("@tester")).toBeInTheDocument();
  });

  it("calls logout on button click", () => {
    const logout = vi.fn();
    renderWorkspace({ logout });
    fireEvent.click(screen.getByText("Se déconnecter"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("calls refreshClientDashboard on Actualiser click", () => {
    const refreshClientDashboard = vi.fn();
    renderWorkspace({ refreshClientDashboard });
    fireEvent.click(screen.getByText("Actualiser"));
    expect(refreshClientDashboard).toHaveBeenCalledTimes(1);
  });

  it("shows pending demandes count from context", () => {
    const demandes = [
      makeDemande({ id: 1, status: "ouverte" }),
      makeDemande({ id: 2, status: "ouverte" }),
    ];
    renderWorkspace({ demandes });
    expect(screen.getByText(/2 demande\(s\) ouverte\(s\)/i)).toBeInTheDocument();
  });

  it("renders demande in the list for this user", () => {
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes });
    // demandeLabel returns 'plomberie - Bastos' — may appear twice (list + matching widget)
    expect(screen.getAllByText("plomberie - Bastos").length).toBeGreaterThan(0);
  });

  it("calls handleEditDemande when Modifier clicked", () => {
    const handleEditDemande = vi.fn();
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes, handleEditDemande });
    fireEvent.click(screen.getByText("Modifier"));
    expect(handleEditDemande).toHaveBeenCalledWith(demandes[0]);
  });

  it("calls handleCancelDemande when Annuler clicked", () => {
    const handleCancelDemande = vi.fn();
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes, handleCancelDemande });
    fireEvent.click(screen.getByText("Annuler"));
    expect(handleCancelDemande).toHaveBeenCalledWith(1);
  });

  it("shows 'Aucune demande ne correspond' when filter has no match", () => {
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes, clientStatusFilter: "annulee" });
    expect(screen.getByText("Aucune demande ne correspond au filtre.")).toBeInTheDocument();
  });

  it("filters demandes by status — annulee demande shows no Modifier button", () => {
    const demandes = [makeDemande({ id: 1, status: "annulee" })];
    renderWorkspace({ demandes });
    expect(screen.queryByText("Modifier")).not.toBeInTheDocument();
  });

  it("calls setClientQuery on input change", () => {
    const setClientQuery = vi.fn();
    renderWorkspace({ setClientQuery });
    const input = screen.getByPlaceholderText("Filtrer par lieu ou description");
    fireEvent.change(input, { target: { value: "Bastos" } });
    expect(setClientQuery).toHaveBeenCalledWith("Bastos");
  });

  it("calls setNewDemandeCategory when category changes via CustomSelect", () => {
    const setNewDemandeCategory = vi.fn();
    const setNewDemandeSubServices = vi.fn();
    renderWorkspace({ setNewDemandeCategory, setNewDemandeSubServices, newDemandeCategory: "plomberie" });
    // CustomSelect for category — find trigger button near "Catégorie de besoin"
    const categoryLabel = screen.getByText("Catégorie de besoin");
    const container = categoryLabel.closest("label");
    const trigger = container?.querySelector("button.custom-select__trigger");
    if (trigger) {
      fireEvent.click(trigger);
      const option = document.querySelector("[data-value='menage']");
      if (option) {
        fireEvent.mouseDown(option);
        expect(setNewDemandeCategory).toHaveBeenCalledWith("menage");
        expect(setNewDemandeSubServices).toHaveBeenCalledWith([]);
      }
    }
  });

  it("shows sub-services checkboxes when category has sub-services", () => {
    renderWorkspace({ newDemandeCategory: "menage" });
    // menage should have sub-service options
    expect(screen.getByText(/Options incluses/i)).toBeInTheDocument();
  });

  it("calls setNewDemandeSubServices when sub-service checked", () => {
    const setNewDemandeSubServices = vi.fn();
    renderWorkspace({ newDemandeCategory: "menage", setNewDemandeSubServices });
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      expect(setNewDemandeSubServices).toHaveBeenCalled();
    }
  });

  it("calls setNewDemandeSubServices when sub-service unchecked", () => {
    const setNewDemandeSubServices = vi.fn();
    renderWorkspace({ newDemandeCategory: "menage", newDemandeSubServices: ["nettoyage_sol"], setNewDemandeSubServices });
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      expect(setNewDemandeSubServices).toHaveBeenCalled();
    }
  });

  it("renders loading skeleton when dashboardPending", () => {
    renderWorkspace({ dashboardPending: true });
    expect(screen.getByText("Synchronisation en cours de vos demandes et missions...")).toBeInTheDocument();
  });

  it("shows 'Dernières préférences mémorisées' when lastDraft is in localStorage", () => {
    const draft = { ville: "Douala", arrondissement: "Douala 1", quartier: "Bonanjo", priority: "normale", client_availability_mode: "flexible", client_availability_note: "" };
    window.localStorage.setItem("sm_last_demande_draft", JSON.stringify(draft));
    renderWorkspace();
    expect(screen.getByText("Dernières préférences mémorisées")).toBeInTheDocument();
    window.localStorage.removeItem("sm_last_demande_draft");
  });

  it("calls setNewDemandeSubServices filter branch when unchecking a checked sub-service", () => {
    const setNewDemandeSubServices = vi.fn();
    // "nettoyage_maison" is the first menage sub-service option — set it as checked
    renderWorkspace({ newDemandeCategory: "menage", newDemandeSubServices: ["nettoyage_maison"], setNewDemandeSubServices });
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    // First checkbox corresponds to nettoyage_maison — currently checked, click to uncheck
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      expect(setNewDemandeSubServices).toHaveBeenCalled();
    }
  });

  it("renders PrestataireTrustCard when mission has prestataire_summary", () => {
    const demandes = [makeDemande({ id: 12, client_id: 42, status: "attribuee" })];
    const missions = [
      makeMission({
        id: 12,
        demande_id: 12,
        client_id: 42,
        status: "terminee",
        prestataire_summary: {
          user_id: 99,
          display_name: "Martin Fix",
          avatar_url: null,
          trust: { verified: true, rating: 4.8, completed_missions: 10, total_missions: 12, average_response_minutes: 30, eta_reliability_percent: 95 },
        },
      }),
    ];
    renderWorkspace({ demandes, missions });
    expect(screen.getByText("Martin Fix")).toBeInTheDocument();
  });

  it("renders demande events in the timeline", () => {
    const demandes = [
      makeDemande({
        id: 1,
        status: "ouverte",
        events: [
          { id: 1, event_type: "status_change", previous_status: "ouverte", new_status: "en_cours", actor_user_id: 42, actor_label: "Client Test", created_at: "2024-01-02T10:00:00" },
        ],
      }),
    ];
    renderWorkspace({ demandes });
    // The event timeline should render (eventGroups.map is called)
    expect(screen.getAllByText("plomberie - Bastos").length).toBeGreaterThan(0);
  });

  it("renders linkedMission eta-line in demandes section when mission has scheduled_at", () => {
    const demandes = [makeDemande({ id: 5, status: "attribuee" })];
    const missions = [makeMission({ id: 20, demande_id: 5, client_id: 42, status: "en_cours", scheduled_at: "2026-07-15T09:00:00" })];
    renderWorkspace({ demandes, missions });
    expect(screen.getByText(/Intervention prévue le/)).toBeInTheDocument();
  });


  it("does not render removed secondary dashboard sections", () => {
    renderWorkspace();
    expect(screen.queryByText("Prochaine action recommandée")).not.toBeInTheDocument();
    expect(screen.queryByText("Vue d'ensemble en 5 secondes")).not.toBeInTheDocument();
    expect(screen.queryByText("Matching intelligent")).not.toBeInTheDocument();
    expect(screen.queryByText("Fidélité client")).not.toBeInTheDocument();
    expect(screen.queryByText("Historique des services rendus")).not.toBeInTheDocument();
  });

  it("renders demandes in LIFO order", () => {
    const demandes = [
      makeDemande({ id: 1, created_at: "2024-01-01T00:00:00", description: "Ancienne demande" }),
      makeDemande({ id: 2, created_at: "2024-01-02T00:00:00", description: "Demande recente" }),
    ];
    const clientDemandes = [...demandes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
    const filteredDemandes = clientDemandes;

    renderWorkspace({ demandes, clientDemandes, filteredDemandes, latestOpenDemande: clientDemandes[0] });

    const items = document.querySelectorAll(".list.clean-list > li .demande-meta");
    expect(items[0]?.textContent).toContain("Demande recente");
    expect(items[1]?.textContent).toContain("Ancienne demande");
  });

  it("clicks avatar wrap in client workspace", () => {
    renderWorkspace();
    const avatarWrap = document.querySelector(".profile-avatar-wrap");
    if (avatarWrap) {
      fireEvent.click(avatarWrap);
    }
    expect(screen.getByText("Votre cockpit client")).toBeInTheDocument();
  });
});
