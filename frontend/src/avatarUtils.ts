// ── Avatar crop utilities ────────────────────────────────────────────────────

import { AVATAR_CROP_VIEW_SIZE, AVATAR_EXPORT_SIZE } from "./constants";

export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire l'image"));
    reader.readAsDataURL(file);
  });
}

export async function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Image invalide"));
    nextImage.src = dataUrl;
  });
  return { width: img.width, height: img.height };
}

export function avatarDisplaySize(width: number, height: number, zoom: number): { width: number; height: number } {
  const baseScale = Math.max(AVATAR_CROP_VIEW_SIZE / width, AVATAR_CROP_VIEW_SIZE / height);
  return {
    width: width * baseScale * zoom,
    height: height * baseScale * zoom,
  };
}

export function clampAvatarOffset(width: number, height: number, zoom: number, x: number, y: number): { x: number; y: number } {
  const display = avatarDisplaySize(width, height, zoom);
  const maxX = Math.max(0, (display.width - AVATAR_CROP_VIEW_SIZE) / 2);
  const maxY = Math.max(0, (display.height - AVATAR_CROP_VIEW_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

export async function exportAvatarCrop(
  sourceDataUrl: string,
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = sourceDataUrl;
  });

  const display = avatarDisplaySize(width, height, zoom);
  const imageLeft = (AVATAR_CROP_VIEW_SIZE - display.width) / 2 + offsetX;
  const imageTop = (AVATAR_CROP_VIEW_SIZE - display.height) / 2 + offsetY;
  const ratioX = width / display.width;
  const ratioY = height / display.height;

  const sourceX = Math.max(0, (0 - imageLeft) * ratioX);
  const sourceY = Math.max(0, (0 - imageTop) * ratioY);
  const sourceW = Math.min(width - sourceX, AVATAR_CROP_VIEW_SIZE * ratioX);
  const sourceH = Math.min(height - sourceY, AVATAR_CROP_VIEW_SIZE * ratioY);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EXPORT_SIZE;
  canvas.height = AVATAR_EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponible");

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE);

  const qualities = [0.92, 0.86, 0.8, 0.72, 0.65];
  let best = canvas.toDataURL("image/jpeg", qualities[0]);
  for (const quality of qualities) {
    const candidate = canvas.toDataURL("image/jpeg", quality);
    best = candidate;
    if (candidate.length <= 3_000_000) break;
  }
  return best;
}
