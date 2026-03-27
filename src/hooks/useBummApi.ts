'use client';

/**
 * Compatibility stub — v2 dashboard still imports this hook.
 * New code should use useAuth / useContract / useCredits directly.
 * All pipeline operations now live at /contracts/new (createContract)
 * and /contracts/[uid] (WebSocket status streaming).
 */

import { useState, useCallback } from 'react';
import type { Project, User, GenerationProgress } from '@/types/dashboard';

const DEPRECATED_MSG = 'This operation is no longer supported. Use the new /contracts flow.';

export const useBummApi = () => {
  const [user]       = useState<User | null>(null);
  const [projects]   = useState<Project[]>([]);
  const [isLoading]  = useState(false);
  const [error]      = useState<string | null>(null);

  const noopVoid = useCallback(async (..._args: unknown[]): Promise<void> => {
    console.warn('[useBummApi] ' + DEPRECATED_MSG);
  }, []);

  /** createProject stub — returns a minimal Project so Dashboard can spread safely */
  const createProject = useCallback(async (name: string): Promise<Project> => {
    console.warn('[useBummApi] createProject is deprecated. Use the new /contracts flow.');
    return {
      uid:        `stub-${Date.now()}`,
      name:       name ?? 'New Contract',
      status:     'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task:       null,
    };
  }, []);

  /** generateContract — typed to match ChatScreen.onGenerateContract prop */
  const generateContract = useCallback(
    async (description: string): Promise<Project> => {
      console.warn('[useBummApi] generateContract is deprecated.');
      return {
        uid:        `stub-${Date.now()}`,
        name:       description,
        status:     'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task:       null,
      };
    },
    [],
  );

  /** generateInProject — returns Project so spread works */
  const generateInProject = useCallback(
    async (_prompt: string, _projectUid: string): Promise<Project> => {
      console.warn('[useBummApi] generateInProject is deprecated.');
      return {
        uid:        _projectUid ?? `stub-${Date.now()}`,
        name:       null,
        status:     'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task:       null,
      };
    },
    [],
  );

  /** buildContract — returns a Project-like value */
  const buildContract = useCallback(
    async (_code: string, _projectUid?: string): Promise<Project> => {
      console.warn('[useBummApi] buildContract is deprecated.');
      return {
        uid:        _projectUid ?? `stub-${Date.now()}`,
        name:       null,
        status:     'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task:       null,
      };
    },
    [],
  );

  /** auditContract — void */
  const auditContract = useCallback(async (_code: string): Promise<void> => {
    console.warn('[useBummApi] auditContract is deprecated.');
  }, []);

  /** deployContract — returns a contract address string */
  const deployContract = useCallback(async (_code: string): Promise<string> => {
    console.warn('[useBummApi] deployContract is deprecated.');
    return '';
  }, []);

  /** trackTaskStatus stub — typed to match Dashboard's call signature */
  const trackTaskStatus = useCallback(
    async (
      _uid: string,
      _taskType: string,
      _onProgress?: (progress: GenerationProgress) => void,
      _onComplete?: (result: unknown) => void,
      _onError?: (error: unknown) => void,
      _bummUid?: string,
    ): Promise<void> => {
      console.warn('[useBummApi] trackTaskStatus is deprecated.');
    },
    [],
  );

  /** updateProjects stub — accepts the same updater fn Dashboard passes */
  const updateProjects = useCallback(
    (_updater: ((prev: Project[]) => Project[]) | Project[]): void => {
      console.warn('[useBummApi] updateProjects is deprecated.');
    },
    [],
  );

  /** sendChatMessage stub — returns a minimal chat response shape */
  const sendChatMessage = useCallback(
    async (
      _message: string,
      _bummUid: string | null,
    ): Promise<{ reply: string; action: string; bumm_uid?: string }> => {
      console.warn('[useBummApi] sendChatMessage is deprecated.');
      return {
        reply:  'This chat is no longer supported. Use the new /contracts flow.',
        action: 'none',
      };
    },
    [],
  );

  return {
    user,
    projects,
    isLoading,
    error,
    // Auth stubs
    initializeUser:  noopVoid,
    // Pipeline stubs
    generateContract,
    generateInProject,
    auditContract,
    buildContract,
    deployContract,
    trackTaskStatus,
    loadProjects:    noopVoid,
    createProject,
    updateProjects,
    sendChatMessage,
    loadChatHistory: noopVoid,
  };
};
