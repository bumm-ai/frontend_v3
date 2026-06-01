import type { Network } from './api';

/**
 * Solana Explorer URL for a deployed program/account, on the contract's
 * ACTUAL network (fe-06).
 *
 * Previously every link hardcoded `?cluster=devnet`, so a contract deployed
 * to testnet/mainnet pointed at the wrong cluster and rendered
 * "account not found". mainnet-beta is the Explorer default, so we omit the
 * param there; devnet/testnet need it explicitly. Falls back to devnet when
 * the network is unknown (preserves prior behaviour for legacy rows).
 */
export function explorerAddressUrl(
  address: string,
  network?: Network | string | null,
): string {
  const cluster = network || 'devnet';
  const param = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${param}`;
}
