'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Wrench, CheckCircle, AlertCircle, Settings, Code, Rocket } from 'lucide-react';
import { DancingDotsLoader } from './DancingDotsLoader';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import { useContractStream } from '@/hooks/useContractStream';
import { BuildLogStream } from '@/components/build/BuildLogStream';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  contractCode: string;
  onAddMessage?: (message: string) => void;
  bummUid?: string;
}

type StageStatus = 'pending' | 'active' | 'completed' | 'error';

interface BuildStage {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: StageStatus;
}

const makeStages = (): BuildStage[] => [
  { id: 'init',    title: 'Initializing build',  icon: Settings,  status: 'pending' },
  { id: 'compile', title: 'Compiling contract',  icon: Wrench,    status: 'pending' },
  { id: 'verify',  title: 'Verifying artifact',  icon: Code,      status: 'pending' },
  { id: 'done',    title: 'Build complete',       icon: Rocket,    status: 'pending' },
];

export const BuildModal = ({
  isOpen,
  onClose,
  onComplete,
  onAddMessage,
  bummUid,
}: BuildModalProps) => {
  const [stages, setStages]           = useState<BuildStage[]>(makeStages());
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]       = useState('');

  // Ref so the status-watcher effect always has the latest callback.
  const onAddMessageRef = useRef(onAddMessage);
  onAddMessageRef.current = onAddMessage;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Stream — only active while modal is open. Shares the wsHub connection
  // that Dashboard already holds for this uid (no extra WS opened).
  const { status } = useContractStream(isOpen ? (bummUid ?? null) : null);

  const updateStage = useCallback((index: number, s: StageStatus) => {
    setStages(prev => prev.map((st, i) => i === index ? { ...st, status: s } : st));
  }, []);

  // Trigger build + reset state when modal opens.
  useEffect(() => {
    if (!isOpen) {
      setBuildStatus('idle');
      setStages(makeStages());
      setErrorMsg('');
      return;
    }
    if (!bummUid) {
      setStages(makeStages());
      setBuildStatus('error');
      setErrorMsg('Cannot start build: project ID not found. Please generate the contract first.');
      updateStage(0, 'error');
      return;
    }

    setBuildStatus('building');
    setStages(makeStages());
    setErrorMsg('');
    updateStage(0, 'active');

    const controller = new AbortController();

    const triggerBuild = async () => {
      try {
        await tryRefresh();
        await apiClient.triggerBuild(bummUid);
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : 'Failed to trigger build';
          setErrorMsg(msg.substring(0, 500));
          setBuildStatus('error');
          setStages(prev => prev.map(s =>
            s.status === 'active' ? { ...s, status: 'error' as StageStatus } : s,
          ));
          onAddMessageRef.current?.(`Build failed: ${msg.substring(0, 200)}`);
        }
      }
    };

    triggerBuild();
    return () => controller.abort();
  }, [isOpen, bummUid, updateStage]);

  // Watch WS status for completion / failure — replaces polling loop.
  useEffect(() => {
    if (!isOpen || !status || buildStatus === 'success' || buildStatus === 'error') return;

    const { phase, next_step, build_ok } = status;

    // Advance visual stage when backend confirms compile in progress.
    if (phase === 'building' || phase === 'build_fixing') {
      setStages(prev => prev.map((s, i) =>
        i === 0 ? { ...s, status: 'completed' as StageStatus } :
        i === 1 ? { ...s, status: 'active'    as StageStatus } : s,
      ));
    }

    const buildDone =
      next_step === 'audit' ||
      (build_ok && !['building', 'build_fixing'].includes(phase ?? ''));

    if (buildDone) {
      setStages(prev => prev.map(s => ({ ...s, status: 'completed' as StageStatus })));
      setBuildStatus('success');
      onAddMessageRef.current?.('Build successful! Contract compiled and ready for audit.');
      return;
    }

    if (phase === 'failed' || (phase === 'done' && !build_ok)) {
      const msg = status.error || 'Build failed — check the pipeline logs for details.';
      setErrorMsg(msg.substring(0, 500));
      setBuildStatus('error');
      setStages(prev => prev.map(s =>
        s.status === 'active' ? { ...s, status: 'error' as StageStatus } : s,
      ));
      onAddMessageRef.current?.(`Build failed: ${msg.substring(0, 200)}`);
    }
  }, [status, isOpen, buildStatus]);

  const getStageIcon = (stage: BuildStage) => {
    const Icon = stage.icon;
    switch (stage.status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'active':    return <DancingDotsLoader />;
      case 'error':     return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:          return <Icon className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={buildStatus === 'building' ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="relative bg-[#0A0A0A] border border-orange-500/30 rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#333]">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-semibold text-white">Build Smart Contract</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Building */}
              {buildStatus === 'building' && (
                <div className="space-y-3">
                  <div className="bg-[#191919] rounded-lg p-2.5 border border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <DancingDotsLoader />
                      <span className="text-white font-medium text-sm">Compiling with Anchor CLI...</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This may take 1–6 minutes</p>
                  </div>
                  <div className="space-y-2">
                    {stages.map((stage) => (
                      <div key={stage.id} className="flex items-center gap-2 p-2 rounded bg-[#191919]/50">
                        {getStageIcon(stage)}
                        <span className={`text-xs ${
                          stage.status === 'active'    ? 'text-white' :
                          stage.status === 'completed' ? 'text-green-400' : 'text-gray-500'
                        }`}>
                          {stage.title}
                        </span>
                      </div>
                    ))}
                  </div>
                  {bummUid && (
                    <BuildLogStream uid={bummUid} active={buildStatus === 'building'} className="mt-2" />
                  )}
                </div>
              )}

              {/* Success */}
              {buildStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-center space-y-3"
                >
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <h3 className="text-base font-semibold text-white">Build Successful!</h3>
                  <p className="text-gray-400 text-xs">Contract compiled and ready for audit</p>
                  {bummUid && (
                    <BuildLogStream uid={bummUid} active={false} className="mt-2 text-left" />
                  )}
                  <button
                    onClick={() => { onCompleteRef.current(); onClose(); }}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
                  >
                    Next: Audit Contract
                  </button>
                </motion.div>
              )}

              {/* Error */}
              {buildStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-center space-y-3"
                >
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                  <h3 className="text-base font-semibold text-white">Build Failed</h3>
                  <div className="bg-[#191919] rounded p-2 text-left max-h-40 overflow-y-auto">
                    <pre className="text-xs text-red-400 whitespace-pre-wrap">{errorMsg}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
