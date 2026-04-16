'use client';

import { useMemo } from 'react';
import { diffLines } from 'diff';
import type { Change } from 'diff';

interface FixDiffViewerProps {
  before: string;
  after: string;
  className?: string;
}

export function FixDiffViewer({ before, after, className = '' }: FixDiffViewerProps) {
  const changes = useMemo(() => diffLines(before, after), [before, after]);

  return (
    <div className={`rounded-lg border border-[#2a2a2a] overflow-hidden ${className}`}>
      <div className="overflow-auto max-h-80 font-mono text-xs bg-[#0d0d0d]">
        {changes.map((change: Change, i: number) => {
          const lines = (change.value ?? '').split('\n').filter((_, idx, arr) =>
            // skip the trailing empty string from split
            !(idx === arr.length - 1 && arr[arr.length - 1] === '')
          );
          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={`px-3 py-0.5 leading-5 whitespace-pre-wrap break-all ${
                change.added
                  ? 'bg-green-950/60 text-green-300 border-l-2 border-green-500'
                  : change.removed
                  ? 'bg-red-950/60 text-red-300 border-l-2 border-red-500'
                  : 'text-gray-400'
              }`}
            >
              <span className="select-none mr-2 text-gray-600">
                {change.added ? '+' : change.removed ? '-' : ' '}
              </span>
              {line || ' '}
            </div>
          ));
        })}
      </div>
    </div>
  );
}
