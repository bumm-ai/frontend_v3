'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, AlertTriangle, CheckCircle, Search, FileText, Code, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import { fetchContractStatusAuthorized } from '@/services/contractStatusPoll';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (applyPatches: boolean) => void;
  contractCode: string;
  onAddMessage?: (message: string) => void;
  messages?: Array<{ content: string; [key: string]: unknown }>;
  bummUid?: string;
}

interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface AuditResult {
  securityScore: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerabilityList: Vulnerability[];
}

const AUDIT_PHASES = ['auditing_static', 'auditing_llm', 'audit_fixing'];

const STEP_LABELS: Record<string, string> = {
  auditing_static: 'Static Analysis (clippy + cargo-audit)',
  auditing_llm:    'LLM Security Review (GPT-4o)',
  audit_fixing:    'Applying Security Fixes',
  building:        'Rebuilding with Fixes',
  build_fixing:    'Rebuilding with Fixes',
};

export const AuditModal = ({ isOpen, onClose, onComplete, onAddMessage, bummUid }: AuditModalProps) => {
  const [currentPhase, setCurrentPhase] = useState('');
  const [isCompleted, setIsCompleted]   = useState(false);
  const [auditResult, setAuditResult]   = useState<AuditResult | null>(null);
  const [errorMsg, setErrorMsg]         = useState('');

  useEffect(() => {
    if (!isOpen) {
      setCurrentPhase('');
      setIsCompleted(false);
      setAuditResult(null);
      setErrorMsg('');
      return;
    }

    if (!bummUid) {
      setErrorMsg('No contract ID found. Generate the contract first.');
      setIsCompleted(true);
      return;
    }

    let cancelled = false;

    const runAudit = async () => {
      try {
        await tryRefresh();
        // Trigger the audit step — pipeline was paused before audit_static.
        await apiClient.triggerAudit(bummUid);

        const maxAttempts = 180; // 6 min at 2s intervals
        let attempts = 0;

        while (!cancelled && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;

          const res = await fetchContractStatusAuthorized(bummUid);
          if (!res.ok) continue;

          const data = await res.json();
          const phase: string = data.phase ?? '';
          setCurrentPhase(phase);

          // Audit is done when pipeline paused before deploy (next_step="deploy")
          // or when audit phases are finished.
          const auditDone = data.next_step === 'deploy' ||
            (data.phase === 'done') ||
            (data.build_ok && !AUDIT_PHASES.includes(phase) && !['building', 'build_fixing'].includes(phase) && phase !== 'generating' && phase !== 'enriching' && phase !== 'not_started');

          if (auditDone) {
            // Fetch detailed audit results from the DB
            const auditData = await apiClient.getContractAudit(bummUid);

            // Parse vulnerabilities from backend response
            const vulns: Array<{ severity: string; title: string; description: string }> =
              Array.isArray(auditData.vulns) ? auditData.vulns as any[] : [];

            const critical = vulns.filter(v => v.severity === 'critical').length;
            const high     = vulns.filter(v => v.severity === 'high').length;
            const medium   = vulns.filter(v => v.severity === 'medium').length;
            const low      = vulns.filter(v => ['low', 'info'].includes(v.severity)).length;
            const score    = Math.max(0, 100 - critical * 25 - high * 15 - medium * 5 - low);

            const result: AuditResult = {
              securityScore: score,
              vulnerabilities: { critical, high, medium, low },
              vulnerabilityList: vulns.map(v => ({
                name: v.title || v.description || 'Unknown issue',
                severity: (v.severity as Vulnerability['severity']) || 'low',
              })),
            };

            setAuditResult(result);
            setIsCompleted(true);
            onAddMessage?.(`Audit complete! Score: ${score}/100 (${vulns.length} issues found)`);
            return;
          }

          if (phase === 'failed') {
            throw new Error(data.error || 'Audit pipeline failed');
          }
        }

        throw new Error('Audit timed out after 6 minutes');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Audit failed';
        setErrorMsg(msg);
        setIsCompleted(true);
        setAuditResult({
          securityScore: 0,
          vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
          vulnerabilityList: [{ name: msg, severity: 'critical' }],
        });
      }
    };

    runAudit();
    return () => { cancelled = true; };
  }, [isOpen, bummUid, onAddMessage]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high':     return 'text-orange-500';
      case 'medium':   return 'text-yellow-500';
      case 'low':      return 'text-blue-500';
      default:         return 'text-gray-500';
    }
  };

  const currentLabel = STEP_LABELS[currentPhase] || 'Analyzing…';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop — no dismiss while audit is in progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={isCompleted ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative bg-[#0A0A0A] border border-orange-500/30 rounded-lg shadow-2xl shadow-orange-500/10 max-w-lg w-full mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#333]">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">Audit Smart Contract</h2>
                <p className="text-xs text-gray-400 hidden md:block">Security analysis in progress</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-[#333] rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="flex flex-col">
            {!isCompleted ? (
              <div className="p-4 space-y-4">
                {/* Active phase indicator */}
                <div className="bg-[#191919] rounded-lg p-2.5 border border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-orange-400 rounded-full"
                          animate={{ y: [0, -4, 0], scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                    <span className="text-white font-medium text-sm">{currentLabel}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">This may take 1–4 minutes</p>
                </div>

                {/* Phase steps */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { phase: 'auditing_static', icon: Search,      label: 'Static Analysis' },
                    { phase: 'auditing_llm',    icon: Zap,         label: 'LLM Review' },
                    { phase: 'audit_fixing',    icon: Code,        label: 'Fix Vulnerabilities' },
                    { phase: 'done',            icon: FileText,    label: 'Generate Report' },
                  ].map(({ phase, icon: Icon, label }) => {
                    const isDone = currentPhase === 'done' ||
                      (AUDIT_PHASES.indexOf(currentPhase) > AUDIT_PHASES.indexOf(phase));
                    const isActive = currentPhase === phase;
                    return (
                      <div
                        key={phase}
                        className={`p-2 rounded-md border transition-all ${
                          isActive
                            ? 'border-orange-500/30 bg-orange-500/5'
                            : isDone
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-[#333] bg-[#191919]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : isActive ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            >
                              <Icon className="w-4 h-4 text-orange-400" />
                            </motion.div>
                          ) : (
                            <Icon className="w-4 h-4 text-gray-500" />
                          )}
                          <span className={`text-xs font-medium truncate ${
                            isActive ? 'text-white' : isDone ? 'text-green-400' : 'text-gray-500'
                          }`}>
                            {label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  {errorMsg && !auditResult?.securityScore ? (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  <h3 className="text-base font-semibold text-white">
                    {errorMsg && !auditResult?.securityScore ? 'Audit Error' : 'Audit Complete'}
                  </h3>
                </div>

                {auditResult && (
                  <div className="space-y-3">
                    <div className="bg-[#191919] border border-[#333] rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Security Score</div>
                          <div className={`text-xl font-bold ${getScoreColor(auditResult.securityScore)}`}>
                            {auditResult.securityScore}/100
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Total Issues</div>
                          <div className="text-xl font-bold text-white">
                            {Object.values(auditResult.vulnerabilities).reduce((s, c) => s + c, 0)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(auditResult.vulnerabilities).map(([sev, count]) => (
                          <div key={sev} className="text-center">
                            <div className={`text-sm font-bold ${getSeverityColor(sev)}`}>{count}</div>
                            <div className="text-xs text-gray-400 capitalize">{sev}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {auditResult.vulnerabilityList.length > 0 && (
                      <div className="bg-[#191919] border border-[#333] rounded-lg max-h-40 overflow-y-auto">
                        <div className="p-2 border-b border-[#333]">
                          <h4 className="text-xs font-medium text-white">Detected Issues</h4>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {auditResult.vulnerabilityList.map((vuln, i) => (
                            <div key={i} className="flex items-start justify-between gap-2">
                              <div className="text-xs text-gray-300 flex-1 leading-relaxed">{vuln.name}</div>
                              <div className={`text-xs font-medium capitalize flex-shrink-0 ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { onComplete(false); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Complete Audit
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
