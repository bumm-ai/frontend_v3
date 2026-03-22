'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

export const WalletDebug = () => {
    const { publicKey, connected, connecting, wallet, wallets } = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        console.log('Wallet Debug Info:');
        console.log('Connected:', connected);
        console.log('Connecting:', connecting);
        console.log('Public Key:', publicKey?.toString());
        console.log('Current Wallet:', wallet?.adapter.name);
        console.log('Available Wallets:', wallets.map(w => w.adapter.name));
        console.log('Connection:', connection.rpcEndpoint);
    }, [connected, connecting, publicKey, wallet, wallets, connection]);

    useEffect(() => {
        if (publicKey && connected) {
            connection.getBalance(publicKey)
                .then(bal => setBalance(bal / 1e9))
                .catch(err => console.error('Balance error:', err));
        }
    }, [publicKey, connected, connection]);

    return (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-sm">
            <div className="text-green-400 font-bold mb-2">Wallet Debug</div>
            <div>Connected: {connected ? '✅' : '❌'}</div>
            <div>Connecting: {connecting ? '⏳' : '❌'}</div>
            <div>Wallet: {wallet?.adapter.name || 'None'}</div>
            {publicKey && (
                <>
                    <div>Address: {publicKey.toString().slice(0, 8)}...</div>
                    <div>Balance: {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}</div>
                </>
            )}
            <div>Available: {wallets.length}</div>
            <div className="text-xs text-gray-400 mt-2">
                {wallets.map(w => w.adapter.name).join(', ')}
            </div>
        </div>
    );
};
