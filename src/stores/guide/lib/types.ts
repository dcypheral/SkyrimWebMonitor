import type { GuideOutlineEntry } from '@/shared/lib/guide/outline';
import type { GuidePageText } from '@/shared/lib/guide/pageText';

export interface GuideFileRecord {
  blob: Blob;
  /** Fingerprint of the file (see GuideMeta.fp). */
  fp: string;
  name: string;
  size: number;
  lastModified: number;
  addedAt: number;
}

export interface GuideMeta {
  /** Fingerprint: pdf.js document id + file size. */
  fp: string;
  pageCount: number;
  outline: GuideOutlineEntry[];
  /** Size of the first page (PDF points); other pages until measured. */
  pageWidth: number;
  pageHeight: number;
  /** Text index covers pages [0, indexedPages). */
  indexedPages: number;
  lastPage: number;
}

export interface GuidePageRecord extends GuidePageText {
  fp: string;
  width: number;
  height: number;
}

export type HighlightColor = 'amber' | 'green' | 'blue' | 'rose';
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = ['amber', 'green', 'blue', 'rose'];

interface AnnotationBase {
  id?: number;
  fp: string;
  /** 0-based page. */
  page: number;
  createdAt: number;
  note: string;
}

export interface GuideBookmark extends AnnotationBase {
  kind: 'bookmark';
  label: string;
}

export interface GuideHighlight extends AnnotationBase {
  kind: 'highlight';
  /** x, y, w, h as fractions of the page. */
  rect: [number, number, number, number];
  color: HighlightColor;
}

export type GuideAnnotation = GuideBookmark | GuideHighlight;

export interface QuestLinkRecord {
  fp: string;
  questKey: string;
  page: number;
  createdAt: number;
}

/** How a quest's guide page was found. */
export type GuideMatchSource = 'link' | 'bookmark' | 'text' | 'section';

export interface GuideTargetRef {
  page: number;
  title: string;
}

export interface QuestGuideMatch {
  source: GuideMatchSource;
  page: number;
  title: string;
  /** Other places the quest is covered (the other faction's side…). */
  alternatives: GuideTargetRef[];
}
