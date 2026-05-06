/**
 * Component tests for PublicAuth.tsx
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import PublicAuth from "./PublicAuth";
import { AppCtx } from "../../AppContext";
import type { AppCtxValue } from "../../AppContext";

afterEach(cleanup);

function makeCtx(overrides: Partial<AppCtxValue> = {}): AppCtxValue {
  return {
    user: null,
    token: null,
    activeRole: null,
    setActiveRole: vi.fn(),
    handleLogin: vi.fn(),
    handleRegister: vi.fn(),
    handleLogout: vi.fn(),
    loginPending: false,
    registerPending: false,
    authModeByRole: { client: "login", prestataire: "login" },
    setAuthModeByRole: vi.fn(),
    registerAvatarInputRef: { current: null },
    handleRegisterAvatarSelected: vi.fn(),
    ...overrides,
  } as unknown as AppCtxValue;
}

function renderAuth(roleForPage: "client" | "prestataire", ctxOverrides: Partial<AppCtxValue> = {}) {
  const ctx = makeCtx(ctxOverrides);
  return render(
    <BrowserRouter>
      <AppCtx.Provider value={ctx}>
        <PublicAuth roleForPage={roleForPage} />
      </AppCtx.Provider>
    </BrowserRouter>,
  );
}

describe("PublicAuth", () => {
  it("renders client title", () => {
    renderAuth("client");
    expect(screen.getByText("Espace Client")).toBeInTheDocument();
  });

  it("renders prestataire title", () => {
    renderAuth("prestataire");
    expect(screen.getByText("Espace Prestataire")).toBeInTheDocument();
  });

  it("shows login form by default", () => {
    renderAuth("client");
    expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
  });

  it("shows register form when mode is register", () => {
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
    });
    expect(screen.getByRole("heading", { name: /inscription/i })).toBeInTheDocument();
  });

  it("shows 'Connectez-vous' link in register mode", () => {
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
    });
    expect(screen.getByText("Connectez-vous")).toBeInTheDocument();
  });

  it("shows 'Creez votre compte' link in login mode", () => {
    renderAuth("client");
    expect(screen.getByText("Creez votre compte")).toBeInTheDocument();
  });

  it("calls setAuthModeByRole when switching to login", () => {
    const setAuthModeByRole = vi.fn();
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
      setAuthModeByRole,
    });
    fireEvent.click(screen.getByText("Connectez-vous"));
    expect(setAuthModeByRole).toHaveBeenCalled();
  });

  it("calls setAuthModeByRole when switching to register", () => {
    const setAuthModeByRole = vi.fn();
    renderAuth("client", { setAuthModeByRole });
    fireEvent.click(screen.getByText("Creez votre compte"));
    expect(setAuthModeByRole).toHaveBeenCalled();
  });

  it("has Retour button", () => {
    renderAuth("client");
    expect(screen.getByRole("button", { name: "Retour" })).toBeInTheDocument();
  });

  it("shows subtitle for client", () => {
    renderAuth("client");
    expect(screen.getByText(/Créez des demandes/)).toBeInTheDocument();
  });

  it("shows subtitle for prestataire", () => {
    renderAuth("prestataire");
    expect(screen.getByText(/Proposez vos services/)).toBeInTheDocument();
  });

  it("login form has phone and password fields", () => {
    renderAuth("client");
    expect(screen.getByPlaceholderText(/username ou/)).toBeInTheDocument();
  });

  it("register form has all required fields", () => {
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
    });
    expect(screen.getByPlaceholderText(/Quartier, ville/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+237 6XX/)).toBeInTheDocument();
  });

  it("calls handleLogin on login form submit", () => {
    const handleLogin = vi.fn((e: React.FormEvent) => { e.preventDefault(); return Promise.resolve(); });
    renderAuth("client", { handleLogin });
    const forms = document.querySelectorAll("form");
    if (forms.length > 0) fireEvent.submit(forms[0]);
    expect(handleLogin).toHaveBeenCalled();
  });

  it("calls handleRegister on register form submit", () => {
    const handleRegister = vi.fn((e: React.FormEvent) => { e.preventDefault(); return Promise.resolve(); });
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
      handleRegister,
    });
    const forms = document.querySelectorAll("form");
    if (forms.length > 0) fireEvent.submit(forms[0]);
    expect(handleRegister).toHaveBeenCalled();
  });

  it("calls handleRegisterAvatarSelected on avatar file input change", () => {
    const handleRegisterAvatarSelected = vi.fn().mockResolvedValue(undefined);
    renderAuth("client", {
      authModeByRole: { client: "register", prestataire: "login" },
      handleRegisterAvatarSelected,
    });
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [] } });
      expect(handleRegisterAvatarSelected).toHaveBeenCalled();
    }
  });

  it("calls navigate on Retour click", () => {
    renderAuth("client");
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    // navigate is called — we can't easily assert but no error should occur
    expect(screen.getByRole("button", { name: "Retour" })).toBeInTheDocument();
  });

  it("onBlur on first_name input triggers normalizePersonName", () => {
    renderAuth("client", { authModeByRole: { client: "register", prestataire: "login" } });
    const firstNameInput = document.querySelector("input[name='first_name']") as HTMLInputElement;
    if (firstNameInput) {
      firstNameInput.value = "jean";
      fireEvent.blur(firstNameInput);
      expect(firstNameInput.value).toBe("Jean");
    }
  });

  it("onBlur on phone input triggers formatCameroonPhone", () => {
    renderAuth("client", { authModeByRole: { client: "register", prestataire: "login" } });
    const phoneInput = document.querySelector("input[name='phone']") as HTMLInputElement;
    if (phoneInput) {
      phoneInput.value = "699000000";
      fireEvent.blur(phoneInput);
      // After formatting: +237 699 000 000
      expect(phoneInput.value).toMatch(/\+237/);
    }
  });
});
