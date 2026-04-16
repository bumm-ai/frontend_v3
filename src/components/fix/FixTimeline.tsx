'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Brain, CheckCircle, XCircle, Clock } from 'lucide-react';
import { FixDiffViewer } from './FixDiffViewer';
import type { FixEntry } from '@/hooks/useFixDiff';

interface FixTimelineProps {
  entries: FixEntry[];
  isLoading?: boolean;
  error?: string | null;
}

export function FixTimeline({ entries, isLoading, error }: FixTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) {
    return <div className="text-xs text-gray-500 py-4 text-center">Loading fix history…</div>;
  }
  if (error) {
    return <div className="text-xs text-red-400 py-2">{error}</div>;
  }
  if (entries.length === 0) {
    return <div className="text-xs text-gray-500 py-4 text-center">No fixes applied</div>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isOpen = expanded === entry.index;
        const fix = entry.fix;

        return (
          <div key={entry.index} className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            {/* Fix header — click to expand */}
            <button
              onClick={() => setExpanded(isOpen ? null : entry.index)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-[#111] hover:bg-[#161616] transition-colors text-left"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}

              {/* Source badge */}
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                fix.source === 'knowledge_base'
                  ? 'bg-blue-900/40 text-blue-300'
                  : 'bg-purple-900/40 text-purple-300'
              }`}>
                {fix.source === 'knowledge_base' ? <Database className="w-2.5 h-2.5" /> : <Brain className="w-2.5 h-2.5" />}
                {fix.source === 'knowledge_base' ? 'KB' : 'LLM'}
              </span>

              <span className="text-xs text-gray-300 flex-1 truncate">{fix.error_pattern}</span>

              {/* Success badge */}
              {fix.was_successful === true && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
              {fix.was_successful === false && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
              {fix.was_successful === null && <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            </button>

            {/* Expanded: description + diff */}
            {isOpen && (
              <div className="border-t border-[#2a2a2a]">
                {fix.fix_description && (
                  <div className="px-3 py-2 text-xs text-gray-400 bg-[#0a0a0a] border-b border-[#2a2a2a]">
                    {fix.fix_description}
                  </div>
                )}
                <FixDiffViewer before={entry.before} after={entry.after} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
