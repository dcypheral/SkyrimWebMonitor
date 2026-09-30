/**
 * Shrinks a photo before it is stored: long edge ≤ maxEdge, WebP (JPEG when
 * the WebView cannot encode WebP). A phone photo drops from megabytes to
 * roughly 50–120 KB, which keeps hundreds of notes cheap.
 */

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export const NOTE_PHOTO_MAX_EDGE = 960;
const QUALITY = 0.8;

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function resizeImage(blob: Blob, maxEdge = NOTE_PHOTO_MAX_EDGE): Promise<ResizedImage> {
  const img = await decode(blob);
  try {
    const k = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * k));
    const height = Math.max(1, Math.round(img.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.source, 0, 0, width, height);
    let out = await toBlob(canvas, 'image/webp');
    if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg');
    if (!out) throw new Error('Image encode failed');
    return { blob: out, width, height };
  } finally {
    img.close();
  }
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function extensionForMime(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}
