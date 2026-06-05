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

/**
 * Solana Explorer URL for either an address/program or a transaction signature,
 * on the given network. Shares cluster-param logic with {@link explorerAddressUrl}
 * (mainnet-beta is the Explorer default, so its param is omitted).
 */
export function buildExplorerUrl(
  kind: 'address' | 'tx',
  value: string,
  network?: Network | string | null,
): string {
  const cluster = network || 'devnet';
  const param = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/${kind}/${value}${param}`;
}
