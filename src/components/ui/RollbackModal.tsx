'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Code2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/services/api';

interface CodeVersion {
  index: number;
  code: string;
  linked_fix?: {
    source: string;
    error_pattern: string;
    fix_description: string;
    was_successful: boolean | null;
  } | null;
}

interface RollbackModalProps {
  isOpen: boolean;
  projectUid: string;
  projectName: string;
  onClose: () => void;
  onRolledBack: (version: number) => void;
  onKeepCurrent: () => void;
}

export function RollbackModal({
  isOpen,
  projectUid,
  projectName,
  onClose,
  onRolledBack,
  onKeepCurrent,
}: RollbackModalProps) {
  const [versions, setVersions] = useState<CodeVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedVersion(null);
    setExpandedVersion(null);
    setError(null);
    setLoading(true);
    apiClient
      .getCodeHistory(projectUid)
      .then((res) => {
        setVersions(res.versions ?? []);
        // Pre-select the version before last (most recent "safe" state)
        const safe = (res.versions?.length ?? 0) - 2;
        if (safe >= 0) setSelectedVersion(safe);
      })
      .catch(() => setError('Failed to load code history.'))
      .finally(() => setLoading(false));
  }, [isOpen, projectUid]);

  const handleRollback = async () => {
    if (selectedVersion === null) return;
    setRolling(true);
    setError(null);
    try {
      await apiClient.rollbackContract(projectUid, selectedVersion);
      onRolledBack(selectedVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed.');
    } finally {
      setRolling(false);
    }
  };

  const latestIndex = versions.length - 1;

  const versionLabel = (v: CodeVersion) => {
    if (v.index === 0) return 'Original generation';
    if (v.linked_fix) {
      const truncated = v.linked_fix.fix_description.slice(0, 60);
      return `Fix ${v.index}: ${truncated}${v.linked_fix.fix_description.length > 60 ? '…' : ''}`;
    }
    return `Version ${v.index}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-white/8">
              <div>
                <h2 className="text-white font-semibold text-base">
                  Restore previous version
                </h2>
                <p className="text-white/50 text-xs mt-0.5 truncate max-w-[340px]">
                  {projectName || 'Untitled'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/80 transition-colors ml-4 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                </div>
              ) : error ? (
                <p className="text-red-400 text-sm text-center py-6">{error}</p>
              ) : versions.length < 2 ? (
                <p className="text-white/50 text-sm text-center py-6">
                  No previous versions available — only one snapshot exists.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {versions.map((v) => {
                    const isLatest = v.index === latestIndex;
                    const isSelected = selectedVersion === v.index;
                    const isExpanded = expandedVersion === v.index;

                    return (
                      <div key={v.index} className="rounded-lg border border-white/8 overflow-hidden">
                        <button
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-white/10'
                              : 'hover:bg-white/5'
                          }`}
                          onClick={() => {
                            if (!isLatest) setSelectedVersion(v.index);
                          }}
                          disabled={isLatest}
                        >
                          {/* Select indicator */}
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              isLatest
                                ? 'border-white/15 cursor-not-allowed'
                                : isSelected
                                ? 'border-[#6c5dd3] bg-[#6c5dd3]'
                                : 'border-white/30'
                            }`}
                          >
                            {isSelected && !isLatest && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-medium truncate ${
                                  isLatest ? 'text-white/35' : 'text-white/80'
                                }`}
                              >
                                {versionLabel(v)}
                              </span>
                              {isLatest && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 flex-shrink-0">
                                  current
                                </span>
                              )}
                              {v.linked_fix?.was_successful === true && (
                                <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-white/35 text-[11px] mt-0.5">
                              {v.code.length.toLocaleString()} chars
                            </p>
                          </div>

                          {/* Code preview toggle */}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={isExpanded ? 'Collapse code preview' : 'Expand code preview'}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedVersion(isExpanded ? null : v.index);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedVersion(isExpanded ? null : v.index);
                              }
                            }}
                            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 p-1"
                          >
                            {isExpanded ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </span>
                        </button>

                        {/* Inline code preview */}
                        {isExpanded && (
                          <div className="border-t border-white/8 bg-black/20 px-3 py-2">
                            <pre className="text-[11px] text-white/60 font-mono overflow-x-auto max-h-28 scrollbar-thin scrollbar-thumb-white/10">
                              {v.code.slice(0, 600)}
                              {v.code.length > 600 && '\n…'}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Error after rollback attempt */}
              {!loading && error && versions.length > 0 && (
                <p className="text-red-400 text-xs mt-3">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 pb-5">
              <button
                onClick={onKeepCurrent}
                className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/90 transition-colors"
              >
                Keep current code
              </button>
              <button
                onClick={handleRollback}
                disabled={selectedVersion === null || rolling || versions.length < 2}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#6c5dd3] hover:bg-[#7c6de3] text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rolling ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                {rolling ? 'Restoring…' : 'Restore this version'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
