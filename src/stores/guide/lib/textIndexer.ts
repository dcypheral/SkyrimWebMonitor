/**
 * Builds the guide's text index in the background.
 *
 * pdf.js keeps every byte it has read in its worker, and reading a scanned
 * page's text pulls in the page image too. So the indexer opens its own
 * document per batch and destroys it afterwards: memory stays at one batch
 * of pages, and the reader's document is not slowed down by it.
 */
import { openBlobPdf, readPageText } from '@/shared/lib/guide/pdfDocument';
import type { GuidePageText } from '@/shared/lib/guide/pageText';

export type IndexedPage = GuidePageText & { width: number; height: number };

export interface IndexerOptions {
  blob: Blob;
  from: number;
  pageCount: number;
  /** Pages per pdf.js document before it is recreated. */
  batchSize?: number;
  /** Pages handed to `onPages` at a time. */
  flushSize?: number;
  /** Receives finished pages; `next` is the first page not yet indexed. */
  onPages: (pages: IndexedPage[], next: number) => Promise<void>;
  /** Polled between pages; the indexer waits while it returns true. */
  isPaused: () => boolean;
  signal: AbortSignal;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runIndexer(options: IndexerOptions): Promise<void> {
  const { blob, pageCount, signal, isPaused, onPages } = options;
  const batchSize = options.batchSize ?? 120;
  const flushSize = options.flushSize ?? 24;
  let page = options.from;

  while (page < pageCount && !signal.aborted) {
    const doc = await openBlobPdf(blob);
    try {
      const end = Math.min(pageCount, page + batchSize);
      let pending: IndexedPage[] = [];
      while (page < end) {
        while (isPaused() && !signal.aborted) await sleep(400);
        if (signal.aborted) break;
        pending.push(await readPageText(doc, page));
        page++;
        if (pending.length >= flushSize) {
          await onPages(pending, page);
          pending = [];
        }
      }
      if (pending.length) await onPages(pending, page);
    } finally {
      await doc.loadingTask.destroy();
    }
  }
}
