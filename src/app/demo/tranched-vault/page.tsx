import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import VaultDemo from './VaultDemo';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Tranched Compute Vault',
  description:
    'Devnet demo — an on-chain securitization vault for contracted compute revenue: senior/junior tranche tokens, waterfall distribution, bottom-up loss absorption.',
};

export default function Page() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <VaultDemo />
    </div>
  );
}
