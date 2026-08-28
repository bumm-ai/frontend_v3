// F3 — Template gallery data.
//
// Pure, side-effect-free card definitions for the empty-chat "what can I build?"
// gallery. Each card carries a ready-to-edit English `starterPrompt` that the
// user can drop into the chat input and tweak before hitting Generate.
//
// `contractType` mirrors the backend `ContractType` vocabulary used by
// extract_intent (nft_mint | nft_collection | spl_token | escrow | staking |
// defi_amm | lending | counter | custom) so a card maps 1:1 onto the type the
// pipeline will infer from its prompt.

/** Canonical contract types recognised by the backend intent extractor. */
export type ContractType =
  | 'spl_token'
  | 'staking'
  | 'nft_mint'
  | 'nft_collection'
  | 'escrow'
  | 'defi_amm'
  | 'lending'
  | 'counter';

export interface TemplateCard {
  /** Stable, unique id (also used as React key). */
  id: string;
  /** Backend ContractType this card maps to. */
  contractType: ContractType;
  /** Short human label shown on the card. */
  label: string;
  /** Emoji glyph used as the card icon (no extra asset deps). */
  emoji: string;
  /** One-line description of what the contract does. */
  description: string;
  /** Ready-to-send English prompt that describes the contract for generation. */
  starterPrompt: string;
}

/**
 * Gallery cards, ordered roughly easiest → most advanced so a new user lands
 * on approachable options first.
 */
export const TEMPLATE_CARDS: readonly TemplateCard[] = [
  {
    id: 'spl-token',
    contractType: 'spl_token',
    label: 'SPL Token',
    emoji: '🪙',
    description: 'Mint a fungible token with name, symbol, and supply.',
    starterPrompt:
      'Create an SPL token contract on Solana using Anchor. It should mint a ' +
      'fungible token with a configurable name, symbol, 9 decimals, and an ' +
      'initial supply minted to the creator. Attach Metaplex token metadata so ' +
      'the token shows up properly in wallets and explorers.',
  },
  {
    id: 'nft-mint',
    contractType: 'nft_mint',
    label: 'NFT Mint',
    emoji: '🖼️',
    description: 'Mint a single 1-of-1 NFT with Metaplex metadata.',
    starterPrompt:
      'Create a Solana Anchor program that mints a single 1-of-1 NFT. It should ' +
      'create the mint with 0 decimals, mint one token to the buyer, create the ' +
      'Metaplex metadata account and a master edition so it is a true ' +
      'non-fungible token with on-chain name, symbol, and URI.',
  },
  {
    id: 'nft-collection',
    contractType: 'nft_collection',
    label: 'NFT Collection',
    emoji: '🎨',
    description: 'A verified collection that mints many NFTs under it.',
    starterPrompt:
      'Create a Solana Anchor program for an NFT collection. It should set up a ' +
      'verified Metaplex collection NFT, then allow minting individual NFTs that ' +
      'are verified as members of that collection, each with its own metadata ' +
      'and master edition. Include a configurable mint price paid in SOL.',
  },
  {
    id: 'staking',
    contractType: 'staking',
    label: 'Token Staking',
    emoji: '🥩',
    description: 'Stake SPL tokens and earn time-based rewards.',
    starterPrompt:
      'Create a Solana Anchor staking program. Users deposit an SPL token into a ' +
      'program-owned vault and earn rewards proportional to the amount staked and ' +
      'the time elapsed. Track each user stake in a PDA, and support stake, ' +
      'unstake, and claim-rewards instructions with safe checked math.',
  },
  {
    id: 'escrow',
    contractType: 'escrow',
    label: 'Escrow Swap',
    emoji: '🤝',
    description: 'Trustless atomic swap of two SPL tokens between two parties.',
    starterPrompt:
      'Create a Solana Anchor escrow program for a trustless atomic swap between ' +
      'two parties. The maker deposits token A into a program-owned vault and ' +
      'sets the amount of token B they want in return; the taker fulfils the ' +
      'trade by sending token B, which atomically releases token A. Support ' +
      'initialize, exchange, and cancel (refund the maker) instructions.',
  },
  {
    id: 'defi-amm',
    contractType: 'defi_amm',
    label: 'AMM Pool',
    emoji: '💧',
    description: 'Constant-product liquidity pool with swaps and LP tokens.',
    starterPrompt:
      'Create a Solana Anchor AMM (automated market maker) program with a ' +
      'constant-product (x*y=k) liquidity pool for two SPL tokens. Support ' +
      'initializing a pool, adding and removing liquidity with LP tokens minted ' +
      'to providers, and swapping between the two tokens with a configurable ' +
      'fee in basis points.',
  },
  {
    id: 'lending',
    contractType: 'lending',
    label: 'Lending Market',
    emoji: '🏦',
    description: 'Deposit collateral, borrow against it, repay with interest.',
    starterPrompt:
      'Create a Solana Anchor lending program. Users deposit an SPL token as ' +
      'collateral into a program vault and can borrow another SPL token against ' +
      'it up to a configurable collateral factor. Track per-user positions in a ' +
      'PDA, accrue interest over time, and support deposit, borrow, repay, and ' +
      'withdraw instructions with safe checked math.',
  },
  {
    id: 'counter',
    contractType: 'counter',
    label: 'Counter',
    emoji: '🔢',
    description: 'Minimal on-chain counter — great first contract to ship.',
    starterPrompt:
      'Create a minimal Solana Anchor counter program. It should initialize a ' +
      'counter account owned by the user (stored in a PDA) and expose increment ' +
      'and decrement instructions that update the stored value with safe ' +
      'checked math. Keep it simple — this is a learning example.',
  },
] as const;

/** Lookup a single card by id (undefined if not found). */
export function getTemplateCard(id: string): TemplateCard | undefined {
  return TEMPLATE_CARDS.find((c) => c.id === id);
}
