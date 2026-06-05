/**
 * Unit tests for deriveUIFromStatus — the pure function that drives all UI state.
 *
 * These tests cover the three critical bugs that the refactor fixed:
 *  1. Stale WS heartbeats re-arming finished animations
 *  2. Button not advancing after build_ok / audit_ok
 *  3. Double-click on action buttons during the click→heartbeat gap
 *
 * Run:  npx vitest run src/hooks/__tests__/deriveUIFromStatus.test.ts
 */
import { describe, it, expect } from 'vitest';
import { deriveUIFromStatus } from '../useContract';
import type { ContractStatus } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────
const status = (over: Partial<ContractStatus> = {}): ContractStatus => ({
  uid: 'test-uid',
  phase: 'pending',
  build_ok: false,
  audit_ok: false,
  build_attempt: 0,
  audit_attempt: 0,
  next_step: null,
  program_id: null,
  error: null,
  ...over,
} as ContractStatus);

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — initial states', () => {
  it('null status, no code → inactive button, no animation', () => {
    expect(deriveUIFromStatus(null, false)).toEqual({
      buttonState: 'inactive',
      animationStage: null,
    });
  });

  it('null status, has code → build button, no animation', () => {
    expect(deriveUIFromStatus(null, true)).toEqual({
      buttonState: 'build',
      animationStage: null,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — generation phases', () => {
  it('phase=enriching → generating animation + building loader', () => {
    const result = deriveUIFromStatus(status({ phase: 'enriching' }), false);
    expect(result.animationStage).toBe('generating');
    expect(result.buttonState).toBe('building');
  });

  it('phase=generating → generating animation', () => {
    const result = deriveUIFromStatus(status({ phase: 'generating' }), false);
    expect(result.animationStage).toBe('generating');
  });

  it('phase=generating but next_step=build → NO animation (parked at interrupt)', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'generating', next_step: 'build' }),
      true,
    );
    expect(result.animationStage).toBeNull();
    expect(result.buttonState).toBe('build');
  });

  it('phase=generated, next_step=build → build button, no animation', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'generated', next_step: 'build' }),
      true,
    );
    expect(result.buttonState).toBe('build');
    expect(result.animationStage).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — build flow', () => {
  it('phase=building, build_ok=false → building animation', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'building', build_ok: false }),
      true,
    );
    expect(result.animationStage).toBe('building');
    expect(result.buttonState).toBe('building');
  });

  it('phase=build_fixing → building animation continues', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'build_fixing' }),
      true,
    );
    expect(result.animationStage).toBe('building');
  });

  it('phase=learning → still building animation', () => {
    const result = deriveUIFromStatus(status({ phase: 'learning' }), true);
    expect(result.animationStage).toBe('building');
  });

  it('build_ok=true → button advances to audit, animation null', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'building', build_ok: true }),
      true,
    );
    expect(result.buttonState).toBe('audit');
    expect(result.animationStage).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — STALE HEARTBEAT regression', () => {
  // CRITICAL: This is the original bug. The WS sends heartbeats every 2s with
  // the last known phase. If build_ok=true but phase still says 'building',
  // the animation must NOT re-arm.

  it('stale heartbeat: phase=building + build_ok=true → no animation', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'building', build_ok: true }),
      true,
    );
    expect(result.animationStage).toBeNull();
    expect(result.buttonState).toBe('audit');
  });

  it('stale heartbeat: phase=auditing_static + audit_ok=true → no animation', () => {
    const result = deriveUIFromStatus(
      status({
        phase: 'auditing_static',
        build_ok: true,
        audit_ok: true,
      }),
      true,
    );
    expect(result.animationStage).toBeNull();
    expect(result.buttonState).toBe('publish');
  });

  it('stale heartbeat: phase=deploying + program_id set → upgrade button', () => {
    const result = deriveUIFromStatus(
      status({
        phase: 'deploying',
        build_ok: true,
        audit_ok: true,
        program_id: 'ABC123',
      }),
      true,
    );
    expect(result.animationStage).toBeNull();
    expect(result.buttonState).toBe('upgrade');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — audit flow', () => {
  it('phase=auditing_static, audit_ok=false → auditing animation', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'auditing_static', build_ok: true }),
      true,
    );
    expect(result.animationStage).toBe('auditing');
    expect(result.buttonState).toBe('auditing');
  });

  it('phase=auditing_llm → auditing animation continues', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'auditing_llm', build_ok: true }),
      true,
    );
    expect(result.animationStage).toBe('auditing');
  });

  it('phase=audit_fixing → auditing animation', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'audit_fixing', build_ok: true }),
      true,
    );
    expect(result.animationStage).toBe('auditing');
  });

  it('audit_ok=true → button advances to publish', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'auditing_llm', build_ok: true, audit_ok: true }),
      true,
    );
    expect(result.buttonState).toBe('publish');
    expect(result.animationStage).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — deploy flow', () => {
  it('phase=deploying, no program_id → deploying animation', () => {
    const result = deriveUIFromStatus(
      status({
        phase: 'deploying',
        build_ok: true,
        audit_ok: true,
      }),
      true,
    );
    expect(result.animationStage).toBe('deploying');
    expect(result.buttonState).toBe('publishing');
  });

  it('program_id set → upgrade button, no animation', () => {
    const result = deriveUIFromStatus(
      status({
        phase: 'done',
        build_ok: true,
        audit_ok: true,
        program_id: 'PROG123',
      }),
      true,
    );
    expect(result.buttonState).toBe('upgrade');
    expect(result.animationStage).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — OPTIMISTIC pendingStep override', () => {
  // CRITICAL: This is the double-click bug fix. When user clicks Build/Audit/Deploy,
  // pendingStep is set immediately and overrides the derivation until WS confirms.

  it('pendingStep=build, no status → building loader immediately', () => {
    const result = deriveUIFromStatus(null, true, 'build');
    expect(result.buttonState).toBe('building');
    expect(result.animationStage).toBe('building');
  });

  it('pendingStep=audit, build_ok=true → auditing loader immediately', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'done', build_ok: true }),
      true,
      'audit',
    );
    expect(result.buttonState).toBe('auditing');
    expect(result.animationStage).toBe('auditing');
  });

  it('pendingStep=deploy, audit_ok=true → publishing loader immediately', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'done', build_ok: true, audit_ok: true }),
      true,
      'deploy',
    );
    expect(result.buttonState).toBe('publishing');
    expect(result.animationStage).toBe('deploying');
  });

  it('pendingStep=deploy on a FAILED deploy (build_ok+audit_ok, no program_id) → publishing', () => {
    // Retry-deploy scenario: a prior deploy failed mid-upload, leaving
    // phase=failed with build_ok && audit_ok && !program_id. Clicking "Retry
    // deploy" sets pendingStep='deploy'; the optimistic override must pull the
    // UI out of the frozen failed state into the deploying animation
    // immediately — otherwise the button stays on the failed-state Retry path
    // and the user double-clicks into a 409.
    const result = deriveUIFromStatus(
      status({ phase: 'failed', build_ok: true, audit_ok: true }),
      true,
      'deploy',
    );
    expect(result.buttonState).toBe('publishing');
    expect(result.animationStage).toBe('deploying');
  });

  it('pendingStep=build on a paused_degraded status → building', () => {
    // Approve-regen / apply-proposal scenario: the pipeline auto-paused
    // (paused_degraded is terminal for streaming), the user approved a regen,
    // and we trigger the rebuild. The optimistic override must pull the UI out
    // of the frozen paused snapshot into the building animation immediately.
    const result = deriveUIFromStatus(
      status({ phase: 'paused_degraded', build_ok: false }),
      true,
      'build',
    );
    expect(result.buttonState).toBe('building');
    expect(result.animationStage).toBe('building');
  });

  it('pendingStep=build but build_ok=true → NO override (step already done)', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'done', build_ok: true }),
      true,
      'build',
    );
    expect(result.buttonState).toBe('audit'); // falls through to real logic
    expect(result.animationStage).toBeNull();
  });

  it('pendingStep=audit but audit_ok=true → NO override', () => {
    const result = deriveUIFromStatus(
      status({ build_ok: true, audit_ok: true }),
      true,
      'audit',
    );
    expect(result.buttonState).toBe('publish');
  });

  it('pendingStep=deploy but program_id set → NO override', () => {
    const result = deriveUIFromStatus(
      status({ build_ok: true, audit_ok: true, program_id: 'X' }),
      true,
      'deploy',
    );
    expect(result.buttonState).toBe('upgrade');
  });

  it('pendingStep=null behaves identically to undefined', () => {
    const a = deriveUIFromStatus(status({ build_ok: true }), true);
    const b = deriveUIFromStatus(status({ build_ok: true }), true, null);
    expect(a).toEqual(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — failure & terminal states', () => {
  it('phase=failed → no animation, falls through to flag-based button', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'failed', error: 'compile error' }),
      true,
    );
    expect(result.animationStage).toBeNull();
    expect(result.buttonState).toBe('build');
  });

  it('phase=done, build_ok=true → audit button', () => {
    const result = deriveUIFromStatus(
      status({ phase: 'done', build_ok: true }),
      true,
    );
    expect(result.buttonState).toBe('audit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deriveUIFromStatus — full lifecycle simulation', () => {
  it('simulates: idle → enrich → generate → build → audit → deploy → upgrade', () => {
    const seq: Array<[Partial<ContractStatus> | null, string]> = [
      [null, 'inactive'],
      [{ phase: 'enriching' }, 'building'],
      [{ phase: 'generating' }, 'building'],
      [{ phase: 'generated', next_step: 'build' }, 'build'],
      [{ phase: 'building' }, 'building'],
      [{ phase: 'build_fixing' }, 'building'],
      [{ phase: 'building', build_ok: true }, 'audit'],
      [{ phase: 'auditing_static', build_ok: true }, 'auditing'],
      [{ phase: 'auditing_llm', build_ok: true }, 'auditing'],
      [{ phase: 'audit_fixing', build_ok: true }, 'auditing'],
      [{ phase: 'done', build_ok: true, audit_ok: true }, 'publish'],
      [{ phase: 'deploying', build_ok: true, audit_ok: true }, 'publishing'],
      [
        {
          phase: 'done',
          build_ok: true,
          audit_ok: true,
          program_id: 'PROG',
        },
        'upgrade',
      ],
    ];

    for (const [over, expected] of seq) {
      const s = over === null ? null : status(over);
      const hasCode =
        !!over && (over.phase !== 'enriching' && over.phase !== 'generating');
      const result = deriveUIFromStatus(s, hasCode);
      expect(result.buttonState, `phase=${over?.phase ?? 'null'}`).toBe(expected);
    }
  });
});
