import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import VaultDemo from './VaultDemo';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Tranched Compute Vault',
  description:
    'Devnet demo — an on-chain securitization vault for contracted compute revenue: senior/junior tranche tokens, waterfall distribution, bottom-up loss absorption.',
};

// Off on the public site while the platform is in closed testing; set
// NEXT_PUBLIC_DEMO_ENABLED=on (e.g. in .env.local) to serve the page.
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ENABLED === 'on';

export default function Page() {
  if (!DEMO_ENABLED) notFound();
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <VaultDemo />
    </div>
  );
}
