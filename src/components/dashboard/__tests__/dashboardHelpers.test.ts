import { describe, it, expect } from 'vitest';
import { phaseToAction, mapPhaseToStatus, SCRATCH_UID } from '../dashboardHelpers';

describe('phaseToAction', () => {
  it('deployed contracts offer an upgrade', () => {
    expect(phaseToAction('deployed', true)).toBe('upgrade');
    expect(phaseToAction('built', true, true)).toBe('upgrade'); // isDeployed beats status
  });

  it('walks the pipeline ladder: audited→publish, built→audit, generated→build', () => {
    expect(phaseToAction('audited', true)).toBe('publish');
    expect(phaseToAction('built', true)).toBe('audit');
    expect(phaseToAction('generated', false)).toBe('build');
  });

  it('hasCode forces build even when status is otherwise inactive', () => {
    expect(phaseToAction('draft', true)).toBe('build');
  });

  it('no code and no milestone is inactive', () => {
    expect(phaseToAction('draft', false)).toBe('inactive');
  });
});

describe('mapPhaseToStatus', () => {
  it('an on-chain program is deployed regardless of phase', () => {
    expect(mapPhaseToStatus('building', 'PROG_ID')).toBe('deployed');
    expect(mapPhaseToStatus('failed', 'PROG_ID')).toBe('deployed');
  });

  it('maps live phases to milestones', () => {
    expect(mapPhaseToStatus('enriching')).toBe('initializing');
    expect(mapPhaseToStatus('generating')).toBe('in-progress');
    expect(mapPhaseToStatus('generated')).toBe('generated');
    expect(mapPhaseToStatus('auditing_llm')).toBe('built');
    expect(mapPhaseToStatus('deploying')).toBe('audited');
    expect(mapPhaseToStatus('done')).toBe('completed');
  });

  it('terminal phases surface the HIGHEST milestone actually reached', () => {
    expect(mapPhaseToStatus('failed', null, true, true)).toBe('audited');
    expect(mapPhaseToStatus('failed', null, true, false)).toBe('built');
    expect(mapPhaseToStatus('paused_degraded', null, false, false)).toBe('draft');
    expect(mapPhaseToStatus('cancelled', null, true, false)).toBe('built');
  });

  it('unknown phase falls back to in-progress', () => {
    expect(mapPhaseToStatus('some_new_phase')).toBe('in-progress');
  });
});

describe('SCRATCH_UID', () => {
  it('is the stable scratch slot key', () => {
    expect(SCRATCH_UID).toBe('__scratch__');
  });
});
