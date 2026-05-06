import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  Demande,
  DemandeCategory,
  EditDemandeDraft,
  ToastState,
} from "./types";

type UseDemandeModalsDeps<TClaims> = {
  claims: TClaims | null;
  modalCloseMs: number;
  cleanGeo: (value?: string | null) => string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  setToast: (toast: ToastState) => void;
  refreshDashboard: (claims: TClaims) => Promise<void>;
};

export function useDemandeModals<TClaims>({
  claims,
  modalCloseMs,
  cleanGeo,
  apiFetch,
  setToast,
  refreshDashboard,
}: UseDemandeModalsDeps<TClaims>) {
  const [demandeCancelId, setDemandeCancelId] = useState<number | null>(null);
  const [editDemandeTarget, setEditDemandeTarget] = useState<Demande | null>(null);
  const [editDemandeDraft, setEditDemandeDraft] = useState<EditDemandeDraft | null>(null);
  const [editDemandePending, setEditDemandePending] = useState(false);
  const [demandDetailClosing, setDemandDetailClosing] = useState(false);
  const [editModalClosing, setEditModalClosing] = useState(false);
  const [cancelModalClosing, setCancelModalClosing] = useState(false);
  const [selectedDemandForDetail, setSelectedDemandForDetail] = useState<Demande | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);

  function scheduleModalClose(callback: () => void): void {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, modalCloseMs);
    timeoutIdsRef.current.push(timeoutId);
  }

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIdsRef.current = [];
    };
  }, []);

  function openDemandDetailModal(demande: Demande): void {
    setDemandDetailClosing(false);
    setSelectedDemandForDetail(demande);
  }

  function closeDemandDetailModal(): void {
    setDemandDetailClosing(true);
    scheduleModalClose(() => {
      setSelectedDemandForDetail(null);
      setDemandDetailClosing(false);
    });
  }

  function handleEditDemande(demande: Demande): void {
    if (demande.status !== "ouverte") {
      setToast({ kind: "err", message: "La demande ne peut plus être modifiée après acceptation." });
      return;
    }

    setEditModalClosing(false);
    setEditDemandeTarget(demande);
    setEditDemandeDraft({
      category: (demande.category || "menage") as DemandeCategory,
      description: demande.description,
      ville: cleanGeo(demande.ville),
      arrondissement: cleanGeo(demande.arrondissement),
      quartier: cleanGeo(demande.quartier),
      client_availability_mode: ((demande.client_availability_mode || "flexible").toLowerCase() === "fixe" ? "fixe" : "flexible"),
      client_availability_note: demande.client_availability_note || "",
      priority: demande.priority || "normale",
      sub_services: demande.sub_services || [],
    });
  }

  function closeEditDemandeModal(): void {
    if (editDemandePending) {
      return;
    }
    setEditModalClosing(true);
    scheduleModalClose(() => {
      setEditDemandeTarget(null);
      setEditDemandeDraft(null);
      setEditModalClosing(false);
    });
  }

  async function handleConfirmEditDemande(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editDemandeTarget || !editDemandeDraft) {
      return;
    }

    const description = editDemandeDraft.description.trim();
    const category = editDemandeDraft.category;
    const ville = editDemandeDraft.ville.trim();
    const arrondissement = editDemandeDraft.arrondissement.trim();
    const quartier = editDemandeDraft.quartier.trim();
    const availabilityMode = editDemandeDraft.client_availability_mode;
    const availabilityNote = editDemandeDraft.client_availability_note.trim();

    if (description.length < 5 || ville.length < 2 || arrondissement.length < 2 || quartier.length < 2) {
      setToast({ kind: "err", message: "Completez correctement les champs de la demande." });
      return;
    }

    if (availabilityMode === "fixe" && availabilityNote.length < 5) {
      setToast({ kind: "err", message: "Merci de préciser une disponibilité fixe." });
      return;
    }

    try {
      setEditDemandePending(true);
      await apiFetch<Demande>(`/demandes/${editDemandeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          category,
          ville,
          arrondissement,
          quartier,
          location: [ville, arrondissement, quartier].join(", "),
          client_availability_mode: availabilityMode,
          client_availability_note: availabilityNote || null,
          priority: editDemandeDraft.priority || "normale",
          sub_services: editDemandeDraft.sub_services || [],
        }),
      });
      setToast({ kind: "ok", message: "Demande mise à jour." });
      closeEditDemandeModal();
      if (claims) {
        await refreshDashboard(claims);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Mise à jour impossible" });
    } finally {
      setEditDemandePending(false);
    }
  }

  function handleCancelDemande(demandeId: number): void {
    setCancelModalClosing(false);
    setDemandeCancelId(demandeId);
  }

  function closeCancelDemandeModal(): void {
    setCancelModalClosing(true);
    scheduleModalClose(() => {
      setDemandeCancelId(null);
      setCancelModalClosing(false);
    });
  }

  async function confirmCancelDemande(): Promise<void> {
    if (!claims || demandeCancelId == null) {
      return;
    }
    try {
      await apiFetch<Demande>(`/demandes/${demandeCancelId}/cancel`, {
        method: "POST",
      });
      setToast({ kind: "ok", message: "Demande annulee." });
      closeCancelDemandeModal();
      if (claims) {
        await refreshDashboard(claims);
      }
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Annulation impossible" });
    }
  }

  return {
    demandeCancelId,
    editDemandeTarget,
    editDemandeDraft,
    editDemandePending,
    demandDetailClosing,
    editModalClosing,
    cancelModalClosing,
    selectedDemandForDetail,
    setEditDemandeDraft,
    openDemandDetailModal,
    closeDemandDetailModal,
    handleEditDemande,
    closeEditDemandeModal,
    handleConfirmEditDemande,
    handleCancelDemande,
    closeCancelDemandeModal,
    confirmCancelDemande,
  };
}
