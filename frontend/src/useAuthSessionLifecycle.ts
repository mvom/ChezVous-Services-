import { useEffect, useRef } from "react";

import type { AuthRolesResponse, JwtClaims, Role, SessionResponse, ToastState } from "./types";

type UseAuthSessionLifecycleDeps = {
  claims: JwtClaims | null;
  availableRoles: Role[];
  setClaims: (claims: JwtClaims | null) => void;
  setAvailableRoles: (roles: Role[]) => void;
  setToast: (toast: ToastState) => void;
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  normalizeAvailableRoles: (raw: Role[] | undefined, fallbackRole?: Role) => Role[];
  sessionToClaims: (response: SessionResponse) => JwtClaims;
  refreshDashboard: (claims: JwtClaims) => Promise<void>;
  onSessionExpired: () => void;
};

const TOKEN_REFRESH_SKEW_SECONDS = 90;

function isTokenExpired(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp <= nowEpochSeconds;
}

function shouldRefreshToken(claims?: JwtClaims | null, nowEpochSeconds = Date.now() / 1000): boolean {
  if (!claims?.exp) return false;
  return claims.exp - nowEpochSeconds <= TOKEN_REFRESH_SKEW_SECONDS;
}

export function useAuthSessionLifecycle({
  claims,
  availableRoles,
  setClaims,
  setAvailableRoles,
  setToast,
  apiFetch,
  normalizeAvailableRoles,
  sessionToClaims,
  refreshDashboard,
  onSessionExpired,
}: UseAuthSessionLifecycleDeps): void {
  const tokenRefreshPendingRef = useRef(false);

  async function refreshSessionToken(): Promise<boolean> {
    if (tokenRefreshPendingRef.current) {
      return false;
    }
    tokenRefreshPendingRef.current = true;
    try {
      const result = await apiFetch<SessionResponse>("/auth/refresh", { method: "POST" });
      if (!result.role) {
        throw new Error("Session invalide");
      }
      setClaims(sessionToClaims(result));
      setAvailableRoles(normalizeAvailableRoles(result.available_roles, result.role));
      return true;
    } catch {
      setToast({ kind: "err", message: "Session expirée, veuillez vous reconnecter." });
      setClaims(null);
      onSessionExpired();
      return false;
    } finally {
      tokenRefreshPendingRef.current = false;
    }
  }

  useEffect(() => {
    apiFetch<SessionResponse>("/auth/refresh", { method: "POST" })
      .then((result) => {
        if (!result.role) return;
        const nextClaims = sessionToClaims(result);
        setClaims(nextClaims);
        setAvailableRoles(normalizeAvailableRoles(result.available_roles, result.role));
        void refreshDashboard(nextClaims);
      })
      .catch(() => {
        // No active session - stay on home page.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!claims?.exp) {
      return undefined;
    }

    const maybeRefresh = async () => {
      if (isTokenExpired(claims)) {
        setToast({ kind: "err", message: "Session expirée, veuillez vous reconnecter." });
        setClaims(null);
        onSessionExpired();
        return;
      }

      if (shouldRefreshToken(claims)) {
        await refreshSessionToken();
      }
    };

    void maybeRefresh();
    const intervalId = window.setInterval(() => {
      void maybeRefresh();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [claims?.exp]);

  useEffect(() => {
    if (!claims?.role || claims.role === "admin" || availableRoles.length > 1) {
      return;
    }

    let cancelled = false;
    apiFetch<AuthRolesResponse>("/auth/me/roles")
      .then((result) => {
        if (cancelled) {
          return;
        }
        const normalized = normalizeAvailableRoles(result.available_roles, claims.role);
        if (normalized.join("|") !== availableRoles.join("|")) {
          setAvailableRoles(normalized);
        }
      })
      .catch(() => {
        // Best effort sync.
      });

    return () => {
      cancelled = true;
    };
  }, [claims?.role, availableRoles]);
}
