'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Wrench, Search, Code, Play, TestTube, Zap, CheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { DancingDotsLoader } from './DancingDotsLoader';

interface BuildStage {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
}

const buildStages: BuildStage[] = [
  {
    id: 'setup-anchor',
    title: 'Setting up Anchor',
    description: 'Initializing Anchor framework and configuring program structure',
    icon: Settings,
    duration: 2000
  },
  {
    id: 'build-progress',
    title: 'Build Progress',
    description: 'Compiling Rust code and dependencies',
    icon: Wrench,
    duration: 2400
  },
  {
    id: 'analyzing',
    title: 'Analyzing project',
    description: 'Checking code structure and dependencies',
    icon: Search,
    duration: 1600
  },
  {
    id: 'generating',
    title: 'Generating code',
    description: 'Creating optimized bytecode',
    icon: Code,
    duration: 2000
  },
  {
    id: 'compiling',
    title: 'Compiling contract',
    description: 'Building final contract binary',
    icon: Play,
    duration: 2200
  },
  {
    id: 'testing',
    title: 'Running tests',
    description: 'Executing unit and integration tests',
    icon: TestTube,
    duration: 2000
  },
  {
    id: 'optimizing',
    title: 'Optimizing',
    description: 'Final optimizations and size reduction',
    icon: Zap,
    duration: 1600
  }
];

interface BuildStagesProps {
  isBuilding: boolean;
  onComplete: () => void;
  onAddAIMessage: (message: string) => void;
}

export const BuildStages = ({ isBuilding, onComplete, onAddAIMessage }: BuildStagesProps) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  // Track whether we've ever started to avoid calling onComplete on first mount.
  const startedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // When backend signals done (isBuilding → false), flash all complete and notify.
  useEffect(() => {
    if (isBuilding) {
      startedRef.current = true;
      return;
    }
    if (!startedRef.current) return;
    startedRef.current = false;
    setCompletedStages(buildStages.map(s => s.id));
    onCompleteRef.current();
  }, [isBuilding]);

  // Advance animation stages on a timer; park on the last until backend is done.
  useEffect(() => {
    if (!isBuilding) {
      setCurrentStageIndex(0);
      setCompletedStages([]);
      return;
    }

    if (currentStageIndex >= buildStages.length - 1) return;

    const currentStage = buildStages[currentStageIndex];
    const timeoutId = setTimeout(() => {
      setCompletedStages(prev => [...prev, currentStage.id]);
      setCurrentStageIndex(prev => prev + 1);
    }, currentStage.duration);

    return () => clearTimeout(timeoutId);
  }, [isBuilding, currentStageIndex]);

  if (!isBuilding) return null;

  const currentStage = buildStages[currentStageIndex];

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
          className="text-yellow-600/90"
        >
          {currentStage && <currentStage.icon className="w-4 h-4" />}
        </motion.div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="border border-dashed border-yellow-600/60 rounded-lg p-6 bg-[#191919] flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-medium text-sm">
              Build Smart Contract
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
                  <currentStage.icon className="w-4 h-4 text-yellow-600/90" />
                  <div className="text-yellow-500/90 font-medium text-sm">
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
            {buildStages.map((stage, index) => {
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
                        ? 'bg-yellow-600/80' 
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
                        ? 'text-yellow-500/90' 
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
          Building smart contract...
        </div>
      </div>
    </motion.div>
  );
};