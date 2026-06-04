import { describe, it, expect } from 'vitest';
import { ownerWins } from '@/services/wsHub';

/**
 * `ownerWins` is the deterministic tiebreak that guarantees cross-tab WS
 * ownership converges to EXACTLY ONE owner per channel. For that convergence to
 * hold it must be a strict total order over tab ids: irreflexive, asymmetric,
 * and total. If two tabs ever both believed they won (or both yielded), a
 * channel would end up with two sockets or none.
 */
describe('ownerWins (cross-tab election tiebreak)', () => {
  it('lower id wins, higher id loses', () => {
    expect(ownerWins('a', 'b')).toBe(true);
    expect(ownerWins('b', 'a')).toBe(false);
  });

  it('is irreflexive — a tab never "wins" against itself', () => {
    expect(ownerWins('same-id', 'same-id')).toBe(false);
  });

  it('is asymmetric — exactly one side wins for any distinct pair', () => {
    const ids = ['t-1', 't-2', 'aaa', 'zzz', '0', '9', 'mid'];
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        // Exactly one of the two directions is true → no double-owner, no
        // double-yield.
        expect(ownerWins(a, b) !== ownerWins(b, a)).toBe(true);
      }
    }
  });

  it('is transitive — yields a consistent global winner', () => {
    const ids = ['uuid-0001', 'uuid-0050', 'uuid-0099', 'uuid-1000'];
    // The minimum id must win against every other id (the eventual sole owner).
    const min = ids.reduce((m, x) => (x < m ? x : m));
    for (const other of ids) {
      if (other === min) continue;
      expect(ownerWins(min, other)).toBe(true);
      expect(ownerWins(other, min)).toBe(false);
    }
  });
});
