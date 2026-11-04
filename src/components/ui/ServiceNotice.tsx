'use client';

/**
 * Service-status notice while the backend is offline.
 *
 * The modal opens when someone presses "Start Building" (instead of the
 * wallet dialog — nothing past it works without the backend) or the small
 * "Closed testing" pill that stays on screen. Hidden on pages that work
 * without the backend (/demo) and on the legal pages.
 *
 * Turn off at relaunch without a code change: set
 * NEXT_PUBLIC_SERVICE_NOTICE=off in the Vercel project and redeploy —
 * "Start Building" then opens the wallet dialog again.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, X } from 'lucide-react';

export const SERVICE_NOTICE_ENABLED = process.env.NEXT_PUBLIC_SERVICE_NOTICE !== 'off';
const HIDDEN_PREFIXES = ['/demo', '/terms', '/privacy', '/cookies'];
const OPEN_EVENT = 'bumm:service-notice:open';

/** Open the notice from anywhere (e.g. the "Start Building" button). */
export function openServiceNotice(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function ServiceNotice() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const hidden = !SERVICE_NOTICE_ENABLED || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [hidden]);

  const close = () => setOpen(false);

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
