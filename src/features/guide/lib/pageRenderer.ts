/**
 * Draws guide pages into canvases with pdf.js.
 *
 * The guide is a scan: each page is one JPEG of about 1200 px width, so
 * drawing wider than MAX_RENDER_WIDTH adds memory but no detail. Zooming in
 * past that point only scales the canvas with CSS.
 */
import type { PDFDocumentProxy } from '@/shared/lib/guide/pdfDocument';

export const MAX_RENDER_WIDTH = 1400;

/** Renders a page (0-based) to a new canvas `widthPx` wide. */
export async function renderPageCanvas(
  doc: PDFDocumentProxy,
  page: number,
  widthPx: number,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const p = await doc.getPage(page + 1);
  try {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const base = p.getViewport({ scale: 1 });
    const viewport = p.getViewport({ scale: Math.min(widthPx, MAX_RENDER_WIDTH) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const task = p.render({ canvas, viewport });
    const cancel = () => task.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      await task.promise;
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
    return canvas;
  } finally {
    // Frees the decoded page image; the reader keeps the canvas.
    p.cleanup();
  }
}

// ─── Thumbnails ─────────────────────────────────────────────────────────

const THUMB_WIDTH = 240;
const THUMB_CACHE_SIZE = 24;
const thumbs = new Map<string, Promise<string>>();

/** Object URL of a small JPEG of the page; cached per guide and page. */
export function pageThumbnail(doc: PDFDocumentProxy, fp: string, page: number): Promise<string> {
  const key = `${fp}:${page}`;
  const cached = thumbs.get(key);
  if (cached) {
    // Refresh LRU position.
    thumbs.delete(key);
    thumbs.set(key, cached);
    return cached;
  }
  const made = renderPageCanvas(doc, page, THUMB_WIDTH).then(
    (canvas) =>
      new Promise<string>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('thumbnail'))), 'image/jpeg', 0.82);
      }),
  );
  made.catch(() => thumbs.delete(key));
  thumbs.set(key, made);
  while (thumbs.size > THUMB_CACHE_SIZE) {
    const oldest = thumbs.keys().next().value;
    if (oldest === undefined) break;
    const url = thumbs.get(oldest);
    thumbs.delete(oldest);
    void url?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
  }
  return made;
}
