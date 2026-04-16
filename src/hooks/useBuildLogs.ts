'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createSseStream } from '@/services/sseClient';
import { getAccessToken } from '@/services/api';
import { ENDPOINTS } from '@/config/api';

export interface BuildLogState {
  lines: string[];          // ring buffer, max MAX_LINES
  isStreaming: boolean;
  error: string | null;
  version: number;          // last received build_log_version
}

const MAX_LINES = 2000;
const RING_PUSH = (prev: string[], incoming: string): string[] => {
  const split = incoming.split('\n');
  const next = [...prev, ...split];
  return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
};

export function useBuildLogs(uid: string | undefined, active: boolean): BuildLogState {
  const [lines, setLines]            = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]            = useState<string | null>(null);
  const [version, setVersion]        = useState(0);
  const lastVersionRef               = useRef(-1);
  const cleanupRef                   = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    setLines([]);
    setIsStreaming(false);
    setError(null);
    setVersion(0);
    lastVersionRef.current = -1;
  }, []);

  useEffect(() => {
    if (!uid || !active) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!active) reset();
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    reset();
    setIsStreaming(true);

    const url = ENDPOINTS.LOGS_STREAM(uid);
    cleanupRef.current = createSseStream(
      url,
      token,
      (event) => {
        // Only append when version advances
        if (event.version > lastVersionRef.current) {
          lastVersionRef.current = event.version;
          setVersion(event.version);
          if (event.tail) {
            setLines((prev) => RING_PUSH(prev, event.tail));
          }
        }
      },
      () => {
        // Stream closed (done/failed phase)
        setIsStreaming(false);
      },
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [uid, active, reset]);

  return { lines, isStreaming, error, version };
}
