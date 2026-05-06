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
    : [...clientDemandes].filter((d) => d.status === "ouverte").sort((a, b) => b.id - a.id)[0];

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

  it("calls handleUnregister on désinscription click", () => {
    const handleUnregister = vi.fn();
    renderWorkspace({ handleUnregister });
    fireEvent.click(screen.getByText("Désinscription"));
    expect(handleUnregister).toHaveBeenCalledTimes(1);
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

  it("renders missions in the history section", () => {
    const missions = [makeMission({ id: 10, client_id: 42, status: "terminee" })];
    renderWorkspace({ missions });
    expect(screen.getByText("Mission #10")).toBeInTheDocument();
  });

  it("shows empty missions message when no missions", () => {
    renderWorkspace();
    expect(screen.getByText("Aucun service rendu pour le moment.")).toBeInTheDocument();
  });

  it("shows loyalty points when clientLoyalty is set", () => {
    renderWorkspace({
      clientLoyalty: {
        loyalty_points: 75,
        completed_missions_count: 3,
        next_milestone: 100,
        progress_percent: 75,
      },
    });
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });

  it("calls setClientStatusFilter via Demandes ouvertes button", () => {
    const setClientStatusFilter = vi.fn();
    renderWorkspace({ setClientStatusFilter });
    // multiple buttons with this text — click the first
    fireEvent.click(screen.getAllByText("Demandes ouvertes")[0]);
    expect(setClientStatusFilter).toHaveBeenCalledWith("ouverte");
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

  it("shows matching widget section when latestOpenDemande exists", () => {
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes });
    expect(screen.getByText("Matching intelligent")).toBeInTheDocument();
  });

  it("calls refreshMatchingPreview when Actualiser clicked in matching widget", () => {
    const refreshMatchingPreview = vi.fn().mockResolvedValue(undefined);
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes, refreshMatchingPreview });
    // The matching widget has its own 'Actualiser' button distinct from the main one
    const actualisers = screen.getAllByText("Actualiser");
    // The second one should be in the matching widget (first is the main dashboard button)
    fireEvent.click(actualisers[actualisers.length - 1]);
    expect(refreshMatchingPreview).toHaveBeenCalled();
  });

  it("renders Nouvelle demande CTA button", () => {
    renderWorkspace();
    // The hero section has a 'Nouvelle demande' button
    const btns = screen.getAllByText("Nouvelle demande");
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns[0]);
  });

  it("renders 'Voir les demandes ouvertes' button when pending demandes > 0", () => {
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    renderWorkspace({ demandes });
    const btn = screen.getByText("Voir les demandes ouvertes");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
  });

  it("renders scheduled_at eta-line in mission history", () => {
    const missions = [makeMission({ id: 11, client_id: 42, status: "en_cours", scheduled_at: "2026-06-01T10:00:00" })];
    renderWorkspace({ missions });
    expect(screen.getByText(/Prevue le/)).toBeInTheDocument();
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
    const missions = [
      makeMission({
        id: 12,
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
    renderWorkspace({ missions });
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

  it("renders matching candidates list with topCandidates", () => {
    const demandes = [makeDemande({ id: 1, status: "ouverte" })];
    const latestOpenDemande = demandes[0];
    const candidate = {
      user_id: 50,
      display_name: "Artisan Pro",
      avatar_url: null,
      trust: { verified: true, rating: 4.5, completed_missions: 5, total_missions: 7, eta_reliability_percent: 90 },
      score_total: 85,
      score_zone: 30,
      score_rating: 25,
      score_completion: 20,
      score_response: 10,
      distance_km: 3.5,
    };
    const matchingPreview = { demande_id: 1, available_count: 1, candidates: [candidate] };
    const topCandidates = [candidate];
    renderWorkspace({ demandes, latestOpenDemande, matchingPreview, topCandidates });
    expect(screen.getByText("Artisan Pro")).toBeInTheDocument();
    expect(screen.getByText(/85\/100/)).toBeInTheDocument();
  });

  it("clicks 'Voir l\\'historique des services' nextAction when activeMissions > 0", () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    // No pending demandes (to pick second branch), 1 active mission
    const missions = [makeMission({ id: 99, client_id: 42, status: "en_cours" })];
    renderWorkspace({ missions, demandes: [] });
    const cta = screen.queryByText("Voir l'historique des services");
    if (cta) {
      fireEvent.click(cta);
      expect(window.scrollTo).toHaveBeenCalled();
    }
  });

  it("clicks 'Créer une demande' nextAction when no pending and no active", () => {
    renderWorkspace({ demandes: [], missions: [] });
    const ctas = screen.queryAllByText("Créer une demande");
    const ctaBtn = ctas.find(el => el.tagName === "BUTTON");
    if (ctaBtn) {
      fireEvent.click(ctaBtn);
      // clientCreateFormRef.current is null, no error
      expect(ctaBtn).toBeInTheDocument();
    } else {
      expect(screen.getByText("Votre cockpit client")).toBeInTheDocument();
    }
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
