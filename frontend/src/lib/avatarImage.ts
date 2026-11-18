import { avatarLimits, type AvatarCrop, type AvatarUpload } from "@podrida/shared";

// Everything an avatar goes through before it's sent: the browser decodes the picture, the user
// frames it (see AvatarEditor), and it's drawn into a square here. The API only ever gets PNG, JPEG
// or WebP data URLs within avatarLimits.

export const defaultCrop: AvatarCrop = { x: 0.5, y: 0.5, zoom: 1 };

// Big enough for any photo, small enough that decoding it can't freeze the tab.
const maxFileBytes = 20 * 1024 * 1024;

export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarImageError";
  }
}

const loadImage = (src: string, crossOrigin: boolean) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Without CORS a picture from another site can be shown but not read back from a canvas.
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image didn't load"));
    image.src = src;
  });

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("That file isn't an image.");
  if (file.size > maxFileBytes)
    throw new AvatarImageError("That image is too big (20 MB at most).");

  const objectUrl = URL.createObjectURL(file);

  try {
    return await loadImage(objectUrl, false);
  } catch {
    throw new AvatarImageError("That image couldn't be opened. Try a PNG, JPEG or WebP.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AvatarImageError("That doesn't look like a link.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AvatarImageError("Use a link that starts with https://");
  }

  try {
    return await loadImage(parsed.href, true);
  } catch {
    throw new AvatarImageError(
      "That image couldn't be loaded. Some sites don't let their images be used elsewhere: download it and upload the file instead.",
    );
  }
}

// Saved sources come back as data URLs, which never need CORS.
export const loadImageFromDataUrl = (dataUrl: string) => loadImage(dataUrl, false);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Keeps the crop square inside the picture, whatever the user dragged or zoomed to.
export function clampCrop(crop: AvatarCrop, width: number, height: number): AvatarCrop {
  const zoom = clamp(crop.zoom, 1, avatarLimits.maxZoom);
  const side = Math.min(width, height) / zoom;
  const halfX = side / 2 / width;
  const halfY = side / 2 / height;

  return {
    x: clamp(crop.x, halfX, 1 - halfX),
    y: clamp(crop.y, halfY, 1 - halfY),
    zoom,
  };
}

const dataUrlBytes = (dataUrl: string) =>
  Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

// WebP keeps transparency and is the smallest. Browsers that can't write it answer a PNG instead,
// so JPEG (on a light background, it has no transparency) is the fallback.
function encode(canvas: HTMLCanvasElement, maxBytes: number): string | null {
  const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const type = supportsWebp ? "image/webp" : "image/jpeg";

  for (const quality of qualities) {
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
  }

  return null;
}

function drawToCanvas(
  image: HTMLImageElement,
  source: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width));
  canvas.height = Math.max(1, Math.round(size.height));

  const context = canvas.getContext("2d");
  if (!context) throw new AvatarImageError("Your browser can't edit images.");

  context.fillStyle = "#fbf8f1"; // Only shows through as JPEG, which has no transparency.
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas;
}

// Drawing a cross-origin picture taints the canvas: reading it back throws.
function readCanvas(canvas: HTMLCanvasElement, maxBytes: number) {
  try {
    return encode(canvas, maxBytes);
  } catch {
    throw new AvatarImageError(
      "That site doesn't let its images be used elsewhere. Download it and upload the file instead.",
    );
  }
}

// The original, shrunk to fit avatarLimits.sourceMaxSize (and smaller still if it doesn't fit
// in sourceMaxBytes), so the avatar can be re-framed later.
function encodeSource(image: HTMLImageElement): string {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  let scale = Math.min(1, avatarLimits.sourceMaxSize / Math.max(width, height));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = drawToCanvas(
      image,
      { x: 0, y: 0, width, height },
      { width: width * scale, height: height * scale },
    );
    const dataUrl = readCanvas(canvas, avatarLimits.sourceMaxBytes);
    if (dataUrl) return dataUrl;
    scale *= 0.75;
  }

  throw new AvatarImageError("That image is too detailed to use. Try another one.");
}

function encodeAvatar(image: HTMLImageElement, crop: AvatarCrop): string {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const { x, y, zoom } = clampCrop(crop, width, height);
  const side = Math.min(width, height) / zoom;

  const canvas = drawToCanvas(
    image,
    { x: x * width - side / 2, y: y * height - side / 2, width: side, height: side },
    { width: avatarLimits.imageSize, height: avatarLimits.imageSize },
  );
  const dataUrl = readCanvas(canvas, avatarLimits.imageMaxBytes);
  if (!dataUrl) throw new AvatarImageError("That image is too detailed to use. Try another one.");

  return dataUrl;
}

// A picture ready to be framed: the source as it will be stored, and that same source decoded.
// The editor works on exactly what gets saved, so re-framing it later shows the same thing.
export interface AvatarSource {
  dataUrl: string;
  image: HTMLImageElement;
}

async function toAvatarSource(image: HTMLImageElement): Promise<AvatarSource> {
  const dataUrl = encodeSource(image);
  return { dataUrl, image: await loadImageFromDataUrl(dataUrl) };
}

export const avatarSourceFromFile = async (file: File) =>
  toAvatarSource(await loadImageFromFile(file));

export const avatarSourceFromUrl = async (url: string) =>
  toAvatarSource(await loadImageFromUrl(url));

// A source the API sent back (GET /users/myUser/avatar) is stored as is.
export const avatarSourceFromDataUrl = async (dataUrl: string): Promise<AvatarSource> => ({
  dataUrl,
  image: await loadImageFromDataUrl(dataUrl),
});

// What the API takes: the framed square plus the source it came from.
export function buildAvatarUpload(source: AvatarSource, crop: AvatarCrop): AvatarUpload {
  const { naturalWidth, naturalHeight } = source.image;
  const clamped = clampCrop(crop, naturalWidth, naturalHeight);
  return { image: encodeAvatar(source.image, clamped), source: source.dataUrl, crop: clamped };
}
