/**
 * Built-ins pdf.js expects but its legacy build does not polyfill.
 * Android System WebViews older than Chrome 119 lack some of them
 * ("Promise.withResolvers is not a function"). Loaded on the main thread
 * and in the pdf.js worker before pdf.js itself.
 */

interface Resolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

if (!('withResolvers' in Promise)) {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(): Resolvers<T> {
      let resolve!: Resolvers<T>['resolve'];
      let reject!: Resolvers<T>['reject'];
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
  });
}

function define(target: object, name: string, value: unknown): void {
  if (name in target) return;
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function at<T>(this: ArrayLike<T>, index: number): T | undefined {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i >= 0 && i < this.length ? this[i] : undefined;
}

define(Array.prototype, 'at', at);
define(String.prototype, 'at', at);
for (const T of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array]) {
  define(T.prototype, 'at', at);
}

define(Object, 'hasOwn', (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key));

define(Array.prototype, 'findLast', function findLast<T>(this: T[], fn: (v: T | undefined, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) {
    const v = this[i];
    if (fn.call(thisArg, v, i, this)) return v;
  }
  return undefined;
});

define(ArrayBuffer.prototype, 'transferToFixedLength', function transferToFixedLength(this: ArrayBuffer, length?: number) {
  const size = length ?? this.byteLength;
  const out = new Uint8Array(size);
  out.set(new Uint8Array(this, 0, Math.min(size, this.byteLength)));
  return out.buffer;
});

if (typeof AbortSignal !== 'undefined') {
  define(AbortSignal, 'any', (signals: AbortSignal[]) => {
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        controller.abort(s.reason);
        break;
      }
      s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
    }
    return controller.signal;
  });
}

export {};
