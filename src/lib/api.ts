// API client for interacting with Bumm backend
// Import configuration from new file
import { API_BASE_URL, TASK_STATUS, isTaskCompleted, isTaskError, getStatusDisplayName, getProgressFromStatus } from '@/config/api';
import { apiClient as newApiClient } from '@/services/api';
import { bummService, userService } from '@/services/bummService';

// API data types
export interface BummProject {
  uid: string;
  name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  task: 'generate' | 'audit' | 'deploy' | 'build';
}

export interface BummListResponse {
  bumms: BummProject[];
  created_at: number;
}

export interface BummListRequest {
  limit?: number;
  created_at?: number | null;
}

export interface BummGenerateRequest {
  text: string;
}

export interface BummGenerateResponse {
  uid: string;
  status: string;
  code?: string; // Generated contract code
}

export interface BummStatusResponse {
  uid: string;
  status: string;
  code?: string; // Generated contract code when status is 'generated'
}

export interface CreateWalletRequest {
  wallet: string;
}

export interface CreateWalletResponse {
  uid: string;
}

export interface ApiError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

// Updated class for API work (compatibility with existing code)
export class BummApiClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Set user ID
  setUserId(userId: string) {
    this.userId = userId;
    // Also set in new API client
    newApiClient.setUserId(userId);
  }

  // Delegate methods to new API client
  async healthCheck(): Promise<Record<string, string>> {
    return bummService.checkHealth();
  }

  async getBumms(request: BummListRequest = {}): Promise<BummListResponse> {
    return bummService.getBummList(request);
  }

  async generateContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    return bummService.generateBumm(request.text);
  }

  async auditContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    return bummService.auditBumm(request.text);
  }

  async buildContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    return bummService.buildBumm(request.text);
  }

  async deployContract(request: BummGenerateRequest): Promise<string> {
    return bummService.deployBumm(request.text);
  }

  async getGenerateStatus(bummUid: string): Promise<BummStatusResponse> {
    return bummService.getGenerationStatus(bummUid);
  }

  async getAuditStatus(bummUid: string): Promise<BummStatusResponse> {
    return bummService.getAuditStatus(bummUid);
  }

  async getBuildStatus(bummUid: string): Promise<BummStatusResponse> {
    return bummService.getBuildStatus(bummUid);
  }

  async getDeployStatus(bummUid: string): Promise<string> {
    return bummService.getDeployStatus(bummUid);
  }

  async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    return userService.createWallet(request.wallet);
  }
}

// Create API client instance
export const apiClient = new BummApiClient();

// Export utilities from configuration
export { TASK_STATUS as TaskStatus, isTaskCompleted, isTaskError, getStatusDisplayName, getProgressFromStatus };
