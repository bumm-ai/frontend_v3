'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { X, Rocket, CheckCircle, AlertCircle, Globe, ExternalLink, Info, Coins, AlertTriangle } from 'lucide-react';
import { DancingDotsLoader } from './DancingDotsLoader';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import { fetchContractStatusAuthorized } from '@/services/contractStatusPoll';
import type { DeployEstimate } from '@/lib/api';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (code: string) => Promise<string | undefined>;
  onComplete?: (address?: string) => void;
  contractCode: string;
  network: 'devnet' | 'mainnet';
  bummUid?: string;
}

type DeployStatus = 'confirming' | 'deploying' | 'success' | 'error';

export const DeployModal = ({ isOpen, onClose, onComplete, network, bummUid }: DeployModalProps) => {
  const [deployStatus, setDeployStatus]   = useState<DeployStatus>('confirming');
  const [contractAddress, setContractAddress] = useState('');
  const [errorMessage, setErrorMessage]   = useState('');
  const [currentStage, setCurrentStage]   = useState('');
  const [estimate, setEstimate]           = useState<DeployEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDeployStatus('confirming');
      setContractAddress('');
      setErrorMessage('');
      setCurrentStage('');
      setEstimate(null);
      setEstimateError('');
      return;
    }

    if (!bummUid) return;

    let cancelled = false;
    setEstimateLoading(true);
    setEstimateError('');

    (async () => {
      try {
        await tryRefresh();
        const est = await apiClient.getDeployEstimate(bummUid);
        if (!cancelled) setEstimate(est);
      } catch {
        if (!cancelled) setEstimateError('Could not load cost estimate.');
      } finally {
        if (!cancelled) setEstimateLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, bummUid]);

  const startDeploy = async () => {
    if (!bummUid) {
      setErrorMessage('No contract ID found.');
      setDeployStatus('error');
      return;
    }

    setDeployStatus('deploying');
    setCurrentStage('Triggering deployment…');

    let cancelled = false;

    try {
      await tryRefresh();
      await apiClient.triggerDeploy(bummUid);

      const pollMs = 2000;
      const maxAttempts = 180; // 6 min
      let attempts = 0;

      while (!cancelled && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, pollMs));
        attempts++;

        const res = await fetchContractStatusAuthorized(bummUid);
        if (!res.ok) continue;

        const data = await res.json();
        const phase: string = data.phase ?? '';

        if (phase === 'deploying') {
          setCurrentStage('Uploading to Solana…');
        } else if (phase === 'learning') {
          setCurrentStage('Finalizing…');
        }

        if (phase === 'failed') {
          throw new Error(
            (data as { error?: string }).error?.trim() ||
              'Deployment failed. Check devnet SOL / faucet limits and backend logs.',
          );
        }

        if (phase === 'done') {
          if (data.program_id) {
            setContractAddress(data.program_id);
            setDeployStatus('success');
            onComplete?.(data.program_id);
            return;
          }
          const err = (data as { error?: string }).error?.trim();
          throw new Error(
            err
              ? `Deploy did not return a program ID: ${err}`
              : 'Pipeline finished without a program ID. Refresh status or try Deploy again.',
          );
        }
      }

      throw new Error('Deployment timed out after 6 minutes');
    } catch (err) {
      if (cancelled) return;
      setErrorMessage(err instanceof Error ? err.message : 'Deployment failed');
      setDeployStatus('error');
    }

    return () => { cancelled = true; };
  };

  const explorerUrl = `https://explorer.solana.com/address/${contractAddress}?cluster=${network === 'mainnet' ? 'mainnet-beta' : 'devnet'}`;

  const buyCreditsUrl = estimate && estimate.missing_credits > 0
    ? `/credits?amount=${estimate.missing_credits}`
    : '/credits';

  const isMainnet = network === 'mainnet';
  const hasCost = estimate && isMainnet && estimate.estimated_credits > 0;
  const insufficient = estimate ? !estimate.sufficient : false;

  return (
    <AnimatePresence>
      {isOpen && (
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#0A0A0A] border border-orange-500/30 rounded-lg shadow-2xl shadow-orange-500/10 w-full max-w-lg mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#333]">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-orange-500" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Deploy Smart Contract</h2>
                  <p className="text-xs text-gray-400">Deploy to Solana {network}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Confirmation screen */}
              {deployStatus === 'confirming' && (
                <div className="space-y-4">
                  {/* Deployment info */}
                  <div className="bg-[#191919] border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">Deployment Info</p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                          The contract will be deployed to Solana <strong className="text-white">{network}</strong> using
                          the protocol's deployer wallet. On-chain fees are covered by the protocol.
                          {network === 'devnet' && ' Devnet SOL is free (airdropped automatically).'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cost estimate */}
                  <div className="bg-[#191919] border border-[#333] rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Network</span>
                      <span className="text-white font-medium capitalize">{network}</span>
                    </div>

                    {estimateLoading && (
                      <div className="flex items-center gap-2 py-1">
                        <DancingDotsLoader />
                        <span className="text-xs text-gray-500">Loading cost estimate…</span>
                      </div>
                    )}

                    {estimateError && !estimateLoading && (
                      <div className="text-xs text-yellow-500/80">{estimateError}</div>
                    )}

                    {estimate && !estimateLoading && (
                      <>
                        {hasCost ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Program size</span>
                              <span className="text-white font-medium">
                                {estimate.so_size_bytes
                                  ? `${(estimate.so_size_bytes / 1024).toFixed(0)} KB`
                                  : '~300 KB (estimate)'}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Estimated cost</span>
                              <span className="text-orange-400 font-medium">
                                {estimate.estimated_sol} SOL ≈ {estimate.estimated_credits} credits
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Your balance</span>
                              <span className={`font-medium ${insufficient ? 'text-red-400' : 'text-green-400'}`}>
                                {estimate.user_balance_credits} credits
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Deploy cost</span>
                              <span className="text-green-400 font-medium">Free (devnet)</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Credits needed</span>
                              <span className="text-yellow-400 font-medium">Included in pipeline</span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {!estimate && !estimateLoading && !estimateError && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Deploy cost</span>
                          <span className="text-green-400 font-medium">Protocol-paid</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Credits needed</span>
                          <span className="text-yellow-400 font-medium">Included in pipeline</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Insufficient credits warning */}
                  {insufficient && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-950/40 border border-red-500/30 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-red-300 text-xs font-medium mb-1">Insufficient Credits</p>
                          <p className="text-red-400/80 text-xs leading-relaxed">
                            You need {estimate!.missing_credits} more credits to deploy on mainnet.
                          </p>
                          <a
                            href={buyCreditsUrl}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            Buy {estimate!.missing_credits} credits →
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={startDeploy}
                    disabled={insufficient}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-orange-500 disabled:hover:to-orange-600"
                  >
                    <Rocket className="w-4 h-4" />
                    Deploy to {network}
                  </button>
                </div>
              )}

              {/* Deploying */}
              {deployStatus === 'deploying' && (
                <div className="space-y-4">
                  <div className="bg-[#191919] rounded-lg p-2.5 border border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <DancingDotsLoader />
                      <span className="text-white font-medium text-sm">{currentStage}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Audit + deploy may take several minutes</p>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Validating artifact',       done: true },
                      { label: 'Uploading to Solana',       done: currentStage.includes('Uploading') || currentStage.includes('Finalizing') },
                      { label: 'Confirming on-chain',       done: currentStage.includes('Finalizing') },
                      { label: 'Saving program ID',         done: false },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[#191919]/50">
                        {step.done
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          : <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
                        }
                        <span className={`text-xs ${step.done ? 'text-green-400' : 'text-gray-500'}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {deployStatus === 'error' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-4">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <h3 className="text-base font-semibold text-white mb-1">Deployment Failed</h3>
                    <p className="text-gray-400 text-xs text-center max-w-xs">{errorMessage}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startDeploy}
                      className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Success */}
              {deployStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col items-center py-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                    >
                      <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
                    </motion.div>
                    <h3 className="text-base font-semibold text-white mb-1">Deployment Successful!</h3>
                    <p className="text-gray-400 text-xs">Contract deployed to Solana {network}</p>
                  </div>

                  <div className="bg-[#191919] rounded-lg p-3">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Program Address</label>
                    <div className="flex items-center gap-2 p-2 bg-[#0A0A0A] rounded border border-[#333]">
                      <code className="flex-1 text-xs text-white font-mono break-all">{contractAddress}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(contractAddress)}
                        className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                        title="Copy address"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => window.open(explorerUrl, '_blank')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Globe className="w-4 h-4" />
                      View on Explorer
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors text-sm"
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
