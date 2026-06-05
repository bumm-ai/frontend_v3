import { describe, expect, it, vi } from 'vitest';
import { createCoalescer } from '@/lib/coalesce';

/** A fetcher whose pending promise can be resolved on demand, per call. */
function deferredFetcher() {
  // One controller per call, settled FIFO — keeps resolve/reject in lockstep.
  const queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];
  const fn = vi.fn((key: string) => {
    return new Promise<string>((resolve, reject) => {
      queue.push({ resolve: (v) => resolve(`${key}:${v}`), reject });
    });
  });
  return {
    fn,
    resolveNext: (v: string) => queue.shift()?.resolve(v),
    rejectNext: (e: unknown) => queue.shift()?.reject(e),
    calls: () => fn.mock.calls.length,
  };
}

describe('createCoalescer', () => {
  it('shares one in-flight request across concurrent get() calls', async () => {
    const d = deferredFetcher();
    const c = createCoalescer(d.fn, 1000, () => 0);

    const p1 = c.get('a');
    const p2 = c.get('a');
    expect(d.calls()).toBe(1); // coalesced — only one fetch dispatched

    d.resolveNext('1');
    expect(await p1).toBe('a:1');
    expect(await p2).toBe('a:1'); // both observers get the same value
  });

  it('returns the cached value within the TTL without re-fetching', async () => {
    const d = deferredFetcher();
    let t = 0;
    const c = createCoalescer(d.fn, 1000, () => t);

    const p1 = c.get('a');
    d.resolveNext('1');
    await p1;

    t = 999; // still inside the 1000ms TTL
    const v = await c.get('a');
    expect(v).toBe('a:1');
    expect(d.calls()).toBe(1); // served from micro-cache
  });

  it('re-fetches after the TTL expires', async () => {
    const d = deferredFetcher();
    let t = 0;
    const c = createCoalescer(d.fn, 1000, () => t);

    const p1 = c.get('a');
    d.resolveNext('1');
    await p1;

    t = 1000; // TTL boundary — stale
    const p2 = c.get('a');
    expect(d.calls()).toBe(2);
    d.resolveNext('2');
    expect(await p2).toBe('a:2');
  });

  it('does not cache a rejected fetch and retries cleanly', async () => {
    const d = deferredFetcher();
    const c = createCoalescer(d.fn, 1000, () => 0);

    const p1 = c.get('a');
    d.rejectNext(new Error('boom'));
    await expect(p1).rejects.toThrow('boom');
    expect(c.peek('a')).toBeUndefined(); // nothing cached

    const p2 = c.get('a'); // in-flight slot was cleared → fresh attempt
    expect(d.calls()).toBe(2);
    d.resolveNext('ok');
    expect(await p2).toBe('a:ok');
  });

  it('keys are independent', async () => {
    const d = deferredFetcher();
    const c = createCoalescer(d.fn, 1000, () => 0);

    const pa = c.get('a');
    const pb = c.get('b');
    expect(d.calls()).toBe(2); // distinct keys are not coalesced together

    d.resolveNext('1'); // resolves 'a' (FIFO)
    d.resolveNext('2'); // resolves 'b'
    expect(await pa).toBe('a:1');
    expect(await pb).toBe('b:2');
  });

  it('invalidate drops the cached value', async () => {
    const d = deferredFetcher();
    const c = createCoalescer(d.fn, 100000, () => 0);

    const p1 = c.get('a');
    d.resolveNext('1');
    await p1;
    expect(c.peek('a')).toBe('a:1');

    c.invalidate('a');
    expect(c.peek('a')).toBeUndefined();

    const p2 = c.get('a'); // forced to re-fetch despite long TTL
    expect(d.calls()).toBe(2);
    d.resolveNext('2');
    expect(await p2).toBe('a:2');
  });
});
