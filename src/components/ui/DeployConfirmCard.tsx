'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, Rocket } from 'lucide-react';

export interface DeployConfirmCardProps {
  /** Network the deploy will target (devnet/testnet/mainnet-beta). */
  network?: string | null;
  /** Whether this is an upgrade of an already-deployed contract. */
  isUpgrade?: boolean;
  /** Runs the actual deploy. Resolves when the step is triggered. */
  onConfirm: () => Promise<void>;
  /** Dismiss without deploying. */
  onCancel: () => void;
}

/**
 * Inline last-mile confirmation before an IRREVERSIBLE on-chain deploy that
 * spends real (custodial) SOL (fe-07). Mirrors RegenConfirmCard's card style —
 * deliberately NOT a modal. The precise SOL fee is already surfaced in the
 * post-audit chat message; this card is the explicit "yes, spend it" gate.
 */
export const DeployConfirmCard = ({
  network,
  isUpgrade,
  onConfirm,
  onCancel,
}: DeployConfirmCardProps) => {
  const [busy, setBusy] = useState(false);
  const net = network || 'devnet';

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mx-3 mb-2 overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
            {isUpgrade ? 'Confirm re-deploy?' : 'Confirm publish?'}
          </div>
          <div className="mt-0.5 text-sm font-medium text-emerald-50">
            This deploys to Solana <span className="font-semibold">{net}</span> and
            spends real SOL. It is irreversible.
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            The estimated network fee is shown in the chat above.
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-emerald-500/20 bg-neutral-950/30 px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/90 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <Rocket className="h-3.5 w-3.5" />
              {isUpgrade ? 'Confirm re-deploy' : 'Confirm publish'}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
