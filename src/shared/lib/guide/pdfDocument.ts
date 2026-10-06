/**
 * pdf.js on top of a Blob. The guide is a 250 MB scan, so it is never read
 * whole: pdf.js asks for byte ranges and each one is a `blob.slice()` read
 * from IndexedDB's on-disk copy. pdf.js itself is loaded on first use.
 *
 * The legacy build is used because the app supports Chrome 90 WebViews.
 */
import './pdfPolyfills';
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { flattenOutline, type GuideOutlineEntry, type RawOutlineNode } from './outline';
import { buildPageText, type GuidePageText, type RawTextItem } from './pageText';

type PdfJs = typeof PdfJsModule;

/** Range request size. Pages of the scan are ~200 KB. */
const CHUNK = 256 * 1024;

let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

/** Worker thread of each open document, ended by `closePdf`. */
const workers = new WeakMap<PDFDocumentProxy, { worker: { destroy(): void }; thread: Worker }>();

export type { PDFDocumentProxy };

/** Opens a PDF stored as a Blob. Each call gets its own pdf.js worker. */
export async function openBlobPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  const thread = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module' });
  const worker = pdfjs.PDFWorker.create({ port: thread });
  const head = new Uint8Array(await blob.slice(0, Math.min(CHUNK, blob.size)).arrayBuffer());
  const transport = new pdfjs.PDFDataRangeTransport(blob.size, head);
  transport.requestDataRange = (begin: number, end: number) => {
    blob
      .slice(begin, end)
      .arrayBuffer()
      .then((buf) => transport.onDataRange(begin, new Uint8Array(buf)))
      .catch((err: unknown) => console.warn('[Guide] Range read failed', begin, end, err));
  };
  const task = pdfjs.getDocument({
    worker,
    range: transport,
    rangeChunkSize: CHUNK,
    disableAutoFetch: true,
    disableStream: true,
    // Only errors: the scan's invisible OCR font logs a warning per page.
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    workers.set(doc, { worker, thread });
    return doc;
  } catch (err) {
    await task.destroy().catch(() => undefined);
    worker.destroy();
    thread.terminate();
    throw err;
  }
}

/** Closes a document from `openBlobPdf` and ends its worker thread. */
export async function closePdf(doc: PDFDocumentProxy): Promise<void> {
  await doc.loadingTask.destroy().catch(() => undefined);
  const w = workers.get(doc);
  workers.delete(doc);
  w?.worker.destroy();
  w?.thread.terminate();
}

/** Stable id of a guide file: pdf.js fingerprint plus byte size. */
export function guideFingerprint(doc: PDFDocumentProxy, size: number): string {
  return `${doc.fingerprints[0] ?? 'pdf'}-${size}`;
}

export async function readOutline(doc: PDFDocumentProxy): Promise<GuideOutlineEntry[]> {
  const raw: RawOutlineNode[] = (await doc.getOutline()) ?? [];
  return flattenOutline(raw, async (dest) => {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    const ref: unknown = Array.isArray(explicit) ? explicit[0] : null;
    if (typeof ref === 'number') return ref;
    if (ref && typeof ref === 'object' && 'num' in ref && 'gen' in ref) {
      const { num, gen } = ref;
      if (typeof num === 'number' && typeof gen === 'number') return doc.getPageIndex({ num, gen });
    }
    return -1;
  });
}

const isTextItem = (v: unknown): v is RawTextItem =>
  typeof v === 'object' && v !== null && 'str' in v && 'transform' in v;

/** Text of one page (0-based) with run boxes, plus the page size. */
export async function readPageText(
  doc: PDFDocumentProxy,
  page: number,
): Promise<GuidePageText & { width: number; height: number }> {
  const p = await doc.getPage(page + 1);
  try {
    const { width, height } = p.getViewport({ scale: 1 });
    const content = await p.getTextContent();
    const items: RawTextItem[] = [];
    for (const item of content.items) if (isTextItem(item)) items.push(item);
    return { ...buildPageText(page, items, width, height), width, height };
  } finally {
    p.cleanup();
  }
}
