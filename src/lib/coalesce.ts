/**
 * createCoalescer — collapse redundant async reads of the same key into one.
 *
 * Why (frontend connection fan-out, scaling #8): a single tab polls a
 * contract's status from TWO independent 5 s loops — `useContractStream`'s own
 * REST fallback AND the Dashboard global poll over all tracked contracts — so
 * the active contract was fetched ~2× every 5 s, on top of its WebSocket. With
 * several projects open across tabs this fan-out hits ONE uvicorn worker hard,
 * which starts to choke on connection/poll volume well before the build farm is
 * saturated.
 *
 * This wrapper deduplicates two ways:
 *   1. In-flight coalescing — concurrent `get(key)` calls share the SAME promise
 *      (one network request), not N.
 *   2. Micro-cache TTL — a `get(key)` within `ttlMs` of the last resolved value
 *      returns it without a new request, so two slightly-offset 5 s loops collapse
 *      to ~1 request per window instead of 2.
 *
 * It only dedups REST reads; WebSocket-driven state updates are untouched. A
 * rejected fetch is never cached and clears the in-flight slot, so the next call
 * retries cleanly. `now` is injectable for deterministic tests.
 */
export interface Coalescer<T> {
  /** Get the value for `key`, sharing an in-flight request or a fresh cache hit. */
  get(key: string): Promise<T>;
  /** Drop any cached value + in-flight request for `key` (e.g. on delete). */
  invalidate(key: string): void;
  /** Test helper: read the cached value without triggering a fetch. */
  peek(key: string): T | undefined;
}

export function createCoalescer<T>(
  fetcher: (key: string) => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): Coalescer<T> {
  const inflight = new Map<string, Promise<T>>();
  const cache = new Map<string, { at: number; value: T }>();

  return {
    get(key: string): Promise<T> {
      const pending = inflight.get(key);
      if (pending) return pending;

      const cached = cache.get(key);
      if (cached && now() - cached.at < ttlMs) {
        return Promise.resolve(cached.value);
      }

      const promise = fetcher(key)
        .then((value) => {
          cache.set(key, { at: now(), value });
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, promise);
      return promise;
    },

    invalidate(key: string): void {
      cache.delete(key);
      inflight.delete(key);
    },

    peek(key: string): T | undefined {
      return cache.get(key)?.value;
    },
  };
}
