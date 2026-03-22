'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Code, Brain, Wrench, Rocket, CheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { DancingDotsLoader } from './DancingDotsLoader';
import { contractCodes, getContractType } from './contractTemplates';

interface CodeGenerationStagesProps {
  isGenerating: boolean;
  onComplete: (code: string) => void;
  onAddAIMessage?: (message: string) => void;
  context?: string; // Context for determining contract type
  /** When true, only animate (no fake code) — wait for external completion */
  waitForExternalCode?: boolean;
}

type Stage = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
};


const stages: Stage[] = [
  {
    id: 'understand',
    title: 'Understand user query',
    description: 'AI is analyzing and understanding your request',
    icon: Brain,
    duration: 800
  },
  {
    id: 'features',
    title: 'Identify core features',
    description: 'Identifying key features and requirements',
    icon: Code,
    duration: 1000
  },
  {
    id: 'plan',
    title: 'Build plan',
    description: 'Creating development plan and architecture',
    icon: Wrench,
    duration: 900
  },
  {
    id: 'implement',
    title: 'Implement contracts',
    description: 'Writing smart contract code and logic',
    icon: Code,
    duration: 1500
  },
  {
    id: 'tests',
    title: 'Implement tests',
    description: 'Creating comprehensive test suites',
    icon: Wrench,
    duration: 1200
  },
  {
    id: 'build',
    title: 'Build project',
    description: 'Compiling and building the project structure',
    icon: Rocket,
    duration: 1000
  },
  {
    id: 'run-tests',
    title: 'Run tests',
    description: 'Executing tests and validating functionality',
    icon: Brain,
    duration: 800
  }
];

export const CodeGenerationStages = ({ isGenerating, onComplete, onAddAIMessage, context, waitForExternalCode }: CodeGenerationStagesProps) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const contextRef = useRef(context || '');

  // Update contextRef when context changes
  useEffect(() => {
    contextRef.current = context || '';
  }, [context]);

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStageIndex(0);
      setCompletedStages([]);
      setProgress(0);
      return;
    }

    // Main stage animation (visual only, no chat messages)
    let timeoutId: NodeJS.Timeout;
    
    if (currentStageIndex < stages.length) {
      const currentStage = stages[currentStageIndex];
      
      timeoutId = setTimeout(() => {
        setCompletedStages(prev => [...prev, currentStage.id]);
        
        if (currentStageIndex === stages.length - 1) {
          if (waitForExternalCode) {
            // Loop back to first stage — keep animating until real code arrives
            setCurrentStageIndex(0);
            setCompletedStages([]);
          } else {
            // Demo mode: use template code
            const contractType = getContractType(contextRef.current);
            const generatedCode = contractCodes[contractType as keyof typeof contractCodes] || contractCodes.defi;
            setTimeout(() => onComplete(generatedCode), 500);
          }
        } else {
          setCurrentStageIndex(prev => prev + 1);
        }
      }, currentStage.duration);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isGenerating, currentStageIndex, onComplete, waitForExternalCode]);

  if (!isGenerating) return null;

  const currentStage = stages[currentStageIndex];

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
          className="text-orange-500"
        >
          {currentStage && <currentStage.icon className="w-4 h-4" />}
        </motion.div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="border border-dashed border-purple-500 rounded-lg p-6 bg-[#191919] flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-medium text-sm">
              AI Smart Contract Generation
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
                  <currentStage.icon className="w-4 h-4 text-orange-500" />
                  <div className="text-orange-400 font-medium text-sm">
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
            {stages.map((stage, index) => {
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
                      ? 'bg-green-500' 
                      : isCurrent 
                        ? 'bg-orange-500' 
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
                      ? 'text-green-400' 
                      : isCurrent 
                        ? 'text-orange-400' 
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
          Generating smart contract...
        </div>
      </div>
    </motion.div>
  );
};
