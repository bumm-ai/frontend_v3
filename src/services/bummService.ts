/**
 * Compatibility stub — Dashboard.tsx imports bummService/userService but doesn't
 * call any methods. New code should use apiClient from services/api.ts directly.
 */

import { apiClient } from './api';

export const bummService = {
  async checkHealth() {
    return apiClient.healthCheck();
  },
};

export const userService = {
  async createWallet(_wallet: string): Promise<{ uid: string }> {
    throw new Error('createWallet is no longer supported. Use JWT auth.');
  },
};

export const chatService = {
  async sendMessage(_uid: string, _message: string): Promise<void> {
    throw new Error('chatService is no longer supported.');
  },
};

export const apiUtils = {};
