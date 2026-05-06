import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAvatarCrop } from "./useAvatarCrop";

vi.mock("./avatarUtils", () => ({
  avatarDisplaySize: vi.fn(() => ({ width: 240, height: 200 })),
  clampAvatarOffset: vi.fn((_w, _h, _z, x, y) => ({ x, y })),
  exportAvatarCrop: vi.fn(async () => "data:image/jpeg;base64,abc"),
  loadImageSize: vi.fn(async () => ({ width: 400, height: 300 })),
  readFileAsDataUrl: vi.fn(async () => "data:image/png;base64,source"),
}));

describe("useAvatarCrop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeHook(overrides: Partial<Parameters<typeof useAvatarCrop>[0]> = {}) {
    const deps = {
      modalCloseMs: 180,
      apiFetch: vi.fn().mockResolvedValue({ username: "tester", avatar_url: "data:image/jpeg;base64,abc" }),
      setToast: vi.fn(),
      setAvatarUploadPending: vi.fn(),
      setRegisterAvatarDataUrl: vi.fn(),
      setUserProfile: vi.fn(),
      ...overrides,
    };

    const hook = renderHook(() => useAvatarCrop(deps));
    return { ...hook, deps };
  }

  it("opens crop modal for profile avatar selection", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.cropModalOpen).toBe(true);
    expect(result.current.cropTarget).toBe("profile");
    expect(input.value).toBe("");
  });

  it("opens crop modal for register avatar selection", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleRegisterAvatarSelected({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.cropModalOpen).toBe(true);
    expect(result.current.cropTarget).toBe("register");
  });

  it("closes crop modal after timeout", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.closeCropModal();
    });

    expect(result.current.cropModalClosing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(result.current.cropModalOpen).toBe(false);
    expect(result.current.cropTarget).toBeNull();
  });

  it("confirmCropSelection writes register avatar when target is register", async () => {
    const setRegisterAvatarDataUrl = vi.fn();
    const { result, deps } = makeHook({ setRegisterAvatarDataUrl });
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleRegisterAvatarSelected({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.cropTarget).toBe("register");

    await act(async () => {
      await result.current.confirmCropSelection();
    });

    expect(setRegisterAvatarDataUrl).toHaveBeenCalledWith("data:image/jpeg;base64,abc");
    expect(deps.setToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "ok" }));
  });

  it("confirmCropSelection uploads avatar for profile target", async () => {
    const setUserProfile = vi.fn();
    const setAvatarUploadPending = vi.fn();
    const { result, deps } = makeHook({ setUserProfile, setAvatarUploadPending });
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.cropTarget).toBe("profile");

    await act(async () => {
      await result.current.confirmCropSelection();
    });

    expect(deps.apiFetch).toHaveBeenCalledWith("/auth/me/avatar", expect.objectContaining({ method: "PATCH" }));
    expect(deps.setToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "ok" }));
  });

  it("handleAvatarChange rejects files over 8 MB", async () => {
    const setToast = vi.fn();
    const { result } = makeHook({ setToast });
    const bigFile = new File(["x".repeat(1)], "big.png", { type: "image/png" });
    Object.defineProperty(bigFile, "size", { value: 9_000_000 });
    const input = { files: [bigFile], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "err", message: expect.stringContaining("8 Mo") }));
    expect(result.current.cropModalOpen).toBe(false);
  });

  it("handleRegisterAvatarSelected rejects files over 8 MB", async () => {
    const setToast = vi.fn();
    const { result } = makeHook({ setToast });
    const bigFile = new File(["x".repeat(1)], "big.png", { type: "image/png" });
    Object.defineProperty(bigFile, "size", { value: 9_000_000 });
    const input = { files: [bigFile], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleRegisterAvatarSelected({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "err", message: expect.stringContaining("8 Mo") }));
    expect(result.current.cropModalOpen).toBe(false);
  });

  it("handleCropZoomChange updates zoom and offset", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.cropImageSize).not.toBeNull();

    act(() => {
      result.current.handleCropZoomChange(1.5);
    });

    expect(result.current.cropZoom).toBe(1.5);
  });

  it("onCropPointerDown and onCropPointerMove update offset via drag", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const mockDiv = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => false) };

    act(() => {
      result.current.onCropPointerDown({
        clientX: 50, clientY: 50, pointerId: 1,
        currentTarget: mockDiv,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      result.current.onCropPointerMove({
        clientX: 60, clientY: 55, pointerId: 1,
        currentTarget: mockDiv,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(mockDiv.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("onCropPointerUp releases pointer capture", async () => {
    const { result } = makeHook();
    const input = { files: [new File(["a"], "a.png", { type: "image/png" })], value: "x" } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleAvatarChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const releasePointerCapture = vi.fn();
    const mockDiv = {
      setPointerCapture: vi.fn(),
      releasePointerCapture,
      hasPointerCapture: vi.fn(() => true),
    };

    act(() => {
      result.current.onCropPointerDown({
        clientX: 50, clientY: 50, pointerId: 2,
        currentTarget: mockDiv,
      } as unknown as React.PointerEvent<HTMLDivElement>);

      result.current.onCropPointerUp({
        pointerId: 2,
        currentTarget: mockDiv,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(2);
  });
});
