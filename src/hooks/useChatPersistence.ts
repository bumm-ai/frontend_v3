'use client';

import { useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/services/api';
import { SCRATCH_UID } from '@/components/dashboard/dashboardHelpers';
import type { ChatMessage } from '@/types/dashboard';

/** Content hash used to skip redundant backend PUTs (id + length per message). */
function chatHash(msgs: ChatMessage[]): string {
  return `${msgs.length}:${msgs.map((m) => `${m.id}#${m.content.length}`).join('|')}`;
}

export interface ChatPersistenceApi {
  /**
   * Pre-seed the save-hash for a project so the auto-save effect does not
   * immediately PUT just-loaded messages straight back to the backend (used on
   * cold-load in the dashboard's handleSelectProject).
   */
  markPersisted: (uid: string, msgs: ChatMessage[]) => void;
}

/**
 * Persists per-project chat history to BOTH localStorage (fast cold-start
 * cache) and the backend (survives logout/login).
 *
 * Extracted verbatim from Dashboard — pure side-effects over `messagesByUid`,
 * no component setters involved, so the behaviour is unchanged:
 *
 * - localStorage: write-only cache keyed `bumm_chat_history_{uid}`; cold reads
 *   happen in the dashboard's `handleSelectProject`.
 * - backend: mirrors messages so later progress notices ("Build succeeded",
 *   "Deploy failed", added after the create-time snapshot) survive sign-out. A
 *   per-project content hash skips redundant PUTs; a 1.5s debounce coalesces
 *   bursts of stage reports. The scratch slot is never sent to the backend.
 */
export function useChatPersistence(
  messagesByUid: Record<string, ChatMessage[]>,
  isAuthenticated: boolean,
): ChatPersistenceApi {
  // localStorage write-only cache.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const [uid, msgs] of Object.entries(messagesByUid)) {
      if (msgs.length > 0) {
        try {
          localStorage.setItem(`bumm_chat_history_${uid}`, JSON.stringify(msgs));
        } catch {
          // Storage full — non-fatal
        }
      }
    }
  }, [messagesByUid]);

  // Backend mirror (debounced, hash-guarded).
  const lastSavedChatHashRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!isAuthenticated) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [uid, msgs] of Object.entries(messagesByUid)) {
      if (uid === SCRATCH_UID) continue;
      if (!msgs || msgs.length === 0) continue;
      // Cheap content hash — id + content length covers every additive change
      // (most chat updates are appends; we don't edit history).
      const hash = chatHash(msgs);
      if (lastSavedChatHashRef.current[uid] === hash) continue;
      const t = setTimeout(() => {
        const chatForBackend = msgs.map((m) => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.content,
          timestamp:
            m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
        }));
        apiClient
          .saveContractChat(uid, chatForBackend)
          .then(() => {
            lastSavedChatHashRef.current[uid] = hash;
          })
          .catch(() => {
            // Best-effort — leave hash un-set so we retry on next change.
          });
      }, 1500);
      timers.push(t);
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [messagesByUid, isAuthenticated]);

  const markPersisted = useCallback((uid: string, msgs: ChatMessage[]) => {
    lastSavedChatHashRef.current[uid] = chatHash(msgs);
  }, []);

  return { markPersisted };
}
