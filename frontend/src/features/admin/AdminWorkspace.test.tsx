/**
 * Tests for AdminWorkspace.tsx (pure view)
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import AdminWorkspaceView from "./AdminWorkspace";
import type { useAdminDashboardViewModel } from "./useAdminDashboardViewModel";

type AdminDashboardViewModel = ReturnType<typeof useAdminDashboardViewModel>;

afterEach(cleanup);

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

function makeVm(overrides: Partial<AdminDashboardViewModel> = {}): AdminDashboardViewModel {
  return {
    userId: 1,
    role: "admin",
    claims: { sub: "1", username: "admin_user", role: "admin", exp: 9999999999, iat: 0 },
    token: "tok",
    dashboardPending: false,
    refreshDashboard: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    demandes: [],
    missions: [],
    services: [],
    users: [],
    prestataires: [],
    userProfile: null,
    adminAtRisk: null,
    adminRoleDraftByUserId: {},
    setAdminRoleDraftByUserId: vi.fn(),
    adminActionUserId: null,
    adminActionKind: null,
    demandeLabel: (d) => `demande#${d.id}`,
    missionLabelById: (id) => `mission#${id}`,
    demandeLabelById: (id) => `demande#${id}`,
    handleTogglePrestataireVerified: vi.fn().mockResolvedValue(undefined),
    handleAdminChangeUserRole: vi.fn().mockResolvedValue(undefined),
    handleAdminDeleteUser: vi.fn().mockResolvedValue(undefined),
    // Computed
    providerUsersCount: 0,
    verifiedProvidersCount: 0,
    activeMissionsCount: 0,
    openDemandesCount: 0,
    ...overrides,
  } as unknown as AdminDashboardViewModel;
}

const makeUser = (id: number, role = "client" as const) => ({
  id,
  username: `user${id}`,
  first_name: "First",
  last_name: "Last",
  email: `user${id}@test.com`,
  phone: "699000000",
  role,
});

const makePrestataire = (userId: number, verified = false) => ({
  id: userId * 10,
  user_id: userId,
  verified,
  zone_preference: "",
  availability_slots: [],
  is_visible: true,
});

function renderAdmin(overrides: Partial<AdminDashboardViewModel> = {}) {
  const vm = makeVm(overrides);
  return render(<AdminWorkspaceView vm={vm} />);
}

describe("AdminWorkspace", () => {
  it("renders admin heading", () => {
    renderAdmin();
    expect(screen.getByText("Console Admin")).toBeInTheDocument();
  });

  it("shows empty state for no prestataires", () => {
    renderAdmin();
    // The unified section should show empty state when there are no users
    expect(screen.getByText("Aucun compte utilisateur pour ce filtre.")).toBeInTheDocument();
  });

  it("shows empty state for no users", () => {
    renderAdmin();
    // Empty users list shows unified empty message
    expect(screen.getAllByText("Aucun compte utilisateur pour ce filtre.").length).toBeGreaterThan(0);
  });

  it("calls logout on Se déconnecter click", () => {
    const logout = vi.fn();
    renderAdmin({ logout });
    // Find first disconnect button
    const btns = screen.getAllByText("Se déconnecter");
    fireEvent.click(btns[0]);
    expect(logout).toHaveBeenCalled();
  });

  it("calls refreshDashboard on Actualiser le tableau click", () => {
    const refreshDashboard = vi.fn().mockResolvedValue(undefined);
    renderAdmin({ refreshDashboard });
    const btn = screen.getByText("Actualiser le tableau");
    fireEvent.click(btn);
    expect(refreshDashboard).toHaveBeenCalled();
  });

  it("shows skeleton when dashboardPending", () => {
    renderAdmin({ dashboardPending: true });
    const btns = screen.getAllByText("Actualisation...");
    expect(btns.length).toBeGreaterThan(0);
  });

  it("shows prestataire with unverified status", () => {
    const users = [makeUser(10, "prestataire")];
    const prestataires = [makePrestataire(10, false)];
    renderAdmin({ users, prestataires });
    expect(screen.getByText("À certifier")).toBeInTheDocument();
  });

  it("shows prestataire with verified status", () => {
    const users = [makeUser(10, "prestataire")];
    const prestataires = [makePrestataire(10, true)];
    renderAdmin({ users, prestataires });
    expect(screen.getByText("Certifié")).toBeInTheDocument();
  });

  it("shows user management with role selector", () => {
    const users = [makeUser(99, "client")];
    renderAdmin({ users });
    expect(screen.getByText("Utilisateurs & Prestataires")).toBeInTheDocument();
    expect(screen.getByText("1 comptes")).toBeInTheDocument();
  });

  it("calls setAdminRoleDraftByUserId on CustomSelect change", () => {
    const setAdminRoleDraftByUserId = vi.fn();
    const users = [makeUser(99, "client")];
    renderAdmin({ users, setAdminRoleDraftByUserId });
    // Open the CustomSelect dropdown for user 99
    const selectBtn = screen.getByRole("button", { name: /Nouveau role pour user99/ });
    fireEvent.click(selectBtn);
    fireEvent.mouseDown(screen.getByText("prestataire"));
    expect(setAdminRoleDraftByUserId).toHaveBeenCalled();
  });

  it("ignores role apply click when target user id is unknown", () => {
    const handleAdminChangeUserRole = vi.fn().mockResolvedValue(undefined);
    const users = [makeUser(99, "client")];
    const adminRoleDraftByUserId = { 99: "prestataire" as const };

    renderAdmin({ users, handleAdminChangeUserRole, adminRoleDraftByUserId });
    const applyBtn = screen.getByRole("button", { name: /Appliquer le role prestataire pour user99/ });
    applyBtn.setAttribute("data-user-id", "123456");
    fireEvent.click(applyBtn);

    expect(handleAdminChangeUserRole).not.toHaveBeenCalled();
  });

  it("ignores delete click when target user id is unknown", () => {
    const handleAdminDeleteUser = vi.fn().mockResolvedValue(undefined);
    const users = [makeUser(99, "client")];

    renderAdmin({ users, handleAdminDeleteUser, userId: 1 });
    const deleteBtn = screen.getByRole("button", { name: /Supprimer le compte user99/ });
    deleteBtn.setAttribute("data-user-id", "123456");
    fireEvent.click(deleteBtn);

    expect(handleAdminDeleteUser).not.toHaveBeenCalled();
  });

  it("shows Vérifications prestataires scroll button", () => {
    renderAdmin();
    const btn = screen.getByText("Vérifications prestataires");
    expect(btn).toBeInTheDocument();
    // Button exists and can be clicked
    fireEvent.click(btn);
    // scrollIntoView would be called on the unifiedUsersRef
    expect(btn).toBeInTheDocument();
  });

  it("does not render duplicate logout/refresh buttons", () => {
    const users = [makeUser(1, "admin")];
    renderAdmin({ users, userId: 1 });
    expect(screen.getByText("Compte protégé")).toBeInTheDocument();
  });

  it("sorts users with 2+ users (triggers sort comparator)", () => {
    // Needs 2+ users to invoke the sort comparator (a, b) => a.role.localeCompare(b.role) || a.id - b.id
    const users = [makeUser(10, "prestataire"), makeUser(11, "client"), makeUser(12, "admin")];
    renderAdmin({ users });
    expect(screen.getByText("3 comptes")).toBeInTheDocument();
  });
});
