import { bummService, userService, chatService } from '@/services/bummService';
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  apiClient,
  BummProject,
  BummGenerateRequest,
  TaskStatus,
  isTaskCompleted,
  isTaskError,
  getStatusDisplayName,
} from '@/lib/api';
import { mockApiClient } from '@/lib/mockApi';
import { Project, ChatMessage, GenerationProgress, User } from '@/types/dashboard';

export const useBummApi = () => {
  const { publicKey, connected } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flag for switching between real and mock API
  const [useMockApi, setUseMockApi] = useState(false); // Start with real API
  
  // Function for switching to Mock API on errors
  const fallbackToMock = useCallback(() => {
    console.warn('🔄 Falling back to Mock API due to errors');
    setUseMockApi(true);
    // Clear userId when switching to Mock API
    apiClient.setUserId('');
  }, []);

  // Function to determine if we need to switch to Mock API
  const shouldFallbackToMock = useCallback((error: unknown, operationName: string): boolean => {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Critical errors requiring fallback to Mock API
      const criticalErrors = [
        'network error',
        'connection refused',
        'timeout',
        'cors',
        'unauthorized',
        'forbidden',
        'internal server error',
        'service unavailable'
      ];
      
      // For user creation and project loading operations - stricter rules
      if (operationName.includes('create wallet') || operationName.includes('load projects')) {
        return criticalErrors.some(criticalError => errorMessage.includes(criticalError));
      }
      
      // For generation operations - only very critical errors
      if (operationName.includes('generate') || operationName.includes('audit') || operationName.includes('build')) {
        return criticalErrors.some(criticalError => errorMessage.includes(criticalError));
      }
      
      // For other operations - standard rules
      return criticalErrors.some(criticalError => errorMessage.includes(criticalError));
    }
    
    return false;
  }, []);

  // Universal function for API calls with fallback
  const apiCall = useCallback(async <T>(
    realApiCall: () => Promise<T>,
    mockApiCall: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    if (useMockApi) {
      return await mockApiCall();
    }

    try {
      return await realApiCall();
    } catch (err) {
      // Check if error is critical for fallback
      const shouldFallback = shouldFallbackToMock(err, operationName);
      
      if (shouldFallback) {
        console.error(`Critical error in ${operationName}, falling back to mock:`, err);
        fallbackToMock();
        return await mockApiCall();
      } else {
        console.warn(`Non-critical error in ${operationName}, retrying with real API:`, err);
        throw err; // Re-throw error for retry
      }
    }
  }, [useMockApi, fallbackToMock, shouldFallbackToMock]);

  // Special function for status tracking without fallback to Mock API
  const statusApiCall = useCallback(async <T>(
    realApiCall: () => Promise<T>,
    mockApiCall: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    if (useMockApi) {
      return await mockApiCall();
    }

    try {
      return await realApiCall();
    } catch (err) {
      // For status requests don't do fallback to Mock API
      // Just re-throw error
      throw err;
    }
  }, [useMockApi]);

  // Mock chat for fallback (when backend is unavailable)
  const mockChatMessage = async (message: string) => ({
    reply:
      "Backend is temporarily unavailable. Please check your connection and try again. What kind of smart contract would you like to create?",
    action: 'none' as const,
    bumm_uid: null,
    status: null,
    message_uid: null,
  });
  
  // User initialization
  const initializeUser = useCallback(async () => {
    if (!publicKey) {
      console.log(`No publicKey available for user initialization`);
      return;
    }

    try {
      console.log(`Starting user initialization...`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`PublicKey: ${publicKey.toString()}`);
      console.log(`Use Mock API: ${useMockApi}`);
      setIsLoading(true);
      setError(null);

      // Create or get user
      const walletAddress = publicKey.toString();
      console.log(`👛 Creating wallet for address: ${walletAddress}`);
      const response = await apiCall(
        () => userService.createWallet(walletAddress),
        () => mockApiClient.createWallet({ wallet: walletAddress }),
        'create wallet'
      );
      
      const newUser: User = {
        uid: response.uid,
        wallet: walletAddress,
      };

      console.log(`User created successfully:`, newUser);
      setUser(newUser);
      
      // Save user uid for all requests
      if (!useMockApi) {
        apiClient.setUserId(response.uid);
        // Save to localStorage for persistence (client only)
        if (typeof window !== 'undefined') {
          try {
        localStorage.setItem('bumm_user_uid', response.uid);
        localStorage.setItem('bumm_user_wallet', walletAddress);
          } catch (err) {
            console.warn('localStorage not available:', err);
          }
        }
      }

      // Load user projects
      console.log(`Loading user projects...`);
      await loadProjects();
    } catch (err) {
      console.error('Failed to initialize user:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize user');
      
      // On initialization error switch to Mock API
      console.log('Switching to Mock API due to initialization error');
      setUseMockApi(true);
      
      // Create mock user
      const mockUser: User = {
        uid: `mock_${Date.now()}`,
        wallet: publicKey.toString(),
      };
      setUser(mockUser);
      
      // Load mock projects
      try {
        await loadProjects();
      } catch (loadErr) {
        console.error('Failed to load mock projects:', loadErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, apiCall, useMockApi]);

  // User initialization при подключении кошелька
  useEffect(() => {
    console.log(`🔌 Wallet Connection Status:`, { connected, publicKey: publicKey?.toString() });
    if (connected && publicKey) {
      console.log(`Initializing user with wallet: ${publicKey.toString()}`);
      
      // Check if there's saved uid for this wallet (client only)
      let savedWallet = null;
      let savedUid = null;
      
      if (typeof window !== 'undefined') {
        try {
          savedWallet = localStorage.getItem('bumm_user_wallet');
          savedUid = localStorage.getItem('bumm_user_uid');
        } catch (err) {
          console.warn('localStorage not available:', err);
        }
      }
      
      if (savedWallet === publicKey.toString() && savedUid && !useMockApi) {
        console.log(`🔄 Restoring user from localStorage: ${savedUid}`);
        const restoredUser: User = {
          uid: savedUid,
          wallet: publicKey.toString(),
        };
        setUser(restoredUser);
        apiClient.setUserId(savedUid);
        loadProjects();
      } else {
        initializeUser();
      }
    } else {
      console.log(`🔌 Wallet disconnected, clearing user data`);
      setUser(null);
      setProjects([]);
      if (!useMockApi && typeof window !== 'undefined') {
        try {
        localStorage.removeItem('bumm_user_uid');
        localStorage.removeItem('bumm_user_wallet');
        } catch (err) {
          console.warn('localStorage not available:', err);
        }
      }
    }
  }, [connected, publicKey, initializeUser, useMockApi]);

  // Load projects
  const loadProjects = async () => {
    if (!user && !useMockApi) {
      console.log(`No user available, skipping project load`);
      return;
    }

    try {
      console.log(`Loading projects for user: ${user?.uid || 'mock'}`);
      setIsLoading(true);
      const response = await apiCall(
        () => bummService.getBummList({ limit: 50 }),
        () => mockApiClient.getBumms({ limit: 50 }),
        'load projects'
      );
      
      const formattedProjects: Project[] = response.bumms.map((bumm: BummProject) => ({
        uid: bumm.uid,
        name: bumm.name,
        status: bumm.status as Project['status'],
        created_at: bumm.created_at,
        updated_at: bumm.updated_at,
        task: bumm.task,
        description: bumm.name || 'Untitled Project',
        isDeployed: bumm.status === 'deployed',
        isFrozen: false, // API field will be added
      }));

      console.log(`Loaded ${formattedProjects.length} projects:`, formattedProjects);
      setProjects(formattedProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  // Smart contract generation
  const generateContract = async (description: string): Promise<Project> => {
    try {
      console.log(`Starting contract generation: "${description}"`);
      console.log(`Current environment: ${process.env.NODE_ENV}`);
      console.log(`Use Mock API: ${useMockApi}`);
      console.log(`Current user:`, user);
      setIsLoading(true);
      setError(null);

      // Check if we need to use Mock API
      let response;
      if (useMockApi) {
        console.log(`Using Mock API for generation (already in Mock mode)`);
        response = await mockApiClient.generateContract({ text: description });
        console.log(`Mock API generation successful:`, response);
      } else {
        // Force use real API for generation
        try {
          console.log(`Attempting real API generation...`);
        response = await bummService.generateBumm(description);
          console.log(`Real API generation successful:`, response);
      } catch (err) {
          console.error(`Real API generation failed:`, err);
          console.error(`Error details:`, {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            name: err instanceof Error ? err.name : undefined
          });
          
          // Check if we need to switch to Mock API
        if (shouldFallbackToMock(err, 'generate contract')) {
            console.warn(`Falling back to Mock API for generation`);
          fallbackToMock();
          response = await mockApiClient.generateContract({ text: description });
            console.log(`Mock API generation successful:`, response);
        } else {
            // If not critical error, re-throw it
          throw err;
          }
        }
      }

      const newProject: Project = {
        uid: response.uid,
        name: null,
        status: 'in-progress', // Generation in progress
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: 'generate',
        bummUid: response.uid, // Store backend bumm UID for status polling
        description,
        isDeployed: false,
        isFrozen: false,
      };

      console.log(`Contract generation started - created project: ${newProject.uid}, bummUid: ${newProject.bummUid}`);
      
      // If contract code was returned, save it to localStorage
      if (response.code) {
        console.log(`Saving contract code to localStorage`);
        if (typeof window !== 'undefined') {
          try {
        localStorage.setItem(`bumm_contract_code_${newProject.uid}`, response.code);
          } catch (err) {
            console.warn('localStorage not available:', err);
          }
        }
      } else {
        console.log(`No contract code returned from backend. Status: ${response.status}`);
      }
      
      console.log(`Adding project to list:`, newProject);
      console.log(`Current projects before update:`, projects);
      setProjects(prev => {
        const updated = [newProject, ...prev];
        console.log(`Updated projects list:`, updated);
        console.log(`Projects count: ${updated.length}`);
        return updated;
      });
      
      // Check that project was actually added
      setTimeout(() => {
        console.log(`Projects after timeout:`, projects);
      }, 100);
      
      return newProject;
    } catch (err) {
      console.error('Failed to generate contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Contract generation in existing project
  // Returns the backend bumm UID for status polling
  const generateInProject = async (projectUid: string, description: string): Promise<string> => {
    try {
      console.log(`Starting contract generation in existing project: ${projectUid}`);
      console.log(`📝 Description: ${description}`);
      setIsLoading(true);
      setError(null);

      // Force use real API for generation
      let response;
      try {
        console.log(`Attempting real API generation in project...`);
        response = await bummService.generateBumm(description);
        console.log(`Real API generation in project successful:`, response);
      } catch (err) {
        console.error(`Real API generation in project failed:`, err);
        
        // Check if we need to switch to Mock API
        if (shouldFallbackToMock(err, 'generate contract in project')) {
          console.warn(`Falling back to Mock API for project generation`);
          fallbackToMock();
          response = await mockApiClient.generateContract({ text: description });
        } else {
          // If not critical error, re-throw it
          throw err;
        }
      }

      const bummUid = response.uid;
      console.log(`Backend returned bummUid: ${bummUid} for project: ${projectUid}`);

      // If contract code was returned, save it to localStorage
      if (response.code) {
        console.log(`💾 Saving contract code to localStorage for project: ${projectUid}`);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`bumm_contract_code_${projectUid}`, response.code);
          } catch (err) {
            console.warn('localStorage not available:', err);
          }
        }
      } else {
        console.log(`No contract code returned from backend for project ${projectUid}. Status: ${response.status}`);
      }

      // Update existing project with bummUid for status polling
      setProjects(prev => prev.map(project => 
        project.uid === projectUid 
          ? {
              ...project,
              status: 'in-progress',
              task: 'generate',
              bummUid, // Store backend bumm UID for polling
              description,
              updated_at: new Date().toISOString()
            }
          : project
      ));

      console.log(`Contract generation started in project: ${projectUid}, bummUid: ${bummUid}`);
      return bummUid; // Return backend bumm UID for status tracking
    } catch (err) {
      console.error('Failed to generate contract in project:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Contract audit
  const auditContract = async (code: string, projectUid?: string): Promise<Project> => {
    if (!user) {
      throw new Error('User not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiCall(
        () => bummService.auditBumm(code),
        () => mockApiClient.auditContract({ text: code }),
        'audit contract'
      );

      const bummUid = response.uid;
      console.log(`Audit started, bummUid: ${bummUid}`);

      if (projectUid) {
        // Update existing project with backend bummUid
        const updatedProject = projects.find(p => p.uid === projectUid);
        if (updatedProject) {
          const updated: Project = {
            ...updatedProject,
            status: 'in-progress' as const,
            task: 'audit' as const,
            bummUid,
            code,
            updated_at: new Date().toISOString()
          };
          setProjects(prev => prev.map(p => p.uid === projectUid ? updated : p));
          return updated;
        }
      }

      const newProject: Project = {
        uid: response.uid,
        name: null,
        status: 'in-progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: 'audit',
        bummUid,
        description: 'Code Audit',
        code,
        isDeployed: false,
        isFrozen: false,
      };

      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      console.error('Failed to audit contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to audit contract');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Contract build (updates existing project)
  const buildContract = async (code: string, projectUid?: string): Promise<Project> => {
    if (!user) {
      throw new Error('User not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      // We must always send backend bummUid to /build/ (not raw code)
      let bummUidForBuild: string | undefined;

      // Prefer explicitly selected project
      if (projectUid) {
        const proj = projects.find(p => p.uid === projectUid);
        if (proj?.bummUid) {
          bummUidForBuild = proj.bummUid;
        }
      }

      // Fallback: try to find project by code with existing bummUid
      if (!bummUidForBuild) {
        const projWithCode = projects.find(p => p.code === code && p.bummUid);
        if (projWithCode?.bummUid) {
          bummUidForBuild = projWithCode.bummUid;
        }
      }

      if (!bummUidForBuild) {
        throw new Error('Cannot start build: backend project ID not found. Please generate the contract first.');
      }

      const response = await apiCall(
        () => bummService.buildBumm(bummUidForBuild!),
        () => mockApiClient.buildContract({ text: code }),
        'build contract'
      );

      const bummUid = response.uid;
      console.log(`Build started, bummUid: ${bummUid}`);

      if (projectUid) {
        // Update existing project with backend bummUid
        const updatedProject = projects.find(p => p.uid === projectUid);
        if (updatedProject) {
          const updated: Project = {
            ...updatedProject,
            status: 'in-progress' as const,
            task: 'build' as const,
            bummUid, // Store backend bumm UID for polling
            code,
            updated_at: new Date().toISOString()
          };
          
          setProjects(prev => prev.map(p => p.uid === projectUid ? updated : p));
          return updated;
        }
      }

      // Create new project only if existing one not found
      const newProject: Project = {
        uid: response.uid,
        name: null,
        status: 'in-progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: 'build',
        bummUid, // Store backend bumm UID for polling
        description: 'Contract Build',
        code,
        isDeployed: false,
        isFrozen: false,
      };

      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      console.error('Failed to build contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to build contract');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Contract deployment
  const deployContract = async (code: string): Promise<string> => {
    if (!user) {
      throw new Error('User not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Deploy endpoint also expects backend bummUid, not raw code
      let bummUidForDeploy: string | undefined;

      // Prefer project that matches code and already has bummUid
      const projWithCode = projects.find(p => p.code === code && p.bummUid);
      if (projWithCode?.bummUid) {
        bummUidForDeploy = projWithCode.bummUid;
      }

      if (!bummUidForDeploy) {
        throw new Error('Cannot deploy: backend project ID not found. Please build the contract first.');
      }

      const contractAddress = await apiCall(
        () => bummService.deployBumm(bummUidForDeploy!),
        () => mockApiClient.deployContract({ text: code }),
        'deploy contract'
      );
      
      return contractAddress;
    } catch (err) {
      console.error('Failed to deploy contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to deploy contract');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const sendChatMessage = useCallback(
    async (message: string, bummUid?: string | null) => {
      try {
        const response = await apiCall(
          () => chatService.sendMessage(message, bummUid),
          () => mockChatMessage(message),
          'chat message'
        );
        return response;
      } catch (err) {
        console.error('Chat message failed:', err);
        return {
          reply: 'Sorry, something went wrong. Please try again.',
          action: 'none',
          bumm_uid: null,
          status: null,
          message_uid: null,
        };
      }
    },
    [apiCall]
  );

  const loadChatHistory = useCallback(
    async (bummUid?: string) => {
      try {
        const response = await apiCall(
          () => chatService.getHistory(bummUid, 50),
          async () => ({ messages: [], bumm_uid: null }),
          'load chat history'
        );
        return response;
      } catch (err) {
        console.error('Failed to load chat history:', err);
        return { messages: [], bumm_uid: null };
      }
    },
    [apiCall]
  );

  // Task status tracking
  // bummUid: the actual backend bumm UID to use for API polling (may differ from projectUid)
  const trackTaskStatus = useCallback(async (
    projectUid: string, 
    taskType: 'generate' | 'audit' | 'build',
    onProgress?: (progress: GenerationProgress) => void,
    onComplete?: (result: unknown) => void,
    onError?: (error: string) => void,
    bummUid?: string // Backend bumm UID for API polling (defaults to projectUid)
  ) => {
    const apiUid = bummUid || projectUid; // Use bummUid for API calls, projectUid for state updates
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 60; // 5 minutes maximum
    let attempts = 0;
    let lastStatus = '';

    console.log(`🔄 Starting status tracking for ${taskType}: projectUid=${projectUid}, apiUid(bummUid)=${apiUid}`);

    // Add small delay before starting tracking
    // to give time for task to be created on server
    const initialDelay = 3000; // 3 seconds
    console.log(`⏳ Waiting ${initialDelay}ms before starting status tracking for ${taskType}...`);
    
    setTimeout(() => {
      pollStatus();
    }, initialDelay);

    const pollStatus = async (): Promise<void> => {
      try {
        let statusResponse;
        
        // Force use real API for status tracking - use apiUid (backend bumm UID)
        try {
          switch (taskType) {
            case 'generate':
              statusResponse = await bummService.getGenerationStatus(apiUid);
              break;
            case 'audit':
              statusResponse = await bummService.getAuditStatus(apiUid);
              break;
            case 'build':
              statusResponse = await bummService.getBuildStatus(apiUid);
              break;
          }
          console.log(`Real API status check successful for ${taskType} (apiUid=${apiUid}):`, statusResponse);
        } catch (err) {
          console.error(`Real API status check failed for ${taskType} (apiUid=${apiUid}):`, err);
          
          // Only for critical errors switch to Mock API
          if (shouldFallbackToMock(err, `get ${taskType} status`)) {
            console.warn(`Falling back to Mock API for status tracking`);
            fallbackToMock();
        
            switch (taskType) {
              case 'generate':
                statusResponse = await mockApiClient.getGenerateStatus(apiUid);
                break;
              case 'audit':
                statusResponse = await mockApiClient.getAuditStatus(apiUid);
                break;
              case 'build':
                statusResponse = await mockApiClient.getBuildStatus(apiUid);
                break;
            }
          } else {
            // If not critical error, re-throw it
            throw err;
          }
        }

        if (statusResponse) {
          const status = statusResponse.status;
          
          // Log status changes
          if (status !== lastStatus) {
            console.log(`📊 Status changed for ${taskType}: ${lastStatus || '(none)'} → ${status}`);
            lastStatus = status;
          }
          
          // Update project in list (use projectUid for state updates)
          setProjects(prev => prev.map(project => 
            project.uid === projectUid 
              ? { ...project, status: status as Project['status'], updated_at: new Date().toISOString() }
              : project
          ));

          // Check for error
          if (isTaskError(status)) {
            console.error(`Task ${taskType} failed with status: ${status}`);
            onError?.(`Task failed with status: ${getStatusDisplayName(status)}`);
            return;
          }

          // Send progress
          const progress = getProgressFromStatus(status);
          onProgress?.(progress);

          // Check for completion
          if (isTaskCompleted(status, taskType)) {
            console.log(`✅ Task ${taskType} completed with status: ${status}`);
            onComplete?.(statusResponse);
            return;
          }
          
          // If status remains 'new' too long, this might indicate backend problem
          if (status === 'new' && attempts > 10) {
            console.warn(`Task ${taskType} has been in 'new' status for ${attempts} attempts. This might indicate a backend issue.`);
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Polling ${taskType} status... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(pollStatus, pollInterval);
        } else {
          console.error(`Task ${taskType} timeout after ${maxAttempts} attempts`);
          onError?.('Task timeout - maximum attempts reached');
        }
      } catch (err) {
        console.error(`Error polling ${taskType} status:`, err);
        
        // If this is 404 error, task is not created yet
        if (err instanceof Error && err.message.includes('Not Found')) {
          console.log(`Task ${taskType} (apiUid=${apiUid}) not found yet, retrying... (attempt ${attempts + 1}/${maxAttempts})`);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(pollStatus, pollInterval);
          } else {
            console.warn(`Task ${taskType} (apiUid=${apiUid}) not found after ${maxAttempts} attempts`);
            onError?.('Task not found after maximum attempts');
          }
          return;
        }
        
        // For other errors also try to retry several times
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Retrying ${taskType} status check after error... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(pollStatus, pollInterval);
        } else {
          console.error(`Task ${taskType} failed after ${maxAttempts} attempts due to errors`);
          onError?.(err instanceof Error ? err.message : 'Failed to poll status');
        }
      }
    };

    pollStatus();
  }, [shouldFallbackToMock, fallbackToMock]);

  // Get progress from status
  const getProgressFromStatus = (status: string): GenerationProgress => {
    const statusMap: Record<string, GenerationProgress> = {
      // Generate statuses
      'new': { stage: 'initializing', progress: 10, message: 'Initializing...' },
      'initializing': { stage: 'initializing', progress: 30, message: 'Setting up environment...' },
      'generating': { stage: 'generating', progress: 60, message: 'Generating smart contract...' },
      'generated': { stage: 'completed', progress: 100, message: 'Contract generated successfully!' },
      'testing': { stage: 'testing', progress: 80, message: 'Running tests...' },
      'tested': { stage: 'deploying', progress: 90, message: 'Preparing for deployment...' },
      'deploying': { stage: 'deploying', progress: 95, message: 'Deploying to network...' },
      'deployed': { stage: 'completed', progress: 100, message: 'Contract deployed successfully!' },
      'error': { stage: 'error', progress: 0, message: 'Generation failed' },
      
      // Audit statuses
      'auditing': { stage: 'generating', progress: 50, message: 'Analyzing code...' },
      'audited': { stage: 'completed', progress: 100, message: 'Audit completed!' },
      
      // Build statuses
      'building': { stage: 'generating', progress: 50, message: 'Building contract...' },
      'built': { stage: 'completed', progress: 100, message: 'Build completed!' },
    };

    return statusMap[status] || { stage: 'initializing', progress: 0, message: 'Processing...' };
  };

  const createProject = useCallback(async (projectName: string) => {
    if (!user?.uid) {
      throw new Error('User must be initialized to create project');
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🆕 Creating new project: ${projectName}`);
      
      const newProject: Project = {
        uid: `project_${Date.now()}`,
        name: projectName,
        description: `New smart contract project`,
        status: 'draft' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: null,
        isDeployed: false,
        isFrozen: false
      };

      // In real application this will be API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProjects(prevProjects => [newProject, ...prevProjects]);
      
      console.log(`Project created:`, newProject);
      return newProject;
    } catch (err) {
      console.error(`Failed to create project:`, err);
      setError('Failed to create project');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateProjects = useCallback((updater: (projects: Project[]) => Project[]) => {
    setProjects(updater);
  }, []);

  return {
    user,
    projects,
    isLoading,
    error,
    generateContract,
    generateInProject,
    auditContract,
    buildContract,
    deployContract,
    trackTaskStatus,
    loadProjects,
    initializeUser,
    createProject,
    updateProjects,
    sendChatMessage,
    loadChatHistory,
    useMockApi, // Export for debugging
  };
};
