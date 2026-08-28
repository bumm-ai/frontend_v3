import { describe, it, expect } from 'vitest';
import {
  DEBATE_AUDIT_COST,
  debateAuditErrorMessage,
  debateAuditSummary,
} from '../debateAudit';

describe('debateAuditErrorMessage', () => {
  it('explains a 404 as a server that predates the endpoint, not a missing contract', () => {
    // The bug this guards: FastAPI's raw "Not Found" detail reached the user
    // whenever the deployed API lacked /debate-audit.
    const msg = debateAuditErrorMessage(404, 'Not Found');
    expect(msg).not.toMatch(/not found/i);
    expect(msg).toMatch(/not available on this server/i);
  });

  it('names the credit price on 402', () => {
    expect(debateAuditErrorMessage(402, 'x')).toContain(String(DEBATE_AUDIT_COST));
  });

  it('maps the documented failure modes', () => {
    expect(debateAuditErrorMessage(409, 'x')).toMatch(/no code/i);
    expect(debateAuditErrorMessage(503, 'x')).toMatch(/temporarily unavailable/i);
    expect(debateAuditErrorMessage(429, 'x')).toMatch(/too many/i);
    expect(debateAuditErrorMessage(401, 'x')).toMatch(/session expired/i);
    expect(debateAuditErrorMessage(403, 'x')).toMatch(/session expired/i);
  });

  it('reassures about billing on any 5xx', () => {
    expect(debateAuditErrorMessage(500, 'x')).toMatch(/not charged/i);
    expect(debateAuditErrorMessage(502, 'x')).toMatch(/not charged/i);
  });

  it('falls back to the raw message, then to a generic one', () => {
    expect(debateAuditErrorMessage(418, 'teapot')).toBe('teapot');
    expect(debateAuditErrorMessage(undefined, '')).toBe('Premium audit failed.');
  });
});

describe('debateAuditSummary', () => {
  it('singularises one finding and one model', () => {
    expect(
      debateAuditSummary({
        vulnCount: 1,
        modelsSucceeded: 1,
        modelsFailed: 0,
        creditsCharged: 12,
      }),
    ).toBe('1 finding · 1 model · −12 cr');
  });

  it('pluralises and reports failed models', () => {
    expect(
      debateAuditSummary({
        vulnCount: 3,
        modelsSucceeded: 2,
        modelsFailed: 1,
        creditsCharged: 12,
      }),
    ).toBe('3 findings · 2 models (1 failed) · −12 cr');
  });

  it('handles a clean audit with no findings', () => {
    expect(
      debateAuditSummary({
        vulnCount: 0,
        modelsSucceeded: 3,
        modelsFailed: 0,
        creditsCharged: 12,
      }),
    ).toBe('0 findings · 3 models · −12 cr');
  });
});
