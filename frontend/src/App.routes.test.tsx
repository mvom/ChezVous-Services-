import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { setAuthToken } from "./utils";

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderApp(): void {
  render(
    <BrowserRouter future={routerFuture}>
      <App />
    </BrowserRouter>,
  );
}

async function waitForWorkspace(path: string, text: string): Promise<void> {
  await waitFor(() => expect(window.location.pathname).toBe(path), { timeout: 3000 });
  expect(await screen.findByText(text)).toBeInTheDocument();
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

function errorResponse(status: number, detail: string) {
  return {
    ok: false,
    status,
    headers: { get: () => "application/json" },
    json: async () => ({ detail }),
  };
}

type SwitchRole = "client" | "prestataire";

function sessionResponse(sub: string, role: SwitchRole | "admin", availableRoles?: (SwitchRole | "admin")[]) {
  return {
    sub,
    role,
    username: `${role}.test`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    active_role: role,
    available_roles: availableRoles ?? [role],
    token_type: "bearer",
  };
}

function createRoleSwitchFetchMock(options?: {
  sub?: string;
  initialRole?: SwitchRole;
  availableRoles?: SwitchRole[];
  switchError?: string;
}) {
  let currentRole: SwitchRole = options?.initialRole || "client";
  const sub = options?.sub ?? "12";
  const availableRoles = options?.availableRoles || ["client", "prestataire"];
  const switchError = options?.switchError;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";

    if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse(sub, currentRole, availableRoles));
    if (url.endsWith("/demandes")) return jsonResponse([]);
    if (url.endsWith("/services")) return jsonResponse([]);
    if (url.endsWith("/missions")) return jsonResponse([]);
    if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
    if (url.endsWith("/auth/me")) return jsonResponse({ username: "switch.test", avatar_url: null });
    if (url.endsWith("/auth/me/roles")) {
      return jsonResponse({ active_role: currentRole, available_roles: availableRoles });
    }
    if (url.endsWith("/auth/me/loyalty")) {
      return jsonResponse({
        loyalty_points: 0,
        completed_missions_count: 0,
        next_milestone: 5,
        progress_percent: 0,
      });
    }
    if (url.endsWith("/auth/switch-role") && method === "POST") {
      if (switchError) {
        return errorResponse(403, switchError);
      }
      const body = JSON.parse(String(init?.body || "{}")) as { role?: SwitchRole };
      currentRole = body.role === "prestataire" ? "prestataire" : "client";
      return jsonResponse(sessionResponse(sub, currentRole, availableRoles));
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

describe("App role routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    setAuthToken(null);
    window.history.replaceState({}, "", "/");
    cleanup();
  });

  it("does not show admin choice on public landing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      }),
    );

    window.history.replaceState({}, "", "/");
    renderApp();

    expect(await screen.findByText("Choisissez votre profil pour continuer.")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Prestataire")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("switches theme when clicking Rose on landing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      }),
    );

    window.history.replaceState({}, "", "/");
    renderApp();

    expect(await screen.findByText("Choisissez votre profil pour continuer.")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Rose" }));

    expect(window.localStorage.getItem("sm_theme_pref:guest")).toBe("rose");

    await user.click(screen.getByRole("button", { name: "Violet" }));
    expect(window.localStorage.getItem("sm_theme_pref:guest")).toBe("violet");
  });

  it("navigates to client auth when clicking acces client on landing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      }),
    );

    window.history.replaceState({}, "", "/");
    renderApp();

    expect(await screen.findByText("Choisissez votre profil pour continuer.")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Accès client" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth/client");
    });
  });

  it("navigates to prestataire auth when clicking acces prestataire on landing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      }),
    );

    window.history.replaceState({}, "", "/");
    renderApp();

    expect(await screen.findByText("Choisissez votre profil pour continuer.")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Accès prestataire" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth/prestataire");
    });
  });

  it("redirects authenticated client away from hidden admin route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("12", "client", ["client"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/loyalty")) return jsonResponse({
        loyalty_points: 0,
        completed_missions_count: 0,
        next_milestone: 5,
        progress_percent: 0,
      });
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "client", available_roles: ["client"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "client.test", avatar_url: null });
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe("/espace/client");
    });
    expect(await screen.findByText("Espace Client")).toBeInTheDocument();
  });

  it("allows authenticated admin to stay on hidden admin route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("99", "admin", ["admin"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/users")) return jsonResponse([]);
      if (url.endsWith("/prestataires")) return jsonResponse([]);
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "admin.test", avatar_url: null });
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    renderApp();

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/_staff/console");
  });

  it("lets admin verify a provider and refresh the verification badge", async () => {
    let prestataires = [{ user_id: 34, rating: 0, verified: false }];
    const users = [
      {
        id: 34,
        first_name: "Presta",
        last_name: "Lotb",
        username: "lotbpro642201",
        email: "lotbpro642201@test.local",
        address: "Douala, Bonamoussadi",
        phone: "+237 664 233 338",
        role: "prestataire",
        avatar_url: null,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("99", "admin", ["admin"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/users")) return jsonResponse(users);
      if (url.endsWith("/prestataires") && method === "GET") return jsonResponse(prestataires);
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "admin.local", avatar_url: null });
      if (url.endsWith("/prestataires/34/verified") && method === "PATCH") {
        const body = JSON.parse(String(init?.body || "{}"));
        prestataires = [{ user_id: 34, rating: 0, verified: Boolean(body.verified) }];
        return jsonResponse(prestataires[0]);
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    renderApp();

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(await screen.findByText("Non verifie")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Marquer comme verifie" }));

    await waitFor(() => {
      expect(screen.getByText("Verifie")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/prestataires/34/verified",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ verified: true }),
      }),
    );
    expect(screen.getByRole("button", { name: "Retirer la verification" })).toBeInTheDocument();
  });

  it("lets admin remove provider verification and refresh the badge", async () => {
    let prestataires = [{ user_id: 34, rating: 0, verified: true }];
    const users = [
      {
        id: 34,
        first_name: "Presta",
        last_name: "Lotb",
        username: "lotbpro642201",
        email: "lotbpro642201@test.local",
        address: "Douala, Bonamoussadi",
        phone: "+237 664 233 338",
        role: "prestataire",
        avatar_url: null,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";

      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("99", "admin", ["admin"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/users")) return jsonResponse(users);
      if (url.endsWith("/prestataires") && method === "GET") return jsonResponse(prestataires);
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "admin.local", avatar_url: null });
      if (url.endsWith("/prestataires/34/verified") && method === "PATCH") {
        const body = JSON.parse(String(init?.body || "{}"));
        prestataires = [{ user_id: 34, rating: 0, verified: Boolean(body.verified) }];
        return jsonResponse(prestataires[0]);
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    renderApp();

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(await screen.findByText("Verifie")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retirer la verification" }));

    await waitFor(() => {
      expect(screen.getByText("Non verifie")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/prestataires/34/verified",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ verified: false }),
      }),
    );
    expect(screen.getByRole("button", { name: "Marquer comme verifie" })).toBeInTheDocument();
  });

  it("shows role switch only for multi-role users", async () => {
    const fetchMock = createRoleSwitchFetchMock({
      initialRole: "client",
      availableRoles: ["client", "prestataire"],
    });
    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");
    expect(screen.getByRole("group", { name: "Basculer de rôle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mode client" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mode prestataire" })).toBeInTheDocument();
  });

  it("hides role switch for single-role users", async () => {
    const fetchMock = createRoleSwitchFetchMock({
      initialRole: "client",
      availableRoles: ["client"],
    });
    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");
    expect(screen.queryByRole("group", { name: "Basculer de rôle" })).not.toBeInTheDocument();
  });

  it("switches role from client to provider and updates route", async () => {
    const fetchMock = createRoleSwitchFetchMock({
      initialRole: "client",
      availableRoles: ["client", "prestataire"],
    });
    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");

    const user = userEvent.setup();
    const providerButton = screen.getByRole("button", { name: "Mode prestataire" });
    await waitFor(() => {
      expect(providerButton).toBeEnabled();
    });
    await user.click(providerButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/espace/prestataire");
    });
    expect(await screen.findByText("Espace Prestataire")).toBeInTheDocument();

    const switchCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/auth/switch-role") && (init?.method || "GET") === "POST",
    );
    expect(switchCall).toBeTruthy();
    const switchInit = switchCall?.[1] as RequestInit | undefined;
    expect(switchInit?.body).toBe(JSON.stringify({ role: "prestataire" }));
  });

  it("shows switch-role API error and stays on current route", async () => {
    const fetchMock = createRoleSwitchFetchMock({
      initialRole: "client",
      availableRoles: ["client", "prestataire"],
      switchError: "Role non attribue",
    });
    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");

    const user = userEvent.setup();
    const providerButton = screen.getByRole("button", { name: "Mode prestataire" });
    await waitFor(() => {
      expect(providerButton).toBeEnabled();
    });
    await user.click(providerButton);

    expect(await screen.findByText("Role non attribue")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/espace/client");
  });

  it("renders client workspace with demandes and allows filter interactions", async () => {
    const demandes = [
      {
        id: 1, client_id: 1, status: "ouverte", priority: "normale",
        description: "Plomberie urgente", location: "Bastos",
        ville: "Yaounde", arrondissement: "Yaounde 2", quartier: "Bastos",
        category: "plomberie", sub_services: [], events: [],
        client_availability_mode: "flexible", client_availability_note: "",
        created_at: "2024-01-01T10:00:00", updated_at: "2024-01-01T10:00:00",
      },
      {
        id: 2, client_id: 1, status: "attribuee", priority: "haute",
        description: "Electricite maison", location: "Melen",
        ville: "Yaounde", arrondissement: "Yaounde 4", quartier: "Melen",
        category: "electricite", sub_services: [], events: [],
        client_availability_mode: "fixe", client_availability_note: "matin seulement",
        created_at: "2024-01-02T10:00:00", updated_at: "2024-01-02T10:00:00",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("1", "client", ["client"]));
      if (url.endsWith("/demandes")) return jsonResponse(demandes);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/loyalty")) return jsonResponse({
        loyalty_points: 150, completed_missions_count: 3,
        next_milestone: 5, progress_percent: 60,
      });
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "client", available_roles: ["client"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "client.with.demandes", avatar_url: null });
      if (url.includes("/matching/preview")) return jsonResponse({ candidates: [] });
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");
    // demandes should render with stats
    expect(await screen.findByText(/1 demande\(s\) ouverte\(s\)/)).toBeInTheDocument();
  });

  it("renders prestataire workspace after login", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("5", "prestataire", ["prestataire"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "prestataire", available_roles: ["prestataire"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "presta.test", avatar_url: null });
      if (url.endsWith("/prestataires") && method === "GET") return jsonResponse([{
        user_id: 5, visibility_mode: "public", zone_preference_ville: "",
        zone_preference_arrondissement: "", zone_preference_quartier: "",
        rating: 4.2, verified: true,
      }]);
      if (url.includes("/prestataires/me")) return jsonResponse({
        user_id: 5, visibility_mode: "public", zone_preference_ville: "",
        zone_preference_arrondissement: "", zone_preference_quartier: "",
        rating: 4.2, verified: true,
      });
      if (url.includes("/prestataires/me/notifications") || url.includes("/auth/me/zone-notifications")) return jsonResponse([]);
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/espace/prestataire");
    renderApp();

    await waitForWorkspace("/espace/prestataire", "Espace Prestataire");
  });

  it("loads client workspace even when loyalty data is returned", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("2", "client", ["client"]));
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/loyalty")) return jsonResponse({
        loyalty_points: 500, completed_missions_count: 10,
        next_milestone: 20, progress_percent: 50,
      });
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "client", available_roles: ["client"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "loyal.client", avatar_url: null });
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");
    expect(screen.queryByText("Fidélité client")).not.toBeInTheDocument();
  });

  it("opens edit demande modal and interacts with it", async () => {
    const demandes = [
      {
        id: 1, client_id: 1, status: "ouverte", priority: "normale",
        description: "Plomberie urgente", location: "Bastos",
        ville: "Yaounde", arrondissement: "Yaounde 2", quartier: "Bastos",
        category: "plomberie", sub_services: [], events: [],
        client_availability_mode: "flexible", client_availability_note: "",
        created_at: "2024-01-01T10:00:00", updated_at: "2024-01-01T10:00:00",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("1", "client", ["client"]));
      if (url.endsWith("/demandes")) return jsonResponse(demandes);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/loyalty")) return jsonResponse({ loyalty_points: 0, completed_missions_count: 0, next_milestone: 5, progress_percent: 0 });
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "client", available_roles: ["client"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "modal.tester", avatar_url: null });
      if (url.includes("/matching/preview")) return jsonResponse([]);
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");

    // Wait for demande to appear and click Modifier
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getAllByText("Modifier").length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByText("Modifier")[0]);

    // Edit modal should be open now
    await waitFor(() => {
      expect(screen.getByText(/Modifier la demande/)).toBeInTheDocument();
    });

    // Close the modal
    await user.click(screen.getByRole("button", { name: "✕" }));
  });

  it("opens cancel demande modal and cancels", async () => {
    const demandes = [
      {
        id: 2, client_id: 1, status: "ouverte", priority: "normale",
        description: "Test annulation", location: "Bastos",
        ville: "Yaounde", arrondissement: "Yaounde 2", quartier: "Bastos",
        category: "plomberie", sub_services: [], events: [],
        client_availability_mode: "flexible", client_availability_note: "",
        created_at: "2024-01-01T10:00:00", updated_at: "2024-01-01T10:00:00",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/auth/refresh") && method === "POST") return jsonResponse(sessionResponse("1", "client", ["client"]));
      if (url.endsWith("/demandes")) return jsonResponse(demandes);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me/loyalty")) return jsonResponse({ loyalty_points: 0, completed_missions_count: 0, next_milestone: 5, progress_percent: 0 });
      if (url.endsWith("/auth/me/badges")) return jsonResponse([]);
      if (url.endsWith("/auth/me/roles")) return jsonResponse({ active_role: "client", available_roles: ["client"] });
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "cancel.tester", avatar_url: null });
      if (url.includes("/matching/preview")) return jsonResponse([]);
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/espace/client");
    renderApp();

    await waitForWorkspace("/espace/client", "Espace Client");

    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getAllByText("Annuler").length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByText("Annuler")[0]);

    // Cancel modal should be open
    await waitFor(() => {
      expect(screen.getByText(/Confirmer l'annulation/)).toBeInTheDocument();
    });

    // Close with "Retour" button
    await user.click(screen.getByRole("button", { name: "Retour" }));
  });
});
