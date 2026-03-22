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

export const SolanaWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // Network можно изменить на 'mainnet-beta', 'testnet', или 'devnet'
    const network = WalletAdapterNetwork.Devnet;

    // RPC endpoint (можно использовать собственный RPC для лучшей производительности)
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

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
