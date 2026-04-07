'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ClipboardPaste,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import type { Network } from '@/lib/api';

// ── Anchor program sanity checks ──────────────────────────────────────────────

const ANCHOR_CHECKS = [
  { pattern: /#\[program\]/, label: '#[program] macro' },
  { pattern: /declare_id!\s*\(/, label: 'declare_id!' },
];

interface ValidationResult {
  missing: string[];
  ok: boolean;
}

function validateAnchorCode(code: string): ValidationResult {
  const missing = ANCHOR_CHECKS
    .filter(({ pattern }) => !pattern.test(code))
    .map(({ label }) => label);
  return { missing, ok: missing.length === 0 };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PasteCodeModalProps {
  isOpen: boolean;
  /** Pre-fill the code editor (e.g. when user already has code in the ChatScreen editor). */
  initialCode?: string;
  onClose: () => void;
  /** Called when user wants to generate from prompt instead (switches to chat). */
  onSwitchToPrompt: () => void;
  /** Called when user confirms paste — receives code + network. */
  onSubmit: (code: string, network: Network, name: string) => Promise<void>;
}

type Tab = 'paste' | 'prompt';

// ── Component ─────────────────────────────────────────────────────────────────

export function PasteCodeModal({
  isOpen,
  initialCode,
  onClose,
  onSwitchToPrompt,
  onSubmit,
}: PasteCodeModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [code, setCode] = useState(initialCode ?? '');
  const [name, setName] = useState('');
  const [network, setNetwork] = useState<Network>('devnet');

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initialCode when modal opens with pre-filled content.
  useEffect(() => {
    if (isOpen && initialCode) {
      setCode(initialCode);
      setValidation(null);
      setWarnDismissed(false);
    }
  }, [isOpen, initialCode]);

  const handleValidate = useCallback(() => {
    const result = validateAnchorCode(code.trim());
    setValidation(result);
    setWarnDismissed(false);
    return result;
  }, [code]);

  // force=true bypasses the warning gate (used by both the in-panel button and the footer
  // "Continue anyway" label so both entry-points submit in one click).
  const handleSubmit = useCallback(async (force = false) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const result = validation ?? validateAnchorCode(trimmed);
    setValidation(result);

    // First unforced click on invalid code: show warning, stop here.
    if (!result.ok && !force && !warnDismissed) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(trimmed, network, name.trim() || 'Pasted contract');
      setCode('');
      setName('');
      setValidation(null);
      setWarnDismissed(false);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  }, [code, validation, warnDismissed, network, name, onSubmit, onClose]);

  const handleSwitchToPrompt = useCallback(() => {
    onClose();
    onSwitchToPrompt();
  }, [onClose, onSwitchToPrompt]);

  const canSubmit = code.trim().length > 0 && !isSubmitting;
  const showWarning = validation && !validation.ok && !warnDismissed;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-2xl bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f] flex-shrink-0">
              <h2 className="text-white font-semibold text-base">New contract</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1f1f1f] flex-shrink-0">
              <button
                onClick={() => setActiveTab('prompt')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'prompt'
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Generate from prompt
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'paste'
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste existing code
              </button>
            </div>

            {/* Tab: Generate from prompt */}
            {activeTab === 'prompt' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                <MessageSquare className="w-10 h-10 text-orange-500/60" />
                <div>
                  <p className="text-white font-medium mb-1">Generate from prompt</p>
                  <p className="text-sm text-gray-400">
                    Describe your smart contract in plain language. The AI pipeline
                    will enrich your idea and generate production-ready Anchor/Rust code.
                  </p>
                </div>
                <button
                  onClick={handleSwitchToPrompt}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
                >
                  Open AI chat
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Tab: Paste existing code */}
            {activeTab === 'paste' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Fields */}
                <div className="p-5 pb-0 space-y-3 flex-shrink-0">
                  {/* Project name */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      Project name <span className="text-gray-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Token vesting contract"
                      maxLength={200}
                      className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/60 transition-colors"
                    />
                  </div>

                  {/* Network */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">Network</label>
                    <div className="flex gap-2">
                      {(['devnet', 'testnet', 'mainnet-beta'] as Network[]).map(n => (
                        <button
                          key={n}
                          onClick={() => setNetwork(n)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            network === n
                              ? 'border-orange-500/60 bg-orange-500/10 text-orange-300'
                              : 'border-[#2a2a2a] text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code textarea */}
                <div className="flex-1 p-5 pt-3 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-400 font-medium">
                      Anchor/Rust source <span className="text-red-500">*</span>
                    </label>
                    {code.trim() && (
                      <button
                        onClick={handleValidate}
                        className="text-xs text-gray-500 hover:text-orange-400 transition-colors"
                      >
                        Validate syntax →
                      </button>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={e => {
                      setCode(e.target.value);
                      setValidation(null);
                      setWarnDismissed(false);
                    }}
                    placeholder={`use anchor_lang::prelude::*;\n\ndeclare_id!("YourProgramId...");\n\n#[program]\npub mod my_program {\n    use super::*;\n    // paste your contract here\n}`}
                    spellCheck={false}
                    className="flex-1 resize-none font-mono text-xs text-gray-200 bg-[#060606] border border-[#2a2a2a] rounded-lg p-4 leading-relaxed placeholder-gray-700 focus:outline-none focus:border-[#3a3a3a] transition-colors min-h-[180px]"
                  />
                </div>

                {/* Validation warning */}
                <AnimatePresence>
                  {showWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mx-5 mb-0 rounded-lg border border-yellow-600/30 bg-yellow-500/5 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-yellow-300 mb-1">
                            This doesn&apos;t look like an Anchor program
                          </p>
                          <p className="text-xs text-yellow-500 mb-2">
                            Missing: {validation!.missing.join(', ')}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSubmit(true)}
                              className="text-xs px-2.5 py-1 rounded bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30 transition-colors"
                            >
                              Continue anyway
                            </button>
                            <button
                              onClick={() => { setValidation(null); setWarnDismissed(false); textareaRef.current?.focus(); }}
                              className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              Edit code
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Validation OK banner */}
                <AnimatePresence>
                  {validation?.ok && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mx-5 mb-0 rounded-lg border border-green-600/30 bg-green-500/5 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-300">Looks like a valid Anchor program</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit error */}
                {submitError && (
                  <div className="mx-5 mb-0 rounded-lg border border-red-700/30 bg-red-900/10 p-2.5">
                    <p className="text-xs text-red-300">{submitError}</p>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-[#1f1f1f] flex-shrink-0">
                  <p className="text-xs text-gray-600">
                    Build, audit, and deploy — same pipeline, no generation step.
                  </p>
                  <button
                    onClick={() => showWarning ? handleSubmit(true) : handleSubmit()}
                    disabled={!canSubmit}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <ClipboardPaste className="w-4 h-4" />
                        {showWarning ? 'Continue anyway' : 'Create project'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
