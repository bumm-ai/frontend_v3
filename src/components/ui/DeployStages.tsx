'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Upload, Network, Shield, Rocket, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DancingDotsLoader } from './DancingDotsLoader';

interface DeployStage {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
}

const deployStages: DeployStage[] = [
  {
    id: 'verification',
    title: 'Verification',
    description: 'Verifying contract integrity and dependencies',
    icon: Shield,
    duration: 2000
  },
  {
    id: 'deployment-progress',
    title: 'Deployment Progress',
    description: 'Preparing deployment environment',
    icon: Rocket,
    duration: 1800
  },
  {
    id: 'contract-validation',
    title: 'Contract Validation',
    description: 'Validating contract structure and logic',
    icon: CheckCircle,
    duration: 2200
  },
  {
    id: 'compilation',
    title: 'Compilation',
    description: 'Compiling contract for deployment',
    icon: Zap,
    duration: 2000
  },
  {
    id: 'uploading',
    title: 'Uploading to Network',
    description: 'Uploading contract to Solana network',
    icon: Upload,
    duration: 2400
  },
  {
    id: 'deployment-verification',
    title: 'Deployment Verification',
    description: 'Verifying successful deployment',
    icon: Network,
    duration: 1800
  }
];

interface DeployStagesProps {
  isDeploying: boolean;
  onComplete: () => void;
  onAddAIMessage: (message: string) => void;
}

export const DeployStages = ({ isDeploying, onComplete, onAddAIMessage }: DeployStagesProps) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);

  useEffect(() => {
    if (!isDeploying) {
      setCurrentStageIndex(0);
      setCompletedStages([]);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    
    if (currentStageIndex < deployStages.length) {
      const currentStage = deployStages[currentStageIndex];
      
      timeoutId = setTimeout(() => {
        setCompletedStages(prev => [...prev, currentStage.id]);
        
        if (currentStageIndex === deployStages.length - 1) {
          setTimeout(() => {
            onComplete();
          }, 500);
        } else {
          setCurrentStageIndex(prev => prev + 1);
        }
      }, currentStage.duration);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isDeploying, currentStageIndex, onComplete]);

  if (!isDeploying) return null;

  const currentStage = deployStages[currentStageIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex gap-3 h-full"
    >
      <div className="w-8 h-8 rounded-full bg-[#191919] flex items-center justify-center">
        <motion.div
          key={currentStage?.id}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-orange-600/90"
        >
          {currentStage && <currentStage.icon className="w-4 h-4" />}
        </motion.div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="border border-dashed border-orange-600/60 rounded-lg p-6 bg-[#191919] flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-medium text-sm">
              Deploy Smart Contract
            </div>
            <DancingDotsLoader />
          </div>

          {/* Current Stage */}
          <AnimatePresence mode="wait">
            {currentStage && (
              <motion.div
                key={currentStage.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <currentStage.icon className="w-4 h-4 text-orange-600/90" />
                  <div className="text-orange-500/90 font-medium text-sm">
                    {currentStage.title}
                  </div>
                </div>
                <div className="text-gray-400 text-xs">
                  {currentStage.description}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Stages */}
          <div className="space-y-2 flex-1">
            {deployStages.map((stage, index) => {
              const isCompleted = completedStages.includes(stage.id);
              const isCurrent = currentStageIndex === index;

              return (
                <motion.div
                  key={stage.id}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0.3 }}
                  animate={{ 
                    opacity: isCompleted ? 1 : isCurrent ? 0.8 : 0.3,
                    scale: isCurrent ? 1.02 : 1
                  }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-600/80' 
                      : isCurrent 
                        ? 'bg-orange-600/80' 
                        : 'bg-gray-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-3 h-3 text-white" />
                    ) : isCurrent ? (
                      <motion.div
                        className="w-2 h-2 bg-white rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    )}
                  </div>
                  
                  <div className={`text-xs ${
                    isCompleted 
                      ? 'text-green-500/90' 
                      : isCurrent 
                        ? 'text-orange-500/90' 
                        : 'text-gray-500'
                  }`}>
                    {stage.title}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        
        <div className="text-xs text-[#666] mt-1 flex-shrink-0">
          Deploying to Solana devnet...
        </div>
      </div>
    </motion.div>
  );
};