import { FormEvent } from "react";

import type { Demande, JwtClaims, Role, Service, SessionResponse, ToastState } from "./types";

type UseAuthActionsDeps = {
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  setClaims: (claims: JwtClaims | null) => void;
  setAvailableRoles: (roles: Role[]) => void;
  normalizeAvailableRoles: (raw: Role[] | undefined, fallbackRole?: Role) => Role[];
  sessionToClaims: (response: SessionResponse) => JwtClaims;
  refreshDashboard: (claims: JwtClaims) => Promise<void>;
  setToast: (toast: ToastState) => void;
  setLoginPending: (value: boolean) => void;
  setRegisterPending: (value: boolean) => void;
  registerAvatarDataUrl: string | null;
  queuePendingAvatarUpload: (avatarDataUrl: string) => void;
  setRegisterAvatarDataUrl: (value: string | null) => void;
  setDemandes: (value: Demande[]) => void;
  setServices: (value: Service[]) => void;
  setMissions: (value: import("./types").Mission[]) => void;
  userFacingError: (error: unknown, fallbackMessage: string, context: string) => string;
};

function formatCameroonPhone(value: string): string {
  const compact = value.replace(/\s+/g, "").trim();
  const normalized = compact.startsWith("+237") ? compact : `+237${compact.replace(/^\+/, "")}`;
  const digits = normalized.replace("+237", "");
  if (!/^\d{9}$/.test(digits)) {
    return value;
  }
  return `+237 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function normalizePersonName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return cleaned;
  }
  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function useAuthActions({
  apiFetch,
  setClaims,
  setAvailableRoles,
  normalizeAvailableRoles,
  sessionToClaims,
  refreshDashboard,
  setToast,
  setLoginPending,
  setRegisterPending,
  registerAvatarDataUrl,
  queuePendingAvatarUpload,
  setRegisterAvatarDataUrl,
  setDemandes,
  setServices,
  setMissions,
  userFacingError,
}: UseAuthActionsDeps) {
  async function handleLogin(event: FormEvent<HTMLFormElement>, expectedRole?: Role): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setLoginPending(true);
      const result = await apiFetch<SessionResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: String(formData.get("phone") || ""),
          password: String(formData.get("password") || ""),
        }),
      });

      const nextClaims = sessionToClaims(result);
      if (expectedRole && nextClaims.role !== expectedRole) {
        throw new Error("Ce compte n'est pas autorise sur cet espace");
      }

      form.reset();
      setClaims(nextClaims);
      setAvailableRoles(normalizeAvailableRoles(result.available_roles, result.active_role));
      await refreshDashboard(nextClaims);
      setToast({ kind: "ok", message: "Connexion réussie" });
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Connexion impossible" });
    } finally {
      setLoginPending(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>, role: Extract<Role, "client" | "prestataire">): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const passwordConfirmation = String(formData.get("password_confirmation") || "");
    const normalizedPhone = formatCameroonPhone(String(formData.get("phone") || ""));

    if (password !== passwordConfirmation) {
      setToast({ kind: "err", message: "Les deux mots de passe ne correspondent pas." });
      return;
    }

    try {
      setRegisterPending(true);
      await apiFetch<void>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: normalizePersonName(String(formData.get("first_name") || "")),
          last_name: normalizePersonName(String(formData.get("last_name") || "")),
          username: String(formData.get("username") || "").trim().toLowerCase(),
          email: String(formData.get("email") || "").trim().toLowerCase(),
          address: String(formData.get("address") || "").trim(),
          phone: normalizedPhone,
          password,
          role,
        }),
      });

      const loginResult = await apiFetch<SessionResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          password,
        }),
      });

      form.reset();
      if (registerAvatarDataUrl) {
        queuePendingAvatarUpload(registerAvatarDataUrl);
      }
      const registerClaims = sessionToClaims(loginResult);
      setClaims(registerClaims);
      setAvailableRoles(normalizeAvailableRoles(loginResult.available_roles, loginResult.active_role));
      setRegisterAvatarDataUrl(null);
      await refreshDashboard(registerClaims);
      setToast({ kind: "ok", message: "Inscription réussie. Redirection vers votre tableau de bord..." });
    } catch (error) {
      setToast({
        kind: "err",
        message: userFacingError(
          error,
          "Inscription enregistrée, mais la redirection vers le tableau de bord a échoué. Rechargez la page.",
          "register"
        ),
      });
    } finally {
      setRegisterPending(false);
    }
  }

  function logout(): void {
    void apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    setClaims(null);
    setAvailableRoles([]);
    setDemandes([]);
    setServices([]);
    setMissions([]);
  }

  return {
    handleLogin,
    handleRegister,
    logout,
  };
}
