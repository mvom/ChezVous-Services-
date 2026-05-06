import { useRef, useState } from "react";

import type { MatchingResult, ToastState } from "./types";

type UseClientMatchingDeps = {
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  setToast: (toast: ToastState) => void;
};

type UseClientMatchingResult = {
  matchingByDemande: Record<number, MatchingResult>;
  matchingLoadingByDemande: Record<number, boolean>;
  loadClientMatchingPreview: (demandeId: number) => Promise<void>;
  resetClientMatching: () => void;
};

export function useClientMatching({ apiFetch, setToast }: UseClientMatchingDeps): UseClientMatchingResult {
  const [matchingByDemande, setMatchingByDemande] = useState<Record<number, MatchingResult>>({});
  const [matchingLoadingByDemande, setMatchingLoadingByDemande] = useState<Record<number, boolean>>({});
  const matchingToastDemandesRef = useRef<number[]>([]);

  async function loadClientMatchingPreview(demandeId: number): Promise<void> {
    if (!demandeId) {
      return;
    }

    setMatchingLoadingByDemande((prev) => ({ ...prev, [demandeId]: true }));
    try {
      const result = await apiFetch<MatchingResult>(`/demandes/${demandeId}/matching`);
      setMatchingByDemande((prev) => ({ ...prev, [demandeId]: result }));

      const alreadyNotified = matchingToastDemandesRef.current.includes(demandeId);
      if (result.available_count > 0 && !alreadyNotified) {
        setToast({ kind: "ok", message: `${result.available_count} prestataire(s) compatible(s) dans votre zone.` });
        matchingToastDemandesRef.current = [...matchingToastDemandesRef.current, demandeId];
      }
    } catch {
      // best effort widget
    } finally {
      setMatchingLoadingByDemande((prev) => ({ ...prev, [demandeId]: false }));
    }
  }

  function resetClientMatching(): void {
    setMatchingByDemande({});
    setMatchingLoadingByDemande({});
    matchingToastDemandesRef.current = [];
  }

  return {
    matchingByDemande,
    matchingLoadingByDemande,
    loadClientMatchingPreview,
    resetClientMatching,
  };
}
