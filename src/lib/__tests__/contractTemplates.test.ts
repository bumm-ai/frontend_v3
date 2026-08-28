import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_CARDS,
  getTemplateCard,
  type ContractType,
} from '@/lib/contractTemplates';

// The canonical ContractType vocabulary from the backend intent extractor
// (extract_intent.py). Kept here as a guard so a card never maps onto a type
// the pipeline doesn't recognise.
const BACKEND_CONTRACT_TYPES: ReadonlySet<ContractType> = new Set([
  'spl_token',
  'staking',
  'nft_mint',
  'nft_collection',
  'escrow',
  'defi_amm',
  'lending',
  'counter',
]);

describe('TEMPLATE_CARDS', () => {
  it('is non-empty', () => {
    expect(TEMPLATE_CARDS.length).toBeGreaterThan(0);
  });

  it('every card has a non-empty id, label, emoji, description, and starterPrompt', () => {
    for (const card of TEMPLATE_CARDS) {
      expect(card.id.trim()).not.toBe('');
      expect(card.label.trim()).not.toBe('');
      expect(card.emoji.trim()).not.toBe('');
      expect(card.description.trim()).not.toBe('');
      expect(card.starterPrompt.trim()).not.toBe('');
    }
  });

  it('starter prompts are substantial (not placeholder stubs)', () => {
    for (const card of TEMPLATE_CARDS) {
      // A real generation prompt should be more than a couple of words.
      expect(card.starterPrompt.length).toBeGreaterThan(40);
    }
  });

  it('card ids are unique', () => {
    const ids = TEMPLATE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every card maps onto a backend ContractType', () => {
    for (const card of TEMPLATE_CARDS) {
      expect(BACKEND_CONTRACT_TYPES.has(card.contractType)).toBe(true);
    }
  });
});

describe('getTemplateCard', () => {
  it('returns the matching card by id', () => {
    const first = TEMPLATE_CARDS[0];
    expect(getTemplateCard(first.id)).toEqual(first);
  });

  it('returns undefined for an unknown id', () => {
    expect(getTemplateCard('does-not-exist')).toBeUndefined();
  });
});
