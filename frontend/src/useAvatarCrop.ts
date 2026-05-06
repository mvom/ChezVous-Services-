import { ChangeEvent, Dispatch, PointerEvent, SetStateAction, useRef, useState } from "react";
import { avatarDisplaySize, clampAvatarOffset, exportAvatarCrop, loadImageSize, readFileAsDataUrl } from "./avatarUtils";
import type { ToastState } from "./types";

type AvatarCropTarget = "profile" | "register";

type UserProfileLike = {
  username: string;
  avatar_url: string | null;
};

type UseAvatarCropDeps = {
  modalCloseMs: number;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  setToast: (toast: ToastState) => void;
  setAvatarUploadPending: Dispatch<SetStateAction<boolean>>;
  setRegisterAvatarDataUrl: Dispatch<SetStateAction<string | null>>;
  setUserProfile: Dispatch<SetStateAction<UserProfileLike | null>>;
};

export function useAvatarCrop({
  modalCloseMs,
  apiFetch,
  setToast,
  setAvatarUploadPending,
  setRegisterAvatarDataUrl,
  setUserProfile,
}: UseAvatarCropDeps) {
  const cropDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourceDataUrl, setCropSourceDataUrl] = useState("");
  const [cropImageSize, setCropImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [cropTarget, setCropTarget] = useState<AvatarCropTarget | null>(null);
  const [cropPending, setCropPending] = useState(false);
  const [cropModalClosing, setCropModalClosing] = useState(false);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) {
      setToast({ kind: "err", message: "Image source trop grande. Maximum 8 Mo." });
      event.target.value = "";
      return;
    }
    try {
      const sourceDataUrl = await readFileAsDataUrl(file);
      const size = await loadImageSize(sourceDataUrl);
      setCropSourceDataUrl(sourceDataUrl);
      setCropImageSize(size);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget("profile");
      setCropModalClosing(false);
      setCropModalOpen(true);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Erreur lors du téléversement." });
    }
    event.target.value = "";
  }

  async function handleRegisterAvatarSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) {
      setToast({ kind: "err", message: "Image source trop grande. Maximum 8 Mo." });
      event.target.value = "";
      return;
    }
    try {
      const sourceDataUrl = await readFileAsDataUrl(file);
      const size = await loadImageSize(sourceDataUrl);
      setCropSourceDataUrl(sourceDataUrl);
      setCropImageSize(size);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget("register");
      setCropModalClosing(false);
      setCropModalOpen(true);
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Erreur lors de l'import de l'image." });
    }
    event.target.value = "";
  }

  function closeCropModal(): void {
    if (cropPending) {
      return;
    }
    setCropModalClosing(true);
    window.setTimeout(() => {
      setCropModalOpen(false);
      setCropSourceDataUrl("");
      setCropImageSize(null);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setCropTarget(null);
      cropDragRef.current = null;
      setCropModalClosing(false);
    }, modalCloseMs);
  }

  function handleCropZoomChange(nextZoom: number): void {
    if (!cropImageSize) {
      return;
    }
    const clamped = clampAvatarOffset(cropImageSize.width, cropImageSize.height, nextZoom, cropOffsetX, cropOffsetY);
    setCropZoom(nextZoom);
    setCropOffsetX(clamped.x);
    setCropOffsetY(clamped.y);
  }

  function onCropPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (!cropImageSize) {
      return;
    }
    cropDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: cropOffsetX,
      originY: cropOffsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onCropPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!cropImageSize || !cropDragRef.current) {
      return;
    }
    const nextX = cropDragRef.current.originX + (event.clientX - cropDragRef.current.startX);
    const nextY = cropDragRef.current.originY + (event.clientY - cropDragRef.current.startY);
    const clamped = clampAvatarOffset(cropImageSize.width, cropImageSize.height, cropZoom, nextX, nextY);
    setCropOffsetX(clamped.x);
    setCropOffsetY(clamped.y);
  }

  function onCropPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropDragRef.current = null;
  }

  async function confirmCropSelection(): Promise<void> {
    if (!cropImageSize || !cropSourceDataUrl || !cropTarget) {
      return;
    }

    try {
      setCropPending(true);
      const avatarDataUrl = await exportAvatarCrop(
        cropSourceDataUrl,
        cropImageSize.width,
        cropImageSize.height,
        cropZoom,
        cropOffsetX,
        cropOffsetY,
      );

      if (cropTarget === "register") {
        setRegisterAvatarDataUrl(avatarDataUrl);
        setToast({ kind: "ok", message: "Photo cadree pour l'inscription." });
      } else {
        setAvatarUploadPending(true);
        await apiFetch<UserProfileLike>("/auth/me/avatar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: avatarDataUrl }),
        });
        setUserProfile((prev) => (prev ? { ...prev, avatar_url: avatarDataUrl } : prev));
        setToast({ kind: "ok", message: "Photo de profil mise à jour (cadrée)." });
      }

      closeCropModal();
    } catch (error) {
      setToast({ kind: "err", message: error instanceof Error ? error.message : "Recadrage impossible." });
    } finally {
      setCropPending(false);
      setAvatarUploadPending(false);
    }
  }

  return {
    cropModalOpen,
    cropSourceDataUrl,
    cropImageSize,
    cropZoom,
    cropOffsetX,
    cropOffsetY,
    cropTarget,
    cropPending,
    cropModalClosing,
    handleAvatarChange,
    handleRegisterAvatarSelected,
    closeCropModal,
    handleCropZoomChange,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    confirmCropSelection,
    avatarDisplaySize,
  };
}
