import { describe, it, expect } from 'vitest';
import {
  phaseStatusLabel,
  shouldClearPendingStep,
  appliedFixMessage,
  filterPipelineNoise,
  deriveEarlyName,
  successfulFixes,
  buildSuccessMessage,
  deployEstimateLine,
  auditCompleteMessage,
  buildFailedMessage,
} from '../contractTransitions';
import type { ContractStatus, DeployEstimate } from '@/lib/api';
import type { ChatMessage } from '@/types/dashboard';

// Minimal ContractStatus factory — only fields the helpers read matter. Loosely
// typed so tests can exercise arbitrary/unknown phase strings.
function status(over: Record<string, unknown> = {}): NonNullable<ContractStatus> {
  return { phase: 'generating', ...over } as unknown as NonNullable<ContractStatus>;
}

function msg(content: string, isUser = false): ChatMessage {
  return { id: content, content, isUser, timestamp: new Date(0) } as ChatMessage;
}

describe('phaseStatusLabel', () => {
  it('maps known phases to their bubble label', () => {
    expect(phaseStatusLabel(status({ phase: 'generating' }))).toContain('Generating');
    expect(phaseStatusLabel(status({ phase: 'deploying' }))).toContain('Deploying');
    expect(phaseStatusLabel(status({ phase: 'done' }))).toContain('deployed');
  });

  it('embeds the error count + attempt for build_fixing', () => {
    const label = phaseStatusLabel(
      status({ phase: 'build_fixing', build_errors_count: 3, build_attempt: 2 }),
    );
    expect(label).toContain('Auto-fixing 3 errors');
    expect(label).toContain('attempt 2');
  });

  it('falls back for unknown phases', () => {
    expect(phaseStatusLabel(status({ phase: 'weird_phase' }))).toBe('⚙️ weird_phase...');
  });

  it('shows the error on failed', () => {
    expect(phaseStatusLabel(status({ phase: 'failed', error: 'boom' }))).toContain('boom');
  });
});

describe('shouldClearPendingStep', () => {
  it('clears build when build is active or done', () => {
    expect(shouldClearPendingStep('build', status({ phase: 'building' }))).toBe(true);
    expect(shouldClearPendingStep('build', status({ phase: 'generating', build_ok: true }))).toBe(true);
    expect(shouldClearPendingStep('build', status({ phase: 'enriching' }))).toBe(false);
  });

  it('clears deploy when a program id appears or deploying', () => {
    expect(shouldClearPendingStep('deploy', status({ phase: 'deploying' }))).toBe(true);
    expect(shouldClearPendingStep('deploy', status({ phase: 'x', program_id: 'PID' }))).toBe(true);
  });

  it('clears any pending step on a terminal phase', () => {
    expect(shouldClearPendingStep(null, status({ phase: 'failed' }))).toBe(true);
    expect(shouldClearPendingStep(null, status({ phase: 'paused_degraded' }))).toBe(true);
    expect(shouldClearPendingStep(null, status({ phase: 'generating' }))).toBe(false);
  });
});

describe('appliedFixMessage', () => {
  it('tags KB vs AI sources and strips hard_rule prefix', () => {
    const kb = appliedFixMessage(
      status({ last_fix_source: 'knowledge_base', last_fix_description: 'hard_rule: add seeds' }),
    );
    expect(kb).toContain('_(KB)_');
    expect(kb).toContain('add seeds');
    expect(kb).not.toContain('hard_rule');
    expect(appliedFixMessage(status({ last_fix_source: 'llm_generated', last_fix_description: 'x' }))).toContain('_(AI)_');
  });
});

describe('filterPipelineNoise', () => {
  it('drops emoji-prefixed transient bubbles, keeps real messages', () => {
    const kept = filterPipelineNoise([
      msg('⏳ Queued'),
      msg('Build a staking contract', true),
      msg('🔧 Building...'),
      msg('**Build succeeded**'),
    ]);
    expect(kept.map((m) => m.content)).toEqual(['Build a staking contract', '**Build succeeded**']);
  });
});

describe('deriveEarlyName', () => {
  it('uses the first user message, truncated at 40 chars', () => {
    expect(deriveEarlyName([msg('Make a token', true)], 'abcdef12-xxxx')).toBe('Make a token');
    const long = 'x'.repeat(50);
    expect(deriveEarlyName([msg(long, true)], 'u')).toBe('x'.repeat(40) + '...');
  });

  it('falls back to a uid-derived name when there is no user message', () => {
    expect(deriveEarlyName([msg('🔧 noise')], 'abcdef1234')).toBe('Contract abcdef12');
  });
});

describe('successfulFixes / buildSuccessMessage', () => {
  it('excludes explicitly-unsuccessful fixes', () => {
    expect(
      successfulFixes([{ was_successful: false }, { was_successful: true }, { was_successful: null }]),
    ).toHaveLength(2);
  });

  it('first-attempt clean build', () => {
    expect(buildSuccessMessage(1, [])).toContain('first attempt');
  });

  it('multi-attempt with a fix breakdown + KB/LLM source split', () => {
    const m = buildSuccessMessage(3, [
      { error_pattern: 'E0412', fix_description: 'import X', source: 'knowledge_base', was_successful: true },
      { error_pattern: 'E0382', fix_description: 'clone', source: 'llm_generated', was_successful: true },
    ]);
    expect(m).toContain('Build succeeded** after 3 attempts');
    expect(m).toContain('Auto-fixed 2 compile errors');
    expect(m).toContain('1 from KB, 1 LLM-generated');
    expect(m).toContain('E0412');
  });

  it('caps the visible list at 8 with an overflow note', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ error_pattern: `E${i}`, was_successful: true }));
    expect(buildSuccessMessage(11, many)).toContain('and 2 more');
  });
});

describe('deployEstimateLine', () => {
  it('is empty without an estimate', () => {
    expect(deployEstimateLine(null)).toBe('');
  });

  it('renders the SOL fee and a top-up warning when insufficient', () => {
    const est = {
      estimated_sol: 0.00123,
      estimated_credits: 2,
      network: 'devnet',
      sufficient: false,
      missing_credits: 1,
    } as DeployEstimate;
    const line = deployEstimateLine(est);
    expect(line).toContain('0.0012 SOL');
    expect(line).toContain('short by 1 credit');
  });
});

describe('auditCompleteMessage', () => {
  it('clean pass when no vulns', () => {
    const m = auditCompleteMessage({ vulns: [], attempts: 1, buildFixCount: 0, deployEst: null });
    expect(m).toContain('Audit passed on the first try');
    expect(m).toContain('Click **Publish**');
  });

  it('groups vulns by severity (critical first) and counts them', () => {
    const m = auditCompleteMessage({
      vulns: [
        { severity: 'low', title: 'L1' },
        { severity: 'critical', title: 'C1' },
        { severity: 'critical', title: 'C2' },
      ],
      attempts: 2,
      buildFixCount: 1,
      deployEst: null,
    });
    expect(m).toContain('patched **3** issues');
    expect(m).toContain('CRITICAL (2)');
    expect(m.indexOf('CRITICAL')).toBeLessThan(m.indexOf('LOW'));
    expect(m).toContain('Compile-time fixes: **1**');
  });
});

describe('buildFailedMessage', () => {
  it('uses the humanized desc with raw error as technical detail', () => {
    const m = buildFailedMessage('Missing account', 'E0599 long raw');
    expect(m).toContain('Missing account');
    expect(m).toContain('Technical detail: E0599 long raw');
  });

  it('falls back to the raw error when no humanized desc', () => {
    expect(buildFailedMessage('', 'raw only')).toContain('raw only');
  });
});
