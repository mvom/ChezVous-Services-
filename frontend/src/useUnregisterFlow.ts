import { useState } from "react";
import type { ToastState } from "./types";

type UseUnregisterFlowDeps = {
  modalCloseMs: number;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  setToast: (toast: ToastState) => void;
  logout: () => void;
  navigateHome: () => void;
};

export function useUnregisterFlow({
  modalCloseMs,
  apiFetch,
  setToast,
  logout,
  navigateHome,
}: UseUnregisterFlowDeps) {
  const [unregisterModalOpen, setUnregisterModalOpen] = useState(false);
  const [unregisterPassword, setUnregisterPassword] = useState("");
  const [unregisterPending, setUnregisterPending] = useState(false);
  const [unregisterModalClosing, setUnregisterModalClosing] = useState(false);

  function handleUnregister(): void {
    setUnregisterModalClosing(false);
    setUnregisterPassword("");
    setUnregisterModalOpen(true);
  }

  function closeUnregisterModal(): void {
    if (unregisterPending) {
      return;
    }
    setUnregisterModalClosing(true);
    window.setTimeout(() => {
      setUnregisterModalOpen(false);
      setUnregisterPassword("");
      setUnregisterModalClosing(false);
    }, modalCloseMs);
  }

  async function confirmUnregister(): Promise<void> {
    if (unregisterPassword.trim().length === 0) {
      setToast({ kind: "err", message: "Entrez votre mot de passe pour confirmer." });
      return;
    }

    try {
      setUnregisterPending(true);
      await apiFetch<{ detail: string }>("/auth/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unregisterPassword }),
      });
      logout();
      setToast({ kind: "ok", message: "Compte supprimé. Vérification dans MailHog." });
      closeUnregisterModal();
      navigateHome();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Désinscription impossible" });
    } finally {
      setUnregisterPending(false);
    }
  }

  return {
    unregisterModalOpen,
    unregisterPassword,
    unregisterPending,
    unregisterModalClosing,
    setUnregisterPassword,
    handleUnregister,
    closeUnregisterModal,
    confirmUnregister,
  };
}
