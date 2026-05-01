'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { DancingDotsLoader } from './DancingDotsLoader';
import { useStageTimers, formatElapsed } from '@/hooks/useStageTimers';

export interface StageView {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional badge shown next to the stage title (e.g. "KB" / "AI" / "v2"). */
  badge?: string;
}

export interface PipelineStagesCardProps {
  headerLabel: string;
  stages: StageView[];
  currentId: string | null;
  completedIds: string[];
  footer: string;
  /** Reset key for per-stage timers (e.g. contract uid). */
  timerKey?: string;
}

/**
 * Shared visual frame used by BuildStages, AuditStages, DeployStages.
 *
 * Pure renderer — all state lives in the parent and is derived from the
 * backend `ContractStatus`. The only client-side state here is per-stage
 * elapsed-time timers (cosmetic) and the indeterminate shimmer.
 */
export const PipelineStagesCard = ({
  headerLabel,
  stages,
  currentId,
  completedIds,
  footer,
  timerKey = 'default',
}: PipelineStagesCardProps) => {
  const currentStage = stages.find((s) => s.id === currentId) ?? stages[0];
  const { getElapsed, isRunning } = useStageTimers(
    currentId,
    completedIds,
    timerKey,
  );

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
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-yellow-600/90"
        >
          {currentStage && <currentStage.icon className="w-4 h-4" />}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="border border-dashed border-yellow-600/60 rounded-lg p-6 bg-[#191919] flex-1 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-medium text-sm">{headerLabel}</div>
            <DancingDotsLoader />
          </div>

          <AnimatePresence mode="wait">
            {currentStage && (
              <motion.div
                // Re-animate when subtitle changes so updates feel live.
                key={`${currentStage.id}:${currentStage.subtitle}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="mb-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <currentStage.icon className="w-4 h-4 text-yellow-600/90" />
                  <div className="text-yellow-500/90 font-medium text-sm">
                    {currentStage.title}
                  </div>
                  {currentStage.badge && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-yellow-500/15 text-yellow-300/90 border border-yellow-500/20">
                      {currentStage.badge}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-yellow-300/70 tabular-nums">
                    {formatElapsed(getElapsed(currentStage.id))}
                  </span>
                </div>
                <div className="text-gray-400 text-xs whitespace-pre-wrap break-words">
                  {currentStage.subtitle}
                </div>

                {/* Indeterminate shimmer — only while active stage is running. */}
                <div className="mt-3 h-[2px] w-full bg-yellow-500/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-yellow-500/70 to-transparent"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2 flex-1">
            {stages.map((stage) => {
              const isCompleted = completedIds.includes(stage.id);
              const isCurrent = currentId === stage.id;
              const elapsed = getElapsed(stage.id);
              const running = isRunning(stage.id);
              return (
                <motion.div
                  key={stage.id}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0.3 }}
                  animate={{
                    opacity: isCompleted ? 1 : isCurrent ? 0.85 : 0.3,
                    scale: isCurrent ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-600/80'
                        : isCurrent
                        ? 'bg-yellow-600/80'
                        : 'bg-gray-600'
                    }`}
                  >
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

                  <div
                    className={`flex-1 flex items-center gap-2 text-xs ${
                      isCompleted
                        ? 'text-green-500/90'
                        : isCurrent
                        ? 'text-yellow-500/90'
                        : 'text-gray-500'
                    }`}
                  >
                    <span>{stage.title}</span>
                    {stage.badge && (
                      <span
                        className={`text-[8px] uppercase tracking-wider px-1 py-0 rounded-sm ${
                          isCompleted
                            ? 'bg-green-500/15 text-green-300/80 border border-green-500/20'
                            : isCurrent
                            ? 'bg-yellow-500/15 text-yellow-300/90 border border-yellow-500/20'
                            : 'bg-gray-700/30 text-gray-500 border border-gray-600/30'
                        }`}
                      >
                        {stage.badge}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isCompleted
                        ? 'text-green-400/70'
                        : running
                        ? 'text-yellow-300/80'
                        : 'text-gray-600'
                    }`}
                  >
                    {elapsed !== null ? formatElapsed(elapsed) : ''}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-[#666] mt-1 flex-shrink-0">{footer}</div>
      </div>
    </motion.div>
  );
};
