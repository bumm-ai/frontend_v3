'use client';

/**
 * Tranched-vault V2 demo hook: reads the vault, tranche mints and wallet
 * balances from devnet in one batched RPC call, and sends the six demo
 * actions through the connected wallet. Self-contained — talks straight to
 * devnet RPC, never to the BUMM backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { DEFAULT_MINT, ONE_TOKEN, PROGRAM_ID, RPC_URL, SENIOR_COUPON_BPS } from './constants';
import {
  ataFor,
  decodeMintSupply,
  decodeTokenAmount,
  decodeVault,
  deriveAddresses,
  explainProgramError,
  unwrapWalletError,
  faucetAuthorityFor,
  ixDeposit,
  ixOfftakerPayment,
  ixClaim,
  ixDrawCapital,
  ixFaucet,
  ixInitialize,
  ixInitializeMint2,
  ixRecordLoss,
  ixRedeem,
  ixRepayCapital,
  MINT_ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  type Tranche,
  type VaultAddresses,
  type VaultState,
} from './vaultTx';

export type ActionKind =
  | 'init'
  | 'faucet'
  | 'deposit_senior'
  | 'deposit_junior'
  | 'draw'
  | 'repay'
  | 'claim_senior'
  | 'claim_junior'
  | 'revenue'
  | 'loss'
  | 'redeem_senior'
  | 'redeem_junior';

export interface FeedEvent {
  kind: 'init' | 'faucet' | 'deposit' | 'draw' | 'repay' | 'claim' | 'revenue' | 'loss' | 'redeem';
  tranche?: Tranche;
  amount: bigint;
  /** senior_cut (revenue) / senior_absorbed (loss) */
  senior?: bigint;
  /** junior_cut (revenue) / junior_absorbed (loss) */
  junior?: bigint;
  /** Junior coupon consumed by a loss before any principal burned (V5). */
  spread?: bigint;
  signature: string;
  at: number;
}

export interface WalletBalances {
  asset: bigint;
  senior: bigint;
  junior: bigint;
}

export interface TrancheSupplies {
  senior: bigint;
  junior: bigint;
}

const ZERO = BigInt(0);

/** Parse one `BUMM_TRANCHE|...` program log line into a feed event. */
export function parseTrancheLog(
  logs: string[],
  signature: string,
): Omit<FeedEvent, 'at'> | null {
  const line = logs.find((l) => l.includes('BUMM_TRANCHE|'));
  if (!line) return null;
  const payload = line.slice(line.indexOf('BUMM_TRANCHE|') + 'BUMM_TRANCHE|'.length);
  const parts = payload.split('|');
  const fields = new Map<string, string>();
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0) fields.set(p.slice(0, eq), p.slice(eq + 1));
  }
  const big = (key: string) => {
    const v = fields.get(key);
    return v === undefined ? null : BigInt(v);
  };
  try {
    if (parts[0] === 'deposit') {
      const amount = big('amount');
      if (amount === null) return null;
      return {
        kind: 'deposit',
        tranche: fields.get('tranche') === 'junior' ? 'junior' : 'senior',
        amount,
        signature,
      };
    }
    if (parts[0] === 'draw') {
      const amount = big('amount');
      if (amount === null) return null;
      return { kind: 'draw', amount, signature };
    }
    if (parts[0] === 'repay') {
      const amount = big('amount');
      if (amount === null) return null;
      return { kind: 'repay', amount, signature };
    }
    if (parts[0] === 'claim') {
      const amount = big('amount');
      if (amount === null) return null;
      const tranche = fields.get('tranche') === 'senior' ? 'senior' : 'junior';
      return { kind: 'claim', tranche, amount, signature };
    }
    if (parts[0] === 'faucet') {
      const amount = big('amount');
      if (amount === null) return null;
      return { kind: 'faucet', amount, signature };
    }
    if (parts[0] === 'redeem') {
      const amount = big('amount');
      if (amount === null) return null;
      return {
        kind: 'redeem',
        tranche: fields.get('tranche') === 'junior' ? 'junior' : 'senior',
        amount,
        signature,
      };
    }
    if (fields.has('revenue')) {
      const amount = big('revenue');
      const senior = big('senior');
      const junior = big('junior');
      if (amount === null || senior === null || junior === null) return null;
      return { kind: 'revenue', amount, senior, junior, signature };
    }
    if (fields.has('loss')) {
      const amount = big('loss');
      const senior = big('senior');
      const junior = big('junior');
      if (amount === null || senior === null || junior === null) return null;
      // `spread` appears from V5 on; older transactions simply lack it.
      return { kind: 'loss', amount, senior, junior, spread: big('spread') ?? ZERO, signature };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Wait for a signature over plain HTTP.
 *
 * `connection.confirmTransaction` subscribes over WebSocket, and the RPC's
 * socket is not reachable from the browser here ("ws error: undefined"). The
 * subscription then never fires, so the call hangs until the blockhash
 * expires and reports an expiry for a transaction that in fact landed.
 * Polling `getSignatureStatuses` keeps confirmation on the same HTTP path
 * that already works.
 */
async function confirmBySignature(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
): Promise<void> {
  for (;;) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized'
    ) {
      return;
    }
    if ((await connection.getBlockHeight('confirmed')) > lastValidBlockHeight) {
      // The recent-status cache is shallow; check history before declaring a
      // failure, so a transaction that did land is never reported as expired.
      const historical = (
        await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
      ).value[0];
      if (historical && !historical.err) return;
      throw new Error('Blockhash not found — the transaction expired before it landed.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}

export function useVault() {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), []);
  const programId = useMemo(() => new PublicKey(PROGRAM_ID), []);

  // ?mint=<address> lets each recording take use a fresh vault without edits;
  // ?authority=<address> allows read-only viewing without a connected wallet.
  const [mint, setMint] = useState<PublicKey>(() => new PublicKey(DEFAULT_MINT));
  const [viewAuthority, setViewAuthority] = useState<PublicKey | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('mint');
    if (q) {
      try {
        setMint(new PublicKey(q));
      } catch {
        // ignore malformed override, keep default
      }
    }
    const a = params.get('authority');
    if (a) {
      try {
        setViewAuthority(new PublicKey(a));
      } catch {
        // ignore malformed override
      }
    }
  }, []);

  // ?authority= takes precedence so anyone can open the OPERATOR's vault and
  // see the investor view with the operator console locked; without the param
  // the page shows the connected wallet's own vault as before.
  const effectiveAuthority = viewAuthority ?? publicKey;

  /** Connected wallet is the authority of the vault being shown. */
  const isOperator =
    publicKey !== null && effectiveAuthority !== null && publicKey.equals(effectiveAuthority);

  const addresses: VaultAddresses | null = useMemo(() => {
    if (!effectiveAuthority) return null;
    return deriveAddresses(programId, mint, effectiveAuthority);
  }, [effectiveAuthority, mint, programId]);

  const [vault, setVault] = useState<VaultState | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({
    asset: ZERO,
    senior: ZERO,
    junior: ZERO,
  });
  const [supplies, setSupplies] = useState<TrancheSupplies>({ senior: ZERO, junior: ZERO });
  // Peak principal seen for this vault. `senior_deposited` shrinks on redeem,
  // so it cannot answer "what did this tranche put in" once the position is
  // closed — and the exit is exactly when the return matters. Keyed by vault
  // so switching mints starts a fresh tally.
  const [invested, setInvested] = useState<{ key: string; senior: bigint; junior: bigint }>({
    key: '',
    senior: ZERO,
    junior: ZERO,
  });
  const [vaultLiquidity, setVaultLiquidity] = useState<bigint>(ZERO);
  const [solLamports, setSolLamports] = useState<number | null>(null);
  /** Stamped on every confirmed action so amount inputs can clear themselves. */
  const [lastSuccess, setLastSuccess] = useState<{ kind: ActionKind; at: number } | null>(null);
  /** Signature of the transaction signAndSend just confirmed. */
  const lastSignatureRef = useRef<string>('');
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!addresses || !effectiveAuthority) return;
    const keys = [
      addresses.vault,
      addresses.vaultTokens,
      addresses.seniorMint,
      addresses.juniorMint,
      ataFor(effectiveAuthority, mint),
      ataFor(effectiveAuthority, addresses.seniorMint),
      ataFor(effectiveAuthority, addresses.juniorMint),
    ];
    const infos = await connection.getMultipleAccountsInfo(keys);
    const decoded = infos[0] ? decodeVault(infos[0].data) : null;
    setVault(decoded);
    const key = addresses.vault.toBase58();
    setInvested((prev) => {
      const base = prev.key === key ? prev : { key, senior: ZERO, junior: ZERO };
      if (!decoded) return base;
      return {
        key,
        senior: decoded.seniorDeposited > base.senior ? decoded.seniorDeposited : base.senior,
        junior: decoded.juniorDeposited > base.junior ? decoded.juniorDeposited : base.junior,
      };
    });
    setVaultLiquidity(decodeTokenAmount(infos[1]?.data ?? null));
    setSupplies({
      senior: decodeMintSupply(infos[2]?.data ?? null),
      junior: decodeMintSupply(infos[3]?.data ?? null),
    });
    setBalances({
      asset: decodeTokenAmount(infos[4]?.data ?? null),
      senior: decodeTokenAmount(infos[5]?.data ?? null),
      junior: decodeTokenAmount(infos[6]?.data ?? null),
    });
    if (publicKey) {
      setSolLamports(await connection.getBalance(publicKey).catch(() => null));
    }
    setLoaded(true);
  }, [addresses, connection, effectiveAuthority, mint, publicKey]);

  const bootstrapped = useRef<string | null>(null);
  useEffect(() => {
    const key = addresses?.vault.toBase58() ?? null;
    if (key && bootstrapped.current !== key) {
      bootstrapped.current = key;
      void refresh();
    }
  }, [addresses, refresh]);

  /**
   * Sign with the wallet, then broadcast through THIS page's RPC.
   *
   * `sendTransaction` hands the whole job to the wallet, which broadcasts and
   * simulates on its own node — a link we neither control nor can diagnose
   * (it surfaces every failure as a bare "Unexpected error"). Signing locally
   * and sending ourselves keeps the wallet to the one thing only it can do.
   * Falls back to the adapter when a wallet exposes no signTransaction.
   */
  const signAndSend = useCallback(
    async (
      instructions: TransactionInstruction[],
      extraSigners: Keypair[] = [],
    ): Promise<void> => {
      if (!publicKey) throw new Error('wallet not connected');
      // A blockhash is only good for ~150 slots (~60s), and that clock runs
      // while the wallet popup waits for a human. With several extensions
      // installed the popup alone can eat most of it, so one expiry gets a
      // silent second run on a fresh blockhash rather than an error.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction().add(...instructions);
        tx.feePayer = publicKey;
        tx.recentBlockhash = blockhash;
        if (extraSigners.length > 0) tx.partialSign(...extraSigners);
        let signature: string;
        try {
          signature = signTransaction
            ? await connection.sendRawTransaction((await signTransaction(tx)).serialize(), {
                preflightCommitment: 'confirmed',
                maxRetries: 3,
              })
            : await sendTransaction(tx, connection, { signers: extraSigners });
        } catch (e) {
          // Nothing was broadcast, so a fresh blockhash can be tried safely.
          lastError = e;
          const { message } = unwrapWalletError(e);
          const expired = /[Bb]lockhash not found|block height exceeded/.test(message);
          if (!expired || attempt === 1) throw e;
          continue;
        }
        // Past this point the transaction IS on the wire: never resend it on a
        // new blockhash, or a deposit could execute twice.
        await confirmBySignature(connection, signature, lastValidBlockHeight);
        lastSignatureRef.current = signature;
        return;
      }
      throw lastError;
    },
    [connection, publicKey, sendTransaction, signTransaction],
  );

  const act = useCallback(
    async (kind: ActionKind, tokens: bigint) => {
      if (!publicKey || pending) return;
      setPending(kind);
      setError(null);
      const amount = tokens * ONE_TOKEN;
      try {
        const ix =
          kind === 'init'
            ? ixInitialize(programId, publicKey, mint, SENIOR_COUPON_BPS, BigInt(10_000) * ONE_TOKEN, 36)
            : kind === 'faucet'
              ? ixFaucet(programId, publicKey, mint, amount)
              : kind === 'deposit_senior'
                ? ixDeposit('senior', programId, publicKey, mint, amount)
                : kind === 'deposit_junior'
                  ? ixDeposit('junior', programId, publicKey, mint, amount)
                  : kind === 'draw'
                    ? ixDrawCapital(programId, publicKey, mint, amount)
                    : kind === 'repay'
                      ? ixRepayCapital(programId, publicKey, mint, amount)
                      : kind === 'claim_senior'
                        ? ixClaim('senior', programId, publicKey, mint)
                        : kind === 'claim_junior'
                          ? ixClaim('junior', programId, publicKey, mint)
                    : kind === 'revenue'
                      ? ixOfftakerPayment(programId, publicKey, mint, amount)
                      : kind === 'loss'
                        ? ixRecordLoss(programId, publicKey, mint, amount)
                        : kind === 'redeem_senior'
                          ? ixRedeem('senior', programId, publicKey, mint, amount)
                          : ixRedeem('junior', programId, publicKey, mint, amount);

        // Preflight: simulate before asking the wallet to sign, so a doomed
        // transaction surfaces the program's own reason here instead of an
        // opaque red failure inside the wallet popup. Simulated as a v0
        // message with replaceRecentBlockhash so the RPC supplies its own
        // blockhash — otherwise a slightly stale one fails the simulation
        // itself with BlockhashNotFound, which tells the user nothing.
        const probeMessage = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: PublicKey.default.toBase58(),
          instructions: [ix],
        }).compileToV0Message();
        const sim = await connection.simulateTransaction(new VersionedTransaction(probeMessage), {
          sigVerify: false,
          replaceRecentBlockhash: true,
        });
        if (sim.value.err) {
          setError(explainProgramError(sim.value.logs, JSON.stringify(sim.value.err)));
          return;
        }

        await signAndSend([ix]);
        const signature = lastSignatureRef.current;

        const parsed = await connection
          .getTransaction(signature, { maxSupportedTransactionVersion: 0 })
          .then((t) =>
            t?.meta?.logMessages ? parseTrancheLog(t.meta.logMessages, signature) : null,
          )
          .catch(() => null);

        await refresh();

        const fallbackKind: FeedEvent['kind'] =
          kind === 'deposit_senior' || kind === 'deposit_junior'
            ? 'deposit'
            : kind === 'redeem_senior' || kind === 'redeem_junior'
              ? 'redeem'
              : kind === 'claim_senior' || kind === 'claim_junior'
              ? 'claim'
              : kind === 'draw' || kind === 'repay' || kind === 'revenue' || kind === 'faucet' || kind === 'init'
                ? kind
                : 'loss';
        const ev: FeedEvent = parsed
          ? { ...parsed, at: Date.now() }
          : { kind: fallbackKind, amount, signature, at: Date.now() };
        setEvents((prev) => [ev, ...prev]);
        setLastSuccess({ kind, at: ev.at });
      } catch (e) {
        const { message, logs } = unwrapWalletError(e);
        setError(explainProgramError(logs, message));
      } finally {
        setPending(null);
      }
    },
    [connection, mint, pending, programId, publicKey, refresh, signAndSend],
  );

  // "Fresh run": create a brand-new demo asset mint (authority = faucet PDA)
  // and reload the page pointed at it — a clean vault for a clean take,
  // entirely from the UI.
  const [creatingMint, setCreatingMint] = useState(false);
  const startFreshRun = useCallback(async () => {
    if (!publicKey || creatingMint) return;
    setCreatingMint(true);
    setError(null);
    try {
      const mintKp = Keypair.generate();
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE);
      const instructions = [
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKp.publicKey,
          space: MINT_ACCOUNT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        ixInitializeMint2(mintKp.publicKey, 6, faucetAuthorityFor(programId, mintKp.publicKey)),
      ];
      await signAndSend(instructions, [mintKp]);
      const url = new URL(window.location.href);
      url.searchParams.set('mint', mintKp.publicKey.toBase58());
      window.location.href = url.toString();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreatingMint(false);
    }
  }, [connection, creatingMint, programId, publicKey, signAndSend]);

  return {
    connected,
    publicKey,
    isOperator,
    viewOnly: !isOperator && viewAuthority !== null,
    mint,
    addresses,
    vault,
    balances,
    supplies,
    invested,
    vaultLiquidity,
    events,
    pending,
    error,
    loaded,
    solLamports,
    lastSuccess,
    refresh,
    act,
    creatingMint,
    startFreshRun,
  };
}
