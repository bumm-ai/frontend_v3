'use client';

/**
 * Service-status notice while the backend is offline.
 *
 * Shown as a modal on the first visit of a session and again when a wallet
 * connects, plus a small pill that stays on screen and reopens it. Hidden on
 * pages that work without the backend (/demo) and on the legal pages.
 *
 * Turn off at relaunch without a code change: set
 * NEXT_PUBLIC_SERVICE_NOTICE=off in the Vercel project and redeploy.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, X } from 'lucide-react';

const ENABLED = process.env.NEXT_PUBLIC_SERVICE_NOTICE !== 'off';
const HIDDEN_PREFIXES = ['/demo', '/terms', '/privacy', '/cookies'];
const SEEN_KEY = 'bumm_service_notice_seen';
const SEEN_CONNECTED_KEY = 'bumm_service_notice_seen_connected';

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // storage blocked (private mode) — the notice simply shows again
  }
}

export function ServiceNotice() {
  const pathname = usePathname() ?? '/';
  const { connected } = useWallet();
  const [open, setOpen] = useState(false);
  const wasConnected = useRef(connected);
  const hidden = !ENABLED || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  // First visit of the session.
  useEffect(() => {
    if (!hidden && !readFlag(SEEN_KEY)) setOpen(true);
  }, [hidden]);

  // A wallet connects (incl. autoConnect) — once per session.
  useEffect(() => {
    if (!hidden && connected && !wasConnected.current && !readFlag(SEEN_CONNECTED_KEY)) {
      setOpen(true);
    }
    wasConnected.current = connected;
  }, [connected, hidden]);

  const close = () => {
    setOpen(false);
    writeFlag(SEEN_KEY);
    if (connected) writeFlag(SEEN_CONNECTED_KEY);
  };

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-[#333] bg-[#191919]/95 px-3 py-1.5 text-xs text-gray-300 shadow-lg backdrop-blur-sm transition-colors hover:border-orange-500/60 hover:text-white"
        aria-label="Service status: closed testing"
      >
        <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
        Closed testing
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-[#333] bg-[#191919] p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-notice-title"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-red-500">
                    <FlaskConical className="h-5 w-5 text-white" />
                  </div>
                  <h2 id="service-notice-title" className="text-lg font-semibold text-white">
                    BUMM is in closed testing
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#333] hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm leading-relaxed text-gray-300">
                <p>
                  Public access is paused while we finish testing and upgrading the platform.
                  Contract generation, builds and deploys will be back as soon as the new
                  infrastructure goes live.
                </p>
                <p className="text-gray-400">
                  Existing users: your account and contract history are backed up, and the
                  programs you deployed stay yours on-chain.
                </p>
                <p className="text-gray-400">
                  Follow{' '}
                  <a
                    href="https://twitter.com/bumm_io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 underline-offset-2 hover:underline"
                  >
                    @bumm_io
                  </a>{' '}
                  for the reopening date, or message us there: if you need access before then, we
                  can arrange it individually on request.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
