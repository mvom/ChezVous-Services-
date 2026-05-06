import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRoleSwitching } from "./useRoleSwitching";

describe("useRoleSwitching", () => {
  it("computes switchable roles and canSwitchRole", () => {
    const { result } = renderHook(() =>
      useRoleSwitching({
        activeRole: "client",
        availableRoles: ["client", "prestataire", "admin"],
        setClaims: vi.fn(),
        setAvailableRoles: vi.fn(),
        setToast: vi.fn(),
        apiFetch: vi.fn(),
        normalizeAvailableRoles: vi.fn((roles) => roles || []),
      })
    );

    expect(result.current.switchableRoles).toEqual(["client", "prestataire"]);
    expect(result.current.canSwitchRole).toBe(true);
  });

  it("adds secondary role and updates claims/roles/toast", async () => {
    const setClaims = vi.fn();
    const setAvailableRoles = vi.fn();
    const setToast = vi.fn();
    const apiFetch = vi.fn().mockResolvedValue({
      sub: "1",
      role: "client",
      username: "tester",
      exp: 9999999999,
      active_role: "client",
      available_roles: ["client", "prestataire"],
    });

    const { result } = renderHook(() =>
      useRoleSwitching({
        activeRole: "client",
        availableRoles: ["client"],
        setClaims,
        setAvailableRoles,
        setToast,
        apiFetch,
        normalizeAvailableRoles: vi.fn((roles) => roles || []),
      })
    );

    await act(async () => {
      await result.current.handleAddRole("prestataire");
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/auth/add-role",
      expect.objectContaining({ method: "POST" })
    );
    expect(setAvailableRoles).toHaveBeenCalledWith(["client", "prestataire"]);
    expect(setClaims).toHaveBeenCalledWith(expect.objectContaining({ role: "client" }));
    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "ok" })
    );
  });

  it("does not call switch endpoint when next role equals active role", async () => {
    const apiFetch = vi.fn();

    const { result } = renderHook(() =>
      useRoleSwitching({
        activeRole: "client",
        availableRoles: ["client", "prestataire"],
        setClaims: vi.fn(),
        setAvailableRoles: vi.fn(),
        setToast: vi.fn(),
        apiFetch,
        normalizeAvailableRoles: vi.fn((roles) => roles || []),
      })
    );

    await act(async () => {
      await result.current.handleSwitchRole("client");
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("surfaces switch errors via toast", async () => {
    const setToast = vi.fn();
    const apiFetch = vi.fn().mockRejectedValue(new Error("Switch impossible"));

    const { result } = renderHook(() =>
      useRoleSwitching({
        activeRole: "client",
        availableRoles: ["client", "prestataire"],
        setClaims: vi.fn(),
        setAvailableRoles: vi.fn(),
        setToast,
        apiFetch,
        normalizeAvailableRoles: vi.fn((roles) => roles || []),
      })
    );

    await act(async () => {
      await result.current.handleSwitchRole("prestataire");
    });

    expect(setToast).toHaveBeenCalledWith({ kind: "err", message: "Switch impossible" });
  });
});
