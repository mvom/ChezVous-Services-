import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function createToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
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

    expect(await screen.findByText("Choose your workspace")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Prestataire")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("redirects authenticated client away from hidden admin route", async () => {
    const clientToken = createToken({ sub: "12", role: "client" });
    window.localStorage.setItem("sm_token", clientToken);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
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
    expect(await screen.findByText("Client interface")).toBeInTheDocument();
  });

  it("allows authenticated admin to stay on hidden admin route", async () => {
    const adminToken = createToken({ sub: "99", role: "admin" });
    window.localStorage.setItem("sm_token", adminToken);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      });

    vi.stubGlobal("fetch", fetchMock);

    window.history.replaceState({}, "", "/_staff/console");
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(await screen.findByText("Admin console")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/_staff/console");
  });
});
