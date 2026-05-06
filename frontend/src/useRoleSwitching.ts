import { useMemo, useState } from "react";
import { sessionToClaims } from "./utils";

type Role = "client" | "prestataire" | "admin";
export type SwitchableRole = Extract<Role, "client" | "prestataire">;

type JwtClaims = {
  sub?: string;
  role?: Role;
  username?: string;
  exp?: number;
};

type SessionResponse = {
  sub: string;
  role: Role;
  username: string;
  exp: number;
  active_role: Role;
  available_roles: Role[];
};

type ToastPayload = {
  kind: "ok" | "err";
  message: string;
};

type UseRoleSwitchingParams = {
  activeRole?: Role;
  availableRoles: Role[];
  setClaims: (claims: JwtClaims | null) => void;
  setAvailableRoles: (roles: Role[]) => void;
  setToast: (payload: ToastPayload) => void;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  normalizeAvailableRoles: (raw: Role[] | undefined, fallbackRole?: Role) => Role[];
};

type UseRoleSwitchingResult = {
  switchableRoles: SwitchableRole[];
  canSwitchRole: boolean;
  addRolePending: boolean;
  switchRolePending: boolean;
  handleAddRole: (newRole: SwitchableRole) => Promise<void>;
  handleSwitchRole: (nextRole: SwitchableRole) => Promise<void>;
};

export function useRoleSwitching({
  activeRole,
  availableRoles,
  setClaims,
  setAvailableRoles,
  setToast,
  apiFetch,
  normalizeAvailableRoles,
}: UseRoleSwitchingParams): UseRoleSwitchingResult {
  const [switchRolePending, setSwitchRolePending] = useState(false);
  const [addRolePending, setAddRolePending] = useState(false);

  const switchableRoles = useMemo(
    () =>
      availableRoles.filter(
        (item): item is SwitchableRole => item === "client" || item === "prestataire"
      ),
    [availableRoles]
  );

  const canSwitchRole = Boolean(activeRole && activeRole !== "admin" && switchableRoles.length > 1);

  async function handleAddRole(newRole: SwitchableRole): Promise<void> {
    try {
      setAddRolePending(true);
      const result = await apiFetch<SessionResponse>("/auth/add-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      setAvailableRoles(normalizeAvailableRoles(result.available_roles, result.active_role));
      setClaims(sessionToClaims(result));
      setToast({
        kind: "ok",
        message:
          newRole === "prestataire"
            ? "Profil prestataire activé ! Vous pouvez maintenant switcher."
            : "Profil client activé ! Vous pouvez maintenant switcher.",
      });
    } catch (error) {
      setToast({
        kind: "err",
        message: error instanceof Error ? error.message : "Impossible d'ajouter ce rôle",
      });
    } finally {
      setAddRolePending(false);
    }
  }

  async function handleSwitchRole(nextRole: SwitchableRole): Promise<void> {
    if (!activeRole || activeRole === nextRole) {
      return;
    }

    try {
      setSwitchRolePending(true);
      const result = await apiFetch<SessionResponse>("/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      setAvailableRoles(normalizeAvailableRoles(result.available_roles, result.active_role));
      setClaims(sessionToClaims(result));
      setToast({
        kind: "ok",
        message:
          nextRole === "client"
            ? "Bascule vers l'espace client effectuée."
            : "Bascule vers l'espace prestataire effectuée.",
      });
    } catch (error) {
      setToast({
        kind: "err",
        message: error instanceof Error ? error.message : "Changement de rôle impossible",
      });
    } finally {
      setSwitchRolePending(false);
    }
  }

  return {
    switchableRoles,
    canSwitchRole,
    addRolePending,
    switchRolePending,
    handleAddRole,
    handleSwitchRole,
  };
}
