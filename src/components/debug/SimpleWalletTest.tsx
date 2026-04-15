'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const SimpleWalletTest = () => {
    const { select, wallets, publicKey, connected, disconnect } = useWallet();

    const connectPhantom = () => {
        const phantom = wallets.find(wallet => wallet.adapter.name === 'Phantom');
        if (phantom) {
            select(phantom.adapter.name);
        } else {
            alert('Phantom wallet not found. Please install Phantom extension.');
        }
    };

    const connectTorus = () => {
        const torus = wallets.find(wallet => wallet.adapter.name === 'Torus');
        if (torus) {
            select(torus.adapter.name);
        }
    };

    if (connected && publicKey) {
        return (
            <div className="fixed top-4 right-4 bg-green-600 text-white p-4 rounded-lg">
                <div className="font-bold">✅ Connected!</div>
                <div className="text-sm font-mono">{publicKey.toString().slice(0, 8)}...</div>
                <button 
                    onClick={disconnect}
                    className="mt-2 bg-red-500 px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg space-y-2">
            <div className="font-bold">🔗 Connect Wallet</div>
            
            {/* Standard button */}
            <div>
                <WalletMultiButton />
            </div>
            
            {/* Manual buttons */}
            <div className="space-y-1">
                <button 
                    onClick={connectPhantom}
                    className="block w-full bg-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-700"
                >
                    Connect Phantom
                </button>
                <button 
                    onClick={connectTorus}
                    className="block w-full bg-blue-500 px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                    Connect Torus
                </button>
            </div>
            
            <div className="text-xs text-blue-200">
                Available: {wallets.length} wallets
            </div>
        </div>
    );
};
