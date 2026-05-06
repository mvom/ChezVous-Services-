import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Demande } from "./types";

import { useDemandeModals } from "./useDemandeModals";

function makeDemande(overrides: Partial<Demande> = {}): Demande {
  return {
    id: 1,
    client_id: 1,
    category: "menage",
    status: "ouverte",
    priority: "normale",
    description: "Demande test assez longue",
    location: "Bastos",
    ville: "Yaounde",
    arrondissement: "Y2",
    quartier: "Bastos",
    client_availability_mode: "flexible",
    client_availability_note: "",
    sub_services: [],
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
    events: [],
    ...overrides,
  };
}

describe("useDemandeModals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeHook(overrides: Partial<Parameters<typeof useDemandeModals>[0]> = {}) {
    const deps = {
      claims: { sub: "1" },
      modalCloseMs: 180,
      cleanGeo: (v?: string | null) => (v || "").trim(),
      apiFetch: vi.fn(),
      setToast: vi.fn(),
      refreshDashboard: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };

    const hook = renderHook(() => useDemandeModals(deps));
    return { ...hook, deps };
  }

  it("opens and closes demand detail modal", () => {
    const { result } = makeHook();
    const demande = makeDemande();

    act(() => {
      result.current.openDemandDetailModal(demande);
    });
    expect(result.current.selectedDemandForDetail?.id).toBe(1);

    act(() => {
      result.current.closeDemandDetailModal();
      vi.advanceTimersByTime(180);
    });
    expect(result.current.selectedDemandForDetail).toBeNull();
  });

  it("blocks edit when demande status is not ouverte", () => {
    const { result, deps } = makeHook();

    act(() => {
      result.current.handleEditDemande(makeDemande({ status: "attribuee" }));
    });

    expect(deps.setToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "err" })
    );
  });

  it("opens edit draft for an ouverte demande", () => {
    const { result } = makeHook();

    act(() => {
      result.current.handleEditDemande(makeDemande());
    });

    expect(result.current.editDemandeTarget?.id).toBe(1);
    expect(result.current.editDemandeDraft?.category).toBe("menage");
  });

  it("confirms cancel demande and refreshes dashboard", async () => {
    const { result, deps } = makeHook({
      apiFetch: vi.fn().mockResolvedValue(makeDemande({ status: "annulee" })),
    });

    act(() => {
      result.current.handleCancelDemande(1);
    });

    await act(async () => {
      await result.current.confirmCancelDemande();
    });

    expect(deps.apiFetch).toHaveBeenCalledWith(
      "/demandes/1/cancel",
      expect.objectContaining({ method: "POST" })
    );
    expect(deps.refreshDashboard).toHaveBeenCalled();
  });

  it("closes edit demande modal with timer", () => {
    const { result } = makeHook();

    act(() => {
      result.current.handleEditDemande(makeDemande());
    });
    expect(result.current.editDemandeTarget?.id).toBe(1);

    act(() => {
      result.current.closeEditDemandeModal();
      vi.advanceTimersByTime(180);
    });
    expect(result.current.editDemandeTarget).toBeNull();
  });

  it("confirms edit demande and refreshes dashboard", async () => {
    const apiFetch = vi.fn().mockResolvedValue(makeDemande());
    const { result, deps } = makeHook({ apiFetch });

    act(() => {
      result.current.handleEditDemande(makeDemande());
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as import("react").FormEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleConfirmEditDemande(fakeEvent);
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/demandes/1",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(deps.refreshDashboard).toHaveBeenCalled();
  });

  it("confirms edit demande fails validation when description is short", async () => {
    const { result, deps } = makeHook();

    act(() => {
      result.current.handleEditDemande(makeDemande({ description: "ab" }));
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as import("react").FormEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleConfirmEditDemande(fakeEvent);
    });

    expect(deps.setToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "err" }));
  });

  it("closes cancel demande modal with timer", () => {
    const { result } = makeHook();

    act(() => {
      result.current.handleCancelDemande(1);
    });
    expect(result.current.demandeCancelId).toBe(1);

    act(() => {
      result.current.closeCancelDemandeModal();
      vi.advanceTimersByTime(180);
    });
    expect(result.current.demandeCancelId).toBeNull();
  });
});
