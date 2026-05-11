'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { useBuildLogs } from '@/hooks/useBuildLogs';

// anser has no bundled type declarations — use dynamic require with explicit cast
let Anser: { ansiToHtml: (s: string) => string } | null = null;
try {
  // Dynamic require for SSR safety (anser uses DOM)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Anser = require('anser') as { ansiToHtml: (s: string) => string };
} catch {
  Anser = null;
}

function colorize(line: string): string {
  if (!Anser) return line;
  return Anser.ansiToHtml(line);
}

interface BuildLogStreamProps {
  uid: string;
  active: boolean;
  className?: string;
}

export function BuildLogStream({ uid, active, className = '' }: BuildLogStreamProps) {
  const { lines, isStreaming } = useBuildLogs(uid, active);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [copied, setCopied]             = useState(false);

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (!userScrolled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, userScrolled]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40;
    setUserScrolled(!isAtBottom);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500 font-mono">build output</span>
          {isStreaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          )}
        </div>
        <button
          onClick={handleCopy}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded"
          title="Copy logs"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-400" />
            : <Copy className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Log area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-64 overflow-y-auto p-2 font-mono text-xs"
      >
        {lines.length === 0 && isStreaming ? (
          <div className="text-gray-600 italic">Waiting for build output…</div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: colorize(line) || '&nbsp;' }}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
