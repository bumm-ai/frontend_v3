/** Shared formatting helpers for the tranched-vault demo page. */

import { ONE_TOKEN, SOLSCAN_ACCOUNT } from './constants';

export function fmt(unitsE6: bigint): string {
  return (unitsE6 / ONE_TOKEN).toLocaleString('en-US');
}

export function short(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function parseTokens(s: string): bigint | null {
  const clean = s.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(clean) || clean === '0') return null;
  return BigInt(clean);
}

export function AddrLink({ addr, className }: { addr: string; className?: string }) {
  return (
    <a
      href={SOLSCAN_ACCOUNT(addr)}
      target="_blank"
      rel="noreferrer"
      className={`font-mono underline decoration-dotted underline-offset-2 hover:text-white ${className ?? ''}`}
    >
      {short(addr)}
    </a>
  );
}
