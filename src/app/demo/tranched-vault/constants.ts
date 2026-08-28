// Demo-only constants. This page is isolated under src/app/demo/ and is
// removed wholesale after the demo (rm -rf src/app/demo/) — nothing here is
// imported by the rest of the app.
export const PROGRAM_ID = 'DvqUzXXWUdLqCnpy6Nb59PY29oVamfC7ME6bNimHxCGa';

// Default mock-USDC mint; override per take with ?mint=<address> for a fresh vault.
export const DEFAULT_MINT = 'JiCmJ1BfvYeNyrNLCscH7RNAy34qDsUSQRaSg4ohWcL';

// Devnet RPC. The URL is inlined into the client bundle at build time, so no
// keyed endpoint may ever appear here — set NEXT_PUBLIC_DEMO_RPC (local:
// .env.local, Vercel: project env) to use a dedicated RPC; the public
// endpoint is the keyless fallback (flakier on camera, fine otherwise).
export const RPC_URL =
  process.env.NEXT_PUBLIC_DEMO_RPC ?? 'https://api.devnet.solana.com';

export const SOLSCAN_TX = (sig: string) =>
  `https://solscan.io/tx/${sig}?cluster=devnet`;
export const SOLSCAN_ACCOUNT = (addr: string) =>
  `https://solscan.io/account/${addr}?cluster=devnet`;

export const TOKEN_DECIMALS = 6;
// No bigint literals: the app tsconfig targets pre-ES2020.
export const ONE_TOKEN = BigInt(10) ** BigInt(TOKEN_DECIMALS);

// Display-only facts about the simulated offtake contract being securitized.
// The monthly amount and term are stored on-chain by `initialize`; the label
// is cosmetic. Mirrors the deck's example: $10k/month for 3 years.
export const OFFTAKE_LABEL = 'GPU offtake #001 · contracted AI compute buyer';
export const ASSET_LABEL = 'mock USDC · 6 decimals · devnet';

export const SENIOR_SYMBOL = 'sTCV';
export const JUNIOR_SYMBOL = 'jTCV';

/**
 * Senior coupon in basis points, used when this page creates a vault.
 * 600 = 6%, matching the deck's senior slice. Existing vaults keep whatever
 * rate they were initialized with — the UI always reads it back on-chain.
 */
export const SENIOR_COUPON_BPS = 600;
