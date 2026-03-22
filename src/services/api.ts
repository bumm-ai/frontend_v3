import { API_BASE_URL, API_ENDPOINTS, API_CONFIG, API_METHODS } from '@/config/api';

// Import types from lib/api.ts
import type {
  BummProject,
  BummListResponse,
  BummListRequest,
  BummGenerateRequest,
  BummGenerateResponse,
  BummStatusResponse,
  CreateWalletRequest,
  CreateWalletResponse,
  ApiError,
} from '@/lib/api';

// HTTP клиент для работы с Bumm API
export class ApiClient {
  private baseURL: string;
  private userId: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Set user ID
  setUserId(userId: string) {
    this.userId = userId;
  }

  // Get headers for requests
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    return headers;
  }

  // Handle API errors
  private async handleResponse<T>(response: Response): Promise<T> {
    console.log(`🔗 API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData: ApiError = await response.json();
          console.error(`❌ API Error (JSON):`, errorData);
          
          // Check if there's useful information in the error
          if (errorData.detail && Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            errorMessage = errorData.detail[0].msg || response.statusText;
            console.log(`📝 Error detail: ${errorMessage}`);
          } else if (Object.keys(errorData).length > 0) {
            // If there are other fields in the error object
            errorMessage = JSON.stringify(errorData) || response.statusText;
            console.log(`📝 Error data: ${errorMessage}`);
          } else {
            // Empty object - use response status
            errorMessage = `${response.status} ${response.statusText}`;
            console.log(`📝 Empty error object, using status: ${errorMessage}`);
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ API Error (Text):`, errorText);
          errorMessage = errorText || response.statusText;
        }
      } catch (parseError) {
        console.error(`❌ Failed to parse error response:`, parseError);
        errorMessage = response.statusText;
      }
      throw new Error(`API Error: ${errorMessage}`);
    }
    
    try {
      const data = await response.json();
      console.log(`✅ API Success:`, data);
      return data;
    } catch (parseError) {
      console.error(`❌ Failed to parse success response:`, parseError);
      throw new Error('Failed to parse API response');
    }
  }

  // Universal method for requests with retry logic
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Automatically determine HTTP method based on endpoint
    const method = options.method || API_METHODS[endpoint as keyof typeof API_METHODS] || 'GET';
    
    const config: RequestInit = {
      ...options,
      method,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      mode: 'cors',
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`🔄 API Request (attempt ${attempt}): ${method} ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return await this.handleResponse<T>(response);
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`API Request failed (attempt ${attempt}/${API_CONFIG.RETRY_ATTEMPTS}):`, error);
        
        if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * attempt));
        }
      }
    }
    
    throw lastError || new Error('API request failed after all retry attempts');
  }

  // GET методы
  async get<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request<T>(url, {
      method: 'GET',
    });
  }

  // POST методы
  async post<T>(endpoint: string, data: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT методы
  async put<T>(endpoint: string, data: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE методы
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Health Check
  async healthCheck(): Promise<Record<string, string>> {
    console.log(`Health Check: ${this.baseURL}${API_ENDPOINTS.HEALTH}`);
    return this.get<Record<string, string>>(API_ENDPOINTS.HEALTH);
  }

  // Get projects list
  async getBumms(request: BummListRequest = {}): Promise<BummListResponse> {
    console.log(`Get Bumms:`, { request, headers: this.getHeaders() });
    return this.get<BummListResponse>(API_ENDPOINTS.BUMM_LIST, request as Record<string, unknown>);
  }

  // Smart contract generation
  async generateContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Generate Contract:`, { request, headers: this.getHeaders() });
    return this.post<BummGenerateResponse>(API_ENDPOINTS.BUMM_GENERATE, request as unknown as Record<string, unknown>);
  }

  // Code audit
  async auditContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Audit Contract:`, { request, headers: this.getHeaders() });
    return this.post<BummGenerateResponse>(API_ENDPOINTS.BUMM_AUDIT, request as unknown as Record<string, unknown>);
  }

  // Project build
  async buildContract(request: BummGenerateRequest): Promise<BummGenerateResponse> {
    console.log(`Build Contract:`, { request, headers: this.getHeaders() });
    return this.post<BummGenerateResponse>(API_ENDPOINTS.BUMM_BUILD, request as unknown as Record<string, unknown>);
  }

  // Project deployment
  async deployContract(request: BummGenerateRequest): Promise<string> {
    console.log(`Deploy Contract:`, { request, headers: this.getHeaders() });
    return this.post<string>(API_ENDPOINTS.BUMM_DEPLOY, request as unknown as Record<string, unknown>);
  }

  // Get generation status
  async getGenerateStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Get Generate Status: ${bummUid}`);
    return this.get<BummStatusResponse>(`${API_ENDPOINTS.BUMM_STATUS_GENERATE}${bummUid}/`);
  }

  // Get audit status
  async getAuditStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Get Audit Status: ${bummUid}`);
    return this.get<BummStatusResponse>(`${API_ENDPOINTS.BUMM_AUDIT_STATUS}${bummUid}/`);
  }

  // Get build status
  async getBuildStatus(bummUid: string): Promise<BummStatusResponse> {
    console.log(`Get Build Status: ${bummUid}`);
    return this.get<BummStatusResponse>(`${API_ENDPOINTS.BUMM_BUILD_STATUS}${bummUid}/`);
  }

  // Get deploy status
  async getDeployStatus(bummUid: string): Promise<string> {
    console.log(`Get Deploy Status: ${bummUid}`);
    return this.get<string>(`${API_ENDPOINTS.BUMM_DEPLOY_STATUS}${bummUid}/`);
  }

  // Create wallet
  async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    console.log(`👛 Create Wallet:`, { request, headers: this.getHeaders() });
    return this.post<CreateWalletResponse>(API_ENDPOINTS.USER_WALLET, request as unknown as Record<string, unknown>);
  }

  // Chat AI message
  async chatMessage(
    message: string,
    bummUid?: string | null
  ): Promise<{
    reply: string;
    action: string;
    bumm_uid: string | null;
    status: string | null;
    message_uid: string | null;
  }> {
    return this.post(API_ENDPOINTS.CHAT_MESSAGE, {
      message,
      bumm_uid: bummUid || null,
    });
  }

  // Get chat history
  async getChatHistory(
    bummUid?: string,
    limit?: number
  ): Promise<{
    messages: Array<{
      uid: string;
      role: string;
      content: string;
      created_at: string;
      bumm_uid: string | null;
      action: string | null;
    }>;
    bumm_uid: string | null;
  }> {
    const params: Record<string, unknown> = {};
    if (bummUid) params.bumm_uid = bummUid;
    if (limit) params.limit = limit;
    return this.get(API_ENDPOINTS.CHAT_HISTORY, params);
  }

  // Polling статуса задачи
  async pollTaskStatus<T>(
    taskType: 'generate' | 'audit' | 'build' | 'deploy',
    bummUid: string,
    onProgress?: (status: string) => void,
    onComplete?: (result: T) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = API_CONFIG.MAX_POLL_ATTEMPTS;

    const pollStatus = async (): Promise<void> => {
      try {
        let statusResponse: BummStatusResponse | string;
        
        switch (taskType) {
          case 'generate':
            statusResponse = await this.getGenerateStatus(bummUid);
            break;
          case 'audit':
            statusResponse = await this.getAuditStatus(bummUid);
            break;
          case 'build':
            statusResponse = await this.getBuildStatus(bummUid);
            break;
          case 'deploy':
            statusResponse = await this.getDeployStatus(bummUid);
            break;
        }

        const status = typeof statusResponse === 'string' ? statusResponse : statusResponse.status;
        
        // Send progress
        onProgress?.(status);

        // Check for error
        if (status.includes('error') || status === 'failed') {
          onError?.(`Task failed with status: ${status}`);
          return;
        }

        // Check for completion
        if (status === 'completed' || status === 'generated' || status === 'audited' || status === 'built' || status === 'deployed') {
          onComplete?.(statusResponse as T);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollStatus, API_CONFIG.POLL_INTERVAL);
        } else {
          onError?.('Task timeout - maximum attempts reached');
        }
      } catch (err) {
        console.error('Error polling status:', err);
        onError?.(err instanceof Error ? err.message : 'Failed to poll status');
      }
    };

    pollStatus();
  }
}

// Create API client instance
export const apiClient = new ApiClient();

// Export types for use in other files
export type {
  BummListResponse,
  BummListRequest,
  BummGenerateRequest,
  BummGenerateResponse,
  BummStatusResponse,
  CreateWalletRequest,
  CreateWalletResponse,
  ApiError,
};
