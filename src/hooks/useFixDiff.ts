'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import type { AppliedFixItem } from '@/lib/api';

export interface FixEntry {
  index: number;          // version index
  before: string;         // code before fix
  after: string;          // code after fix (this version)
  fix: AppliedFixItem;    // fix metadata
}

export interface UseFixDiffResult {
  entries: FixEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFixDiff(uid: string | undefined): UseFixDiffResult {
  const [entries, setEntries]   = useState<FixEntry[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [tick, setTick]         = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient.getCodeHistory(uid)
      .then((resp) => {
        if (cancelled) return;
        // Build FixEntry list: only versions that have a linked_fix
        const versions = resp.versions;
        const result: FixEntry[] = [];
        for (let i = 1; i < versions.length; i++) {
          const ver = versions[i];
          if (!ver.linked_fix) continue;
          result.push({
            index: ver.index,
            before: versions[i - 1].code,
            after: ver.code,
            fix: ver.linked_fix,
          });
        }
        setEntries(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [uid, tick]);

  return { entries, isLoading, error, refetch };
}
