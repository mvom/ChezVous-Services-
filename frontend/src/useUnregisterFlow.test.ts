import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUnregisterFlow } from "./useUnregisterFlow";

describe("useUnregisterFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeHook(overrides: Partial<Parameters<typeof useUnregisterFlow>[0]> = {}) {
    const deps = {
      modalCloseMs: 180,
      apiFetch: vi.fn(),
      setToast: vi.fn(),
      logout: vi.fn(),
      navigateHome: vi.fn(),
      ...overrides,
    };

    const hook = renderHook(() => useUnregisterFlow(deps));
    return { ...hook, deps };
  }

  it("opens unregister modal", () => {
    const { result } = makeHook();
    act(() => {
      result.current.handleUnregister();
    });
    expect(result.current.unregisterModalOpen).toBe(true);
  });

  it("closes unregister modal after timeout", () => {
    const { result } = makeHook();
    act(() => {
      result.current.handleUnregister();
      result.current.closeUnregisterModal();
    });
    expect(result.current.unregisterModalClosing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(result.current.unregisterModalOpen).toBe(false);
    expect(result.current.unregisterModalClosing).toBe(false);
  });

  it("shows validation error when password is empty", async () => {
    const { result, deps } = makeHook();
    await act(async () => {
      await result.current.confirmUnregister();
    });
    expect(deps.setToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "err" })
    );
  });

  it("calls unregister endpoint and logout flow", async () => {
    const { result, deps } = makeHook({
      apiFetch: vi.fn().mockResolvedValue({ detail: "ok" }),
    });

    act(() => {
      result.current.handleUnregister();
      result.current.setUnregisterPassword("secret");
    });

    await act(async () => {
      await result.current.confirmUnregister();
    });

    expect(deps.apiFetch).toHaveBeenCalledWith(
      "/auth/unregister",
      expect.objectContaining({ method: "POST" })
    );
    expect(deps.logout).toHaveBeenCalled();
    expect(deps.navigateHome).toHaveBeenCalled();
  });
});
