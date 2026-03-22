import { apiClient } from './api';
import { API_ENDPOINTS } from '@/config/api';
import type {
  BummProject,
  BummListResponse,
  BummListRequest,
  BummGenerateRequest,
  BummGenerateResponse,
  BummStatusResponse,
  CreateWalletRequest,
  CreateWalletResponse,
} from '@/lib/api';

// Service for working with Bumm API
export const bummService = {
  // Check API health
  async checkHealth(): Promise<Record<string, string>> {
    try {
      console.log('Checking API health...');
      return await apiClient.healthCheck();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  },

  // Get list of Bumms
  async getBummList(params: BummListRequest = {}): Promise<BummListResponse> {
    try {
      console.log('Fetching Bumm list...', params);
      return await apiClient.getBumms(params);
    } catch (error) {
      console.error('❌ Failed to fetch Bumm list:', error);
      throw error;
    }
  },

  // Generate new Bumm
  async generateBumm(text: string): Promise<BummGenerateResponse> {
    try {
      console.log('Generating Bumm...', { text });
      const request: BummGenerateRequest = { text };
      return await apiClient.generateContract(request);
    } catch (error) {
      console.error('❌ Failed to generate Bumm:', error);
      throw error;
    }
  },

  // Check generation status
  async getGenerationStatus(bummUid: string): Promise<BummStatusResponse> {
    try {
      console.log('Getting generation status...', { bummUid });
      return await apiClient.getGenerateStatus(bummUid);
    } catch (error) {
      console.error('❌ Failed to get generation status:', error);
      throw error;
    }
  },

  // Audit Bumm
  async auditBumm(text: string): Promise<BummGenerateResponse> {
    try {
      console.log('Auditing Bumm...', { text });
      const request: BummGenerateRequest = { text };
      return await apiClient.auditContract(request);
    } catch (error) {
      console.error('❌ Failed to audit Bumm:', error);
      throw error;
    }
  },

  // Audit status
  async getAuditStatus(bummUid: string): Promise<BummStatusResponse> {
    try {
      console.log('Getting audit status...', { bummUid });
      return await apiClient.getAuditStatus(bummUid);
    } catch (error) {
      console.error('❌ Failed to get audit status:', error);
      throw error;
    }
  },

  // Build Bumm
  async buildBumm(text: string): Promise<BummGenerateResponse> {
    try {
      console.log('Building Bumm...', { text });
      const request: BummGenerateRequest = { text };
      return await apiClient.buildContract(request);
    } catch (error) {
      console.error('❌ Failed to build Bumm:', error);
      throw error;
    }
  },

  // Build status
  async getBuildStatus(bummUid: string): Promise<BummStatusResponse> {
    try {
      console.log('Getting build status...', { bummUid });
      return await apiClient.getBuildStatus(bummUid);
    } catch (error) {
      console.error('❌ Failed to get build status:', error);
      throw error;
    }
  },

  // Deploy Bumm
  async deployBumm(text: string): Promise<string> {
    try {
      console.log('Deploying Bumm...', { text });
      const request: BummGenerateRequest = { text };
      return await apiClient.deployContract(request);
    } catch (error) {
      console.error('❌ Failed to deploy Bumm:', error);
      throw error;
    }
  },

  // Deploy status
  async getDeployStatus(bummUid: string): Promise<string> {
    try {
      console.log('Getting deploy status...', { bummUid });
      return await apiClient.getDeployStatus(bummUid);
    } catch (error) {
      console.error('❌ Failed to get deploy status:', error);
      throw error;
    }
  },

  // Polling статуса с коллбэками
  async pollTaskStatus<T>(
    taskType: 'generate' | 'audit' | 'build' | 'deploy',
    bummUid: string,
    onProgress?: (status: string) => void,
    onComplete?: (result: T) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      console.log(`🔄 Starting polling for ${taskType} task...`, { bummUid });
      await apiClient.pollTaskStatus(taskType, bummUid, onProgress, onComplete, onError);
    } catch (error) {
      console.error(`❌ Failed to poll ${taskType} status:`, error);
      onError?.(error instanceof Error ? error.message : 'Failed to poll status');
    }
  },
};

// Service for working with users
export const userService = {
  // Create wallet
  async createWallet(wallet: string): Promise<CreateWalletResponse> {
    try {
      console.log('👛 Creating wallet...', { wallet });
      const request: CreateWalletRequest = { wallet };
      return await apiClient.createWallet(request);
    } catch (error) {
      console.error('❌ Failed to create wallet:', error);
      throw error;
    }
  },

  // Set user ID for all requests
  setUserId(userId: string): void {
    console.log('👤 Setting user ID:', userId);
    apiClient.setUserId(userId);
  },
};

// Utilities for working with API
export const apiUtils = {
  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      const health = await bummService.checkHealth();
      console.log('✅ API connection successful:', health);
      return true;
    } catch (error) {
      console.error('❌ API connection failed:', error);
      return false;
    }
  },

  // Get full URL for endpoint
  getEndpointUrl(endpoint: string): string {
    return `${apiClient['baseURL']}${endpoint}`;
  },

  // Format API errors
  formatApiError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown API error occurred';
  },
};

 // Add chatService
export const chatService = {
  async sendMessage(message: string, bummUid?: string | null) {
    return apiClient.chatMessage(message, bummUid);
  },

  async getHistory(bummUid?: string, limit?: number) {
    return apiClient.getChatHistory(bummUid, limit);
  },
};

// Export types for use in other files
export type {
  BummProject,
  BummListResponse,
  BummListRequest,
  BummGenerateRequest,
  BummGenerateResponse,
  BummStatusResponse,
  CreateWalletRequest,
  CreateWalletResponse,
};
