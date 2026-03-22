'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { X, Rocket, CheckCircle, AlertCircle, Settings, Upload, Globe, ExternalLink } from 'lucide-react';
import { DancingDotsLoader } from './DancingDotsLoader';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (code: string) => Promise<string | undefined>;
  onComplete?: (address?: string) => void;
  contractCode: string;
  network: 'devnet' | 'mainnet';
  bummUid?: string;
}

type DeployStage = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
  status: 'pending' | 'active' | 'completed' | 'error';
};

const deployStages: DeployStage[] = [
  {
    id: 'validation',
    title: 'Contract Validation',
    description: 'Validating smart contract code and dependencies',
    icon: Settings,
    duration: 2000,
    status: 'pending'
  },
  {
    id: 'compilation',
    title: 'Compilation',
    description: 'Compiling Rust code to Solana bytecode',
    icon: Settings,
    duration: 3000,
    status: 'pending'
  },
  {
    id: 'upload',
    title: 'Uploading to Network',
    description: 'Uploading bytecode to Solana blockchain',
    icon: Upload,
    duration: 4000,
    status: 'pending'
  },
  {
    id: 'deployment',
    title: 'Deployment',
    description: 'Deploying and initializing smart contract',
    icon: Rocket,
    duration: 3000,
    status: 'pending'
  },
  {
    id: 'verification',
    title: 'Verification',
    description: 'Verifying deployment and generating contract address',
    icon: CheckCircle,
    duration: 2000,
    status: 'pending'
  }
];

export const DeployModal = ({ isOpen, onClose, onDeploy, onComplete, contractCode, network, bummUid }: DeployModalProps) => {
  const [stages, setStages] = useState<DeployStage[]>(deployStages);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<'deploying' | 'success' | 'error'>('deploying');
  const [contractAddress, setContractAddress] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStages(deployStages.map(stage => ({ ...stage, status: 'pending' })));
      setCurrentStageIndex(0);
      setDeploymentStatus('deploying');
      setContractAddress('');
      setTransactionHash('');
      setErrorMessage('');
      return;
    }

    let cancelled = false;

    const startDeploy = async () => {
      try {
        setDeploymentStatus('deploying');
        setCurrentStageIndex(0);
        setStages(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));

        const userId = localStorage.getItem('bumm_user_uid') || '';
        const textToSend = bummUid || contractCode;

        const startRes = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BUMM_DEPLOY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ text: textToSend }),
        });

        if (!startRes.ok) {
          if (startRes.status === 402) throw new Error('Insufficient credits (75 needed)');
          const err = await startRes.json().catch(() => ({}));
          throw new Error(err.detail || `Deploy failed: ${startRes.status}`);
        }

        const { uid: deployUid } = await startRes.json();

        let attempts = 0;
        while (!cancelled && attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const res = await fetch(
            `${API_BASE_URL}${API_ENDPOINTS.BUMM_DEPLOY_STATUS}${deployUid}/`,
            { headers: { 'x-user-id': userId } }
          );
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === 'deployed') {
            const addr = data.program_id || '';
            setContractAddress(addr);
            setTransactionHash('');
            setStages(prev => prev.map(s => ({ ...s, status: 'completed' })));
            setDeploymentStatus('success');
            onComplete?.(addr);
            return;
          }
          if (data.status === 'error') {
            throw new Error(data.error || 'Deploy failed');
          }
        }

        throw new Error('Deploy timed out');
      } catch (err) {
        if (cancelled) return;
        setDeploymentStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Deployment failed');
        setStages(prev => prev.map((s, i) => ({
          ...s,
          status: i <= currentStageIndex ? (i < currentStageIndex ? 'completed' : 'error') : 'pending'
        })));
      }
    };

    startDeploy();
    return () => { cancelled = true; };
  }, [isOpen, contractCode, bummUid, onComplete, currentStageIndex]);

  const getStageColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'active': return 'text-orange-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-500';
    }
  };

  const getStageIcon = (stage: DeployStage) => {
    const IconComponent = stage.icon;
    if (stage.status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    } else if (stage.status === 'error') {
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    } else if (stage.status === 'active') {
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
                  <p className="text-xs text-gray-400">Deploying to Solana {network}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {deploymentStatus === 'error' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <h3 className="text-base font-semibold text-white mb-1">Deployment Failed</h3>
                    <p className="text-gray-400 text-xs text-center">{errorMessage}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {deploymentStatus === 'deploying' && (
                <div className="space-y-4">
                  {/* Current Stage Info */}
                  <div className="bg-[#191919] rounded-lg p-2.5 border border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <DancingDotsLoader />
                      <span className="text-white font-medium text-sm">
                        {stages[currentStageIndex]?.title || 'Processing...'}
                      </span>
                    </div>
                  </div>

                  {/* Stages Progress */}
                  <div className="space-y-1.5">
                    <h3 className="text-white font-medium text-xs">Deployment Progress</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {stages.map((stage, index) => (
                        <motion.div
                          key={stage.id}
                          className="flex items-center gap-1.5 p-1.5 rounded-md bg-[#191919]/50 border border-orange-500/10"
                          initial={{ opacity: 0.5 }}
                          animate={{ 
                            opacity: stage.status === 'pending' ? 0.5 : 1,
                            scale: stage.status === 'active' ? 1.02 : 1,
                            borderColor: stage.status === 'active' ? 'rgb(249 115 22 / 0.3)' : 'rgb(249 115 22 / 0.1)'
                          }}
                        >
                          <div className="flex-shrink-0">
                            {getStageIcon(stage)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-xs truncate ${getStageColor(stage.status)}`}>
                              {stage.title}
                            </div>
                          </div>
                          {stage.status === 'active' && (
                            <motion.div
                              className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {deploymentStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
                    </motion.div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      Deployment Successful!
                    </h3>
                    <p className="text-gray-400 text-xs">
                      Contract deployed to Solana {network}
                    </p>
                  </div>

                  <div className="bg-[#191919] rounded-lg p-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Contract Address
                      </label>
                      <div className="flex items-center gap-2 p-2 bg-[#0A0A0A] rounded border border-[#333]">
                        <code className="flex-1 text-xs text-white font-mono break-all">
                          {contractAddress}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(contractAddress)}
                          className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Transaction Hash
                      </label>
                      <div className="flex items-center gap-2 p-2 bg-[#0A0A0A] rounded border border-[#333]">
                        <code className="flex-1 text-xs text-white font-mono break-all">
                          {transactionHash}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(transactionHash)}
                          className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => window.open(`https://explorer.solana.com/address/${contractAddress}?cluster=${network}`, '_blank')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      View on Explorer
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-3 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors"
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
