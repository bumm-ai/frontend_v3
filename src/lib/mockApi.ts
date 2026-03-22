// Mock API for frontend testing
// Used when backend is unavailable

import { 
  BummProject, 
  BummListRequest, 
  BummListResponse, 
  BummGenerateRequest, 
  BummGenerateResponse,
  CreateWalletRequest,
  CreateWalletResponse,
  BummStatusResponse
} from './api';

export class MockApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/mock-api';
    // Log only suppressed - MockApiClient is always imported but only used as fallback
  }

  // Health Check
  async healthCheck(): Promise<Record<string, string>> {
    console.log(`Mock Health Check`);
    return { status: 'ok', message: 'Mock API is working' };
  }

  // Get projects list
  async getBumms(request: BummListRequest = {}): Promise<BummListResponse> {
    console.log(`Mock Get Bumms:`, request);
    
    // For new users return empty list
    // This will allow automatic creation of first project
    const mockProjects: BummProject[] = [];

    return {
      bumms: mockProjects,
      created_at: Date.now()
    };
  }

  // Smart contract generation
  async generateContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Mock Generate Contract:`, request);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return 'in-progress' status to match real API
    return {
      uid: `mock-generated-${Date.now()}`,
      status: 'in-progress' // Generation in progress status
    };
  }

  // Code audit
  async auditContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Mock Audit Contract:`, request);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      uid: `mock-audited-${Date.now()}`,
      status: 'new'
    };
  }

  // Project build
  async buildContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Mock Build Contract:`, request);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      uid: `mock-built-${Date.now()}`,
      status: 'new'
    };
  }

  // Project deployment
  async deployContract(request: BummGenerateRequest): Promise<string> {
    console.log(`Mock Deploy Contract:`, request);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return `mock-deployed-${Date.now()}`;
  }

  // Get generation status
  async getGenerateStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Mock Get Generate Status:`, bummUid);
    
    // Simulate generation progress with delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Always return 'new' status for Mock API
    return {
      uid: bummUid,
      status: 'new'
    };
  }

  // Get audit status
  async getAuditStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Mock Get Audit Status:`, bummUid);
    
    // Always return audited status for successful completion
    return {
      uid: bummUid,
      status: 'audited'
    };
  }

  // Get build status
  async getBuildStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Mock Get Build Status:`, bummUid);
    
    // Always return built status for successful completion
    return {
      uid: bummUid,
      status: 'built'
    };
  }

  // Get deploy status
  async getDeployStatus(bummUid: string): Promise<string> {
    console.log(`Mock Get Deploy Status:`, bummUid);
    
    const statuses = ['new', 'deploying', 'deployed', 'error'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return randomStatus;
  }

  // Create wallet
  async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    console.log(`👛 Mock Create Wallet:`, request);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      uid: `mock-user-${Date.now()}`
    };
  }

}

// Create mock API client instance
export const mockApiClient = new MockApiClient();
