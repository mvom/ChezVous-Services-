import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function createToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

describe("App role routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
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
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("Choisissez votre profil pour continuer.")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Prestataire")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("redirects authenticated client away from hidden admin route", async () => {
    const clientToken = createToken({ sub: "12", role: "client" });
    window.localStorage.setItem("sm_token", clientToken);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/demandes")) return jsonResponse([]);
      if (url.endsWith("/services")) return jsonResponse([]);
      if (url.endsWith("/missions")) return jsonResponse([]);
      if (url.endsWith("/auth/me")) return jsonResponse({ username: "client.test", avatar_url: null });
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/espace/client");
    });
    expect(await screen.findByText("Espace Client")).toBeInTheDocument();
  });

  it("allows authenticated admin to stay on hidden admin route", async () => {
    const adminToken = createToken({ sub: "99", role: "admin" });
    window.localStorage.setItem("sm_token", adminToken);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
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
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/_staff/console");
  });

  it("lets admin verify a provider and refresh the verification badge", async () => {
    const adminToken = createToken({ sub: "99", role: "admin" });
    window.localStorage.setItem("sm_token", adminToken);

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
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(await screen.findByText("Non verifie")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Marquer comme verifie" }));

    await waitFor(() => {
      expect(screen.getByText("Verifie")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/prestataires/34/verified",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ verified: true }),
      }),
    );
    expect(screen.getByRole("button", { name: "Retirer la verification" })).toBeInTheDocument();
  });

  it("lets admin remove provider verification and refresh the badge", async () => {
    const adminToken = createToken({ sub: "99", role: "admin" });
    window.localStorage.setItem("sm_token", adminToken);

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
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("Console Admin")).toBeInTheDocument();
    expect(await screen.findByText("Verifie")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retirer la verification" }));

    await waitFor(() => {
      expect(screen.getByText("Non verifie")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/prestataires/34/verified",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ verified: false }),
      }),
    );
    expect(screen.getByRole("button", { name: "Marquer comme verifie" })).toBeInTheDocument();
  });
});
