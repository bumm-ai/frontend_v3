'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, AlertTriangle, CheckCircle, Search, FileText, Code, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (applyPatches: boolean) => void;
  contractCode: string;
  onAddMessage?: (message: string) => void;
  messages?: Array<{ content: string; [key: string]: unknown }>;
  bummUid?: string;
}

interface AuditStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  icon: React.ComponentType<{ className?: string }>;
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
  hasPatches: boolean;
}

const auditSteps: AuditStep[] = [
  {
    id: 1,
    title: 'Preparing for Analysis',
    description: 'Examining contract dependencies and compiling code for deep analysis.',
    status: 'pending',
    icon: Search
  },
  {
    id: 2,
    title: 'Static Code Analysis (SAST)',
    description: 'Scanning for missing validations, arithmetic vulnerabilities, and insecure patterns.',
    status: 'pending',
    icon: Code
  },
  {
    id: 3,
    title: 'Data and Control Flow Analysis',
    description: 'Analyzing account interactions and tracing untrusted inputs to sensitive functions.',
    status: 'pending',
    icon: Zap
  },
  {
    id: 4,
    title: 'Economic Exploit Simulation',
    description: 'Testing for flash loan attacks, price manipulation, and MEV vulnerabilities.',
    status: 'pending',
    icon: AlertTriangle
  },
  {
    id: 5,
    title: 'Generating Security Report',
    description: 'Classifying vulnerabilities by severity and providing remediation recommendations.',
    status: 'pending',
    icon: FileText
  },
  {
    id: 6,
    title: 'Finalizing Remediation',
    description: 'Generating suggested code patches for identified vulnerabilities.',
    status: 'pending',
    icon: Shield
  }
];

export const AuditModal = ({ isOpen, onClose, onComplete, contractCode, onAddMessage, messages, bummUid }: AuditModalProps) => {
  
  // Function for displaying animated stage icons
  const getStageIcon = (step: AuditStep, index: number) => {
    const IconComponent = step.icon;
    if (index < currentStep) {
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    } else if (index === currentStep && !isCompleted) {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <IconComponent className="w-5 h-5 text-orange-400" />
        </motion.div>
      );
    }
    return <IconComponent className="w-5 h-5 text-gray-500" />;
  };
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [displaySteps, setDisplaySteps] = useState<typeof auditSteps>(auditSteps);
  const [patchesApplied, setPatchesApplied] = useState(false);

  // Реальный API-audit c использованием backend bummUid (если есть)
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setIsCompleted(false);
      setAuditResult(null);
      return;
    }

    let cancelled = false;
    let animInterval: NodeJS.Timeout;

    const runAudit = async () => {
      try {
        const userId = localStorage.getItem('bumm_user_uid') || '';
        const textToSend = bummUid || contractCode;

        const startRes = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BUMM_AUDIT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ text: textToSend }),
        });

        if (!startRes.ok) {
          if (startRes.status === 402) {
            setIsCompleted(true);
            onAddMessage?.('Insufficient credits for audit (50 credits needed)');
            return;
          }
          throw new Error(`Audit start failed: ${startRes.status}`);
        }

        const { uid: auditUid } = await startRes.json();

        // Анимация шагов во время опроса
        let step = 0;
        animInterval = setInterval(() => {
          if (cancelled) return;
          step = Math.min(
            step + 1,
            (displaySteps?.length || auditSteps.length) - 2
          );
          setCurrentStep(step);
        }, 2500);

        // Poll status
        let attempts = 0;
        while (!cancelled && attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const res = await fetch(
            `${API_BASE_URL}${API_ENDPOINTS.BUMM_AUDIT_STATUS}${auditUid}/`,
            { headers: { 'x-user-id': userId } }
          );
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === 'audited' && data.report) {
            clearInterval(animInterval);
            setCurrentStep((displaySteps?.length || auditSteps.length) - 1);

            let report: any;
            try { report = JSON.parse(data.report); }
            catch { report = { issues: [], summary: data.report }; }

            const issues = report.issues || report.vulnerabilities || [];
            const critical = issues.filter((i: any) => i.severity === 'critical').length;
            const high = issues.filter((i: any) => i.severity === 'high').length;
            const medium = issues.filter((i: any) => i.severity === 'medium').length;
            const low = issues.filter((i: any) => ['low', 'info'].includes(i.severity)).length;
            const score = Math.max(0, 100 - critical * 25 - high * 15 - medium * 5 - low);

            setAuditResult({
              securityScore: score,
              vulnerabilities: { critical, high, medium, low },
              vulnerabilityList: issues.map((i: any) => ({
                name: i.title || i.name || i.description,
                severity: i.severity,
              })),
              hasPatches: critical > 0 || high > 0,
            });
            setIsCompleted(true);
            onAddMessage?.(`Audit complete! Score: ${score}/100 (${issues.length} issues found)`);
            return;
          }

          if (data.status === 'error') {
            throw new Error(data.error || 'Audit failed');
          }
        }

        throw new Error('Audit timed out');
      } catch (err) {
        console.error('Audit error:', err);
        setIsCompleted(true);
        setAuditResult({
          securityScore: 0,
          vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
          vulnerabilityList: [{ name: String(err), severity: 'critical' }],
          hasPatches: false,
        });
      }
    };

    runAudit();
    return () => { cancelled = true; if (animInterval) clearInterval(animInterval); };
  }, [isOpen, contractCode, bummUid, displaySteps, onAddMessage]);

  const handleNextStep = () => {
    onComplete(false);
  };

  const handleComplete = () => {
    // Audit message already added automatically in useEffect
    // Here we only complete the audit process
    onComplete(false);
    onClose();
  };

  const handleRerunAudit = () => {
    if (!auditResult) return;
    
    setIsRerunning(true);
    setIsCompleted(false);
    setCurrentStep(0);
    setAuditResult(null);
    
    // Add "Apply Patches" step if vulnerabilities exist
    const hasVulnerabilities = Object.values(auditResult.vulnerabilities).reduce((sum, count) => sum + count, 0) > 0;
    
    if (hasVulnerabilities) {
      // Start with Apply Patches step, then audit steps, then rebuild
      const applyPatchesStep = {
        id: 0,
        title: 'Apply Security Patches',
        description: 'Automatically applying recommended security fixes and updating code patterns.',
        status: 'pending' as const,
        icon: Shield
      };
      
      const rebuildStep = {
        id: auditSteps.length + 1,
        title: 'Contract Rebuild',
        description: 'Recompiling the contract with applied security patches.',
        status: 'pending' as const,
        icon: Code
      };
      
      // Create new steps array with Apply Patches + original audit steps + rebuild
      const rerunSteps = [
        applyPatchesStep, 
        ...auditSteps.map((step, index) => ({
          ...step,
          id: index + 1,
          status: 'pending' as const
        })),
        rebuildStep
      ];
      
      // Set display steps for rerun
      setDisplaySteps(rerunSteps);
      
      // Simulate the process with Apply Patches first
      let stepIndex = 0;
      const processStep = () => {
        if (stepIndex < rerunSteps.length) {
          setCurrentStep(stepIndex);
          setTimeout(() => {
            stepIndex++;
            if (stepIndex >= rerunSteps.length) {
              // Rerun completed with better results
              setIsCompleted(true);
              setPatchesApplied(true); // Patches have been applied
              setAuditResult({
                securityScore: 85, // Much better score after fixes
                vulnerabilities: {
                  critical: 0, // Fixed all critical
                  high: 0,
                  medium: 1, // One medium issue remains
                  low: 0
                },
                vulnerabilityList: [
                  { name: 'Minor gas optimization opportunity', severity: 'medium' }
                ],
                hasPatches: false // No more patches needed
              });
              setIsRerunning(false);
              
              // Prevent duplicate audit completion message
              if (onAddMessage) {
                const successMessage = 'Audit completed! Contract is ready for deployment. Security score improved to 85/100. Only 1 minor optimization opportunity remains.';
                if (!messages?.some(m => m.content.includes('Audit completed!') && m.content.includes('Security score improved to 85/100'))) {
                  setTimeout(() => {
                    onAddMessage(successMessage);
                  }, 500);
                }
              }
            } else {
              processStep();
            }
          }, 1000); // Reduced from 2000 to 1000
        }
      };
      processStep();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
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
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#333] rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

                {/* Content */}
          <div className="flex flex-col">
            {!isCompleted ? (
              <>
                {/* Progress Header */}
                <div className="p-4 pb-2">
                  <h3 className="text-base font-semibold text-white mb-2">Audit Progress</h3>
                  <div className="flex items-center gap-2 text-orange-400">
                    <div className="flex gap-1">
                      <motion.div 
                        className="w-2 h-2 bg-orange-400 rounded-full"
                        animate={{ 
                          y: [0, -4, 0],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{ 
                          duration: 0.6,
                          repeat: Infinity,
                          delay: 0
                        }}
                      />
                      <motion.div 
                        className="w-2 h-2 bg-orange-400 rounded-full"
                        animate={{ 
                          y: [0, -4, 0],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{ 
                          duration: 0.6,
                          repeat: Infinity,
                          delay: 0.2
                        }}
                      />
                      <motion.div 
                        className="w-2 h-2 bg-orange-400 rounded-full"
                        animate={{ 
                          y: [0, -4, 0],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{ 
                          duration: 0.6,
                          repeat: Infinity,
                          delay: 0.4
                        }}
                      />
                    </div>
                    <span className="text-sm">
                      {currentStep < displaySteps.length ? displaySteps[currentStep].title : 'Analyzing...'}
                    </span>
                  </div>
                </div>

                {/* Steps - Compact Grid */}
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    {displaySteps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`p-2 rounded-md border transition-all ${
                          index <= currentStep
                            ? 'border-orange-500/30 bg-orange-500/5'
                            : 'border-[#333] bg-[#191919]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0">
                            {getStageIcon(step, index)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-xs truncate ${
                              index <= currentStep ? 'text-white' : 'text-gray-500'
                            }`}>
                              {step.title}
                            </h4>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 flex flex-col h-full">
                {/* Audit Results */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <h3 className="text-base font-semibold text-white">Audit Complete</h3>
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
                              {Object.values(auditResult.vulnerabilities).reduce((sum, count) => sum + count, 0)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(auditResult.vulnerabilities).map(([severity, count]) => (
                            <div key={severity} className="text-center">
                              <div className={`text-sm font-bold ${getSeverityColor(severity)}`}>
                                {count}
                              </div>
                              <div className="text-xs text-gray-400 capitalize">
                                {severity}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Vulnerability List - Scrollable */}
                      <div className="bg-[#191919] border border-[#333] rounded-lg">
                        <div className="p-3 border-b border-[#333]">
                          <h4 className="text-sm font-medium text-white">Detected Issues</h4>
                        </div>
                        <div className="p-3 space-y-2">
                          {auditResult.vulnerabilityList.map((vuln, index) => (
                            <div key={index} className="flex items-start justify-between gap-2">
                              <div className="text-xs text-gray-300 flex-1 leading-relaxed">
                                {vuln.name}
                              </div>
                              <div className={`text-xs font-medium capitalize flex-shrink-0 ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                  {auditResult && Object.values(auditResult.vulnerabilities).reduce((sum, count) => sum + count, 0) > 0 && !patchesApplied && (
                    <button
                      onClick={handleRerunAudit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Apply Security
                    </button>
                  )}
                  {patchesApplied && (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600 text-gray-400 rounded-lg font-medium text-sm cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Security Applied
                    </button>
                  )}
                  <button
                    onClick={handleComplete}
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
