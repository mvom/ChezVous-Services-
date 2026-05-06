/**
 * Tests unitaires pour les fonctions pures de avatarUtils.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { avatarDisplaySize, clampAvatarOffset, readFileAsDataUrl, loadImageSize, exportAvatarCrop } from "./avatarUtils";
import { AVATAR_CROP_VIEW_SIZE, AVATAR_EXPORT_SIZE } from "./constants";

describe("avatarDisplaySize", () => {
  it("scales up small image to fill the crop view", () => {
    // 100x100 image, zoom=1 → scale = CROP_VIEW/100, both dimensions scaled equally
    const result = avatarDisplaySize(100, 100, 1);
    expect(result.width).toBeCloseTo(AVATAR_CROP_VIEW_SIZE);
    expect(result.height).toBeCloseTo(AVATAR_CROP_VIEW_SIZE);
  });

  it("applies zoom factor", () => {
    const r1 = avatarDisplaySize(100, 100, 1);
    const r2 = avatarDisplaySize(100, 100, 2);
    expect(r2.width).toBeCloseTo(r1.width * 2);
    expect(r2.height).toBeCloseTo(r1.height * 2);
  });

  it("scales portrait image by width to fill crop view", () => {
    // 100x200 portrait: baseScale is max(CROP/100, CROP/200) = CROP/100
    const result = avatarDisplaySize(100, 200, 1);
    expect(result.width).toBeCloseTo(AVATAR_CROP_VIEW_SIZE);
    expect(result.height).toBeCloseTo(AVATAR_CROP_VIEW_SIZE * 2);
  });

  it("scales landscape image by height to fill crop view", () => {
    // 200x100 landscape: baseScale is max(CROP/200, CROP/100) = CROP/100
    const result = avatarDisplaySize(200, 100, 1);
    expect(result.height).toBeCloseTo(AVATAR_CROP_VIEW_SIZE);
    expect(result.width).toBeCloseTo(AVATAR_CROP_VIEW_SIZE * 2);
  });
});

describe("clampAvatarOffset", () => {
  it("returns zero offset for square image at zoom 1", () => {
    // When image exactly fills the crop view, max offset is 0
    const result = clampAvatarOffset(AVATAR_CROP_VIEW_SIZE, AVATAR_CROP_VIEW_SIZE, 1, 0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps positive offset to maxX", () => {
    // Large image (2x crop size) at zoom 1: maxX = (2*CROP - CROP)/2 = CROP/2
    const w = AVATAR_CROP_VIEW_SIZE * 2;
    const h = AVATAR_CROP_VIEW_SIZE * 2;
    const result = clampAvatarOffset(w, h, 1, 99999, 0);
    const display = avatarDisplaySize(w, h, 1);
    const maxX = (display.width - AVATAR_CROP_VIEW_SIZE) / 2;
    expect(result.x).toBeCloseTo(maxX);
  });

  it("clamps negative offset to -maxX", () => {
    const w = AVATAR_CROP_VIEW_SIZE * 2;
    const h = AVATAR_CROP_VIEW_SIZE * 2;
    const result = clampAvatarOffset(w, h, 1, -99999, 0);
    const display = avatarDisplaySize(w, h, 1);
    const maxX = (display.width - AVATAR_CROP_VIEW_SIZE) / 2;
    expect(result.x).toBeCloseTo(-maxX);
  });

  it("allows offset within bounds unchanged", () => {
    // For zoom=2, a 4x image: display = 4*CROP*(1/4)*2 = 2*CROP → maxX = CROP/2 → offset 5 is within bounds
    const w = AVATAR_CROP_VIEW_SIZE * 4;
    const h = AVATAR_CROP_VIEW_SIZE * 4;
    const result = clampAvatarOffset(w, h, 2, 5, 5);
    expect(result.x).toBe(5);
    expect(result.y).toBe(5);
  });
});

describe("readFileAsDataUrl", () => {
  it("resolves with data url from FileReader", async () => {
    const fakeResult = "data:image/png;base64,abc";
    const mockReader = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: fakeResult,
      readAsDataURL: vi.fn(function (this: typeof mockReader) {
        // simulate async load
        Promise.resolve().then(() => { if (this.onload) this.onload(); });
      }),
    };
    vi.stubGlobal("FileReader", vi.fn(() => mockReader));
    const file = new File(["data"], "test.png", { type: "image/png" });
    const result = await readFileAsDataUrl(file);
    expect(result).toBe(fakeResult);
    vi.unstubAllGlobals();
  });

  it("rejects on FileReader error", async () => {
    const mockReader = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null,
      readAsDataURL: vi.fn(function (this: typeof mockReader) {
        Promise.resolve().then(() => { if (this.onerror) this.onerror(); });
      }),
    };
    vi.stubGlobal("FileReader", vi.fn(() => mockReader));
    const file = new File(["data"], "test.png", { type: "image/png" });
    await expect(readFileAsDataUrl(file)).rejects.toThrow("Impossible de lire l'image");
    vi.unstubAllGlobals();
  });
});

describe("loadImageSize", () => {
  it("resolves with image dimensions", async () => {
    const mockImg = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 200,
      height: 100,
      src: "",
    };
    const ImageMock = vi.fn(() => mockImg);
    Object.defineProperty(mockImg, "src", {
      set(_val: string) {
        Promise.resolve().then(() => { if (mockImg.onload) mockImg.onload(); });
      },
    });
    vi.stubGlobal("Image", ImageMock);
    const result = await loadImageSize("data:image/png;base64,abc");
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    vi.unstubAllGlobals();
  });

  it("rejects when image fails to load", async () => {
    const mockImg = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 0,
      height: 0,
      src: "",
    };
    const ImageMock = vi.fn(() => mockImg);
    Object.defineProperty(mockImg, "src", {
      set(_val: string) {
        Promise.resolve().then(() => { if (mockImg.onerror) mockImg.onerror(); });
      },
    });
    vi.stubGlobal("Image", ImageMock);
    await expect(loadImageSize("invalid-data")).rejects.toThrow("Image invalide");
    vi.unstubAllGlobals();
  });
});

describe("exportAvatarCrop", () => {
  beforeEach(() => {
    const mockImg = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 400,
      height: 400,
    };
    Object.defineProperty(mockImg, "src", {
      set(_val: string) {
        Promise.resolve().then(() => { if (mockImg.onload) mockImg.onload(); });
      },
    });
    vi.stubGlobal("Image", vi.fn(() => mockImg));
    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => "data:image/jpeg;base64,smallresult"),
    };
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a data URL", async () => {
    const result = await exportAvatarCrop("data:image/png;base64,abc", 400, 400, 1, 0, 0);
    expect(result).toMatch(/^data:/);
  });

  it("rejects when image fails to load in exportAvatarCrop", async () => {
    const errorImg = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 0,
      height: 0,
      src: "",
    };
    const ErrorImage = vi.fn(() => errorImg);
    Object.defineProperty(errorImg, "src", {
      set(_val: string) {
        Promise.resolve().then(() => { if (errorImg.onerror) errorImg.onerror(); });
      },
    });
    vi.stubGlobal("Image", ErrorImage);

    await expect(exportAvatarCrop("invalid-data", 400, 400, 1, 0, 0)).rejects.toThrow("Image invalide");
    vi.unstubAllGlobals();
  });

  it("throws when canvas context is unavailable", async () => {
    // Override to return null context
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") return { width: 0, height: 0, getContext: vi.fn(() => null), toDataURL: vi.fn() } as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    await expect(exportAvatarCrop("data:image/png;base64,abc", 400, 400, 1, 0, 0)).rejects.toThrow("Canvas non disponible");
  });
});

