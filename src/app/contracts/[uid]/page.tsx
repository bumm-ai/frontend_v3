'use client';

import { use, useState, useCallback } from 'react';
import { useContract } from '@/hooks/useContract';
import type { Phase } from '@/lib/api';

// ── Phase metadata ─────────────────────────────────────────────────────────────

const PHASE_ORDER: Phase[] = [
  'pending',
  'enriching',
  'generating',
  'building',
  'build_fixing',
  'auditing_static',
  'auditing_llm',
  'audit_fixing',
  'deploying',
  'learning',
  'done',
];

const PHASE_LABELS: Record<Phase, string> = {
  pending:        'Pending',
  enriching:      'Enriching',
  generating:     'Generating',
  building:       'Building',
  build_fixing:   'Fixing build',
  auditing_static:'Static audit',
  auditing_llm:   'LLM audit',
  audit_fixing:   'Fixing vulns',
  deploying:      'Deploying',
  learning:       'Learning',
  done:           'Done',
  failed:         'Failed',
};

// ── Stepper component ──────────────────────────────────────────────────────────

function PhaseStepper({ current }: { current: Phase }) {
  const currentIdx = PHASE_ORDER.indexOf(current === 'failed' ? 'done' : current);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PHASE_ORDER.filter((p) => p !== 'pending').map((phase, i) => {
        const idx    = PHASE_ORDER.indexOf(phase);
        const done   = current !== 'failed' && idx < currentIdx;
        const active = idx === currentIdx && current !== 'done';
        const failed = current === 'failed' && idx === currentIdx;
        return (
          <span
            key={phase}
            className={`px-2 py-1 rounded text-xs font-medium ${
              done   ? 'bg-green-700/40 text-green-300' :
              active ? 'bg-violet-600/60 text-white animate-pulse' :
              failed ? 'bg-red-700/40 text-red-300' :
                       'bg-gray-800 text-gray-500'
            }`}
          >
            {done ? '✓ ' : active ? '⟳ ' : ''}{PHASE_LABELS[phase]}
          </span>
        );
      })}
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContractStatusPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = use(params);
  const { status, isLoading, error, code, getCode } = useContract(uid);

  const [codeLoading, setCodeLoading] = useState(false);

  async function handleGetCode() {
    setCodeLoading(true);
    try { await getCode(); }
    finally { setCodeLoading(false); }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Contract Pipeline</h1>
          <p className="text-gray-500 text-sm font-mono break-all">{uid}</p>
        </div>

        {/* Loading skeleton */}
        {isLoading && !status && (
          <div className="h-8 bg-gray-800 rounded animate-pulse w-1/2" />
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/20 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Phase stepper */}
        {status && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 mb-3">Progress</h2>
            <PhaseStepper current={status.phase} />
          </section>
        )}

        {/* Build / audit counters */}
        {status && (
          <section className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Build attempts</p>
              <p className="text-2xl font-bold">{status.build_attempt}</p>
              <p className={`text-xs mt-1 ${status.build_ok ? 'text-green-400' : 'text-gray-500'}`}>
                {status.build_ok ? '✓ OK' : 'pending'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Audit attempts</p>
              <p className="text-2xl font-bold">{status.audit_attempt}</p>
              <p className={`text-xs mt-1 ${status.audit_ok ? 'text-green-400' : 'text-gray-500'}`}>
                {status.audit_ok ? '✓ OK' : 'pending'}
              </p>
            </div>
          </section>
        )}

        {/* Done — program_id + code */}
        {status?.phase === 'done' && (
          <section className="space-y-4">
            {status.program_id && (
              <div className="rounded-lg border border-green-700 bg-green-900/10 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-green-400">Program ID</span>
                  <CopyButton text={status.program_id} />
                </div>
                <p className="font-mono text-sm text-green-300 break-all">{status.program_id}</p>
              </div>
            )}

            {!code && (
              <button
                onClick={handleGetCode}
                disabled={codeLoading}
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm transition"
              >
                {codeLoading ? 'Loading…' : 'View generated code'}
              </button>
            )}

            {code && (
              <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400">lib.rs — version {code.version}</span>
                  <CopyButton text={code.code} />
                </div>
                <pre className="p-4 text-xs text-gray-300 overflow-x-auto max-h-96">
                  <code>{code.code}</code>
                </pre>
              </div>
            )}
          </section>
        )}

        {/* Failed — error message */}
        {status?.phase === 'failed' && status.error && (
          <section className="rounded-lg border border-red-700 bg-red-900/10 p-4">
            <p className="text-xs font-medium text-red-400 mb-2">Pipeline failed</p>
            <p className="text-sm text-red-300">{status.error}</p>
          </section>
        )}
      </div>
    </main>
  );
}
