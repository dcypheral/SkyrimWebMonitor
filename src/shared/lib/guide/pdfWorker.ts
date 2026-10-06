/**
 * pdf.js worker with the polyfills loaded first (module imports run in
 * order). Bundled by Vite as a module worker.
 */
import './pdfPolyfills';
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
