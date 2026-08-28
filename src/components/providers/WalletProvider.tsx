'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { Coin98WalletAdapter } from '@solana/wallet-adapter-coin98';
import { TrustWalletAdapter } from '@solana/wallet-adapter-trust';
import { clusterApiUrl } from '@solana/web3.js';

// H7 Stage-0: network + RPC are env-driven so mainnet self-deploy is possible.
// Defaults are unchanged (devnet + public clusterApiUrl) — behaviour is identical
// until NEXT_PUBLIC_SOLANA_NETWORK / NEXT_PUBLIC_SOLANA_RPC_URL are set. A
// dedicated RPC (Helius/QuickNode) is REQUIRED before enabling mainnet
// self-deploy: public mainnet RPC throttles the many buffer-write txs.
function resolveNetwork(): WalletAdapterNetwork {
    const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet').toLowerCase();
    if (raw === 'mainnet-beta' || raw === 'mainnet') return WalletAdapterNetwork.Mainnet;
    if (raw === 'testnet') return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Devnet;
}

export const SolanaWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const network = useMemo(() => resolveNetwork(), []);

    // Prefer an explicit dedicated RPC endpoint; fall back to public clusterApiUrl.
    const endpoint = useMemo(
        () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || clusterApiUrl(network),
        [network],
    );

    // Check if we're working through IP address (including external IP for team)
    const isIPAccess = useMemo(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            // Check IP addresses, including external team IP
            return /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === '185.102.186.87';
        }
        return false;
    }, []);

    // List of supported wallets: verified and working
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new Coin98WalletAdapter(),
            new TrustWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
