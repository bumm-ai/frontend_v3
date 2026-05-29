/**
 * Unit tests for deriveAnimationStage — the pure status→animation mapper that
 * drives the generating/building/auditing/deploying loaders.
 *
 * Mirrors the project's hook-test convention (pure-function tests, no jsdom /
 * renderHook): the derivation is extracted into the exported deriveAnimationStage,
 * which we exercise directly. The useContractStream() WS/REST wiring is a thin
 * wrapper around this logic.
 *
 * Run: npx vitest run src/hooks/__tests__/useContractStream.test.ts
 */

import { describe, it, expect } from 'vitest';
import { deriveAnimationStage } from '@/hooks/useContractStream';
import type { ContractStatus, Phase } from '@/lib/api';

/** Minimal valid ContractStatus, overridable per case. */
const status = (over: Partial<ContractStatus> = {}): ContractStatus => ({
  bumm_uid: 'u1',
  phase: 'pending',
  build_attempt: 0,
  build_ok: false,
  audit_attempt: 0,
  audit_ok: false,
  program_id: null,
  error: null,
  next_step: null,
  ...over,
});

describe('deriveAnimationStage', () => {
  it('returns null when status is null', () => {
    expect(deriveAnimationStage(null)).toBeNull();
  });

  describe('generating', () => {
    it('shows for enriching with no downstream progress and pipeline running', () => {
      expect(deriveAnimationStage(status({ phase: 'enriching' }))).toBe('generating');
    });

    it('shows for generating phase', () => {
      expect(deriveAnimationStage(status({ phase: 'generating' }))).toBe('generating');
    });

    it('stops when parked at the build interrupt (next_step set)', () => {
      expect(
        deriveAnimationStage(status({ phase: 'generating', next_step: 'build' })),
      ).toBeNull();
    });

    it('does not show once build_ok is true (stale heartbeat)', () => {
      expect(
        deriveAnimationStage(status({ phase: 'generating', build_ok: true })),
      ).toBeNull();
    });

    it('does not show once a program_id exists', () => {
      expect(
        deriveAnimationStage(status({ phase: 'generating', program_id: 'Prog111' })),
      ).toBeNull();
    });
  });

  describe('building', () => {
    it.each<Phase>(['building', 'build_fixing', 'learning'])(
      'shows for %s while build_ok is false',
      (phase) => {
        expect(deriveAnimationStage(status({ phase }))).toBe('building');
      },
    );

    it('stops once build_ok is true even if phase still says building', () => {
      expect(
        deriveAnimationStage(status({ phase: 'building', build_ok: true })),
      ).toBeNull();
    });
  });

  describe('auditing', () => {
    it.each<Phase>(['auditing_static', 'auditing_llm', 'audit_fixing'])(
      'shows for %s while audit_ok is false',
      (phase) => {
        expect(deriveAnimationStage(status({ phase, build_ok: true }))).toBe('auditing');
      },
    );

    it('stops once audit_ok is true even if phase still says auditing', () => {
      expect(
        deriveAnimationStage(
          status({ phase: 'auditing_llm', build_ok: true, audit_ok: true }),
        ),
      ).toBeNull();
    });
  });

  describe('deploying', () => {
    it('shows while deploying with no program_id yet', () => {
      expect(
        deriveAnimationStage(
          status({ phase: 'deploying', build_ok: true, audit_ok: true }),
        ),
      ).toBe('deploying');
    });

    it('stops once a program_id is set', () => {
      expect(
        deriveAnimationStage(
          status({
            phase: 'deploying',
            build_ok: true,
            audit_ok: true,
            program_id: 'Prog111',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('terminal / no-stage phases', () => {
    it.each<Phase>(['pending', 'generated', 'done', 'failed', 'cancelled', 'paused_degraded'])(
      'returns null for %s',
      (phase) => {
        expect(
          deriveAnimationStage(
            status({ phase, build_ok: true, audit_ok: true, program_id: 'Prog111' }),
          ),
        ).toBeNull();
      },
    );
  });
});
