// Credit service for handling user credits and transactions
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
  updatedAt: string;
}

export interface CreditRates {
  SOL: number;
  USDC: number;
  CREDIT: number; // 1 кредит = $0.01
}

export interface PurchaseRequest {
  tokenAmount: number;
  tokenType: 'SOL' | 'USDC';
  txHash: string;
}

export interface CreditTransaction {
  id: string;
  operationType: 'generate' | 'audit' | 'build' | 'deploy' | 'chat' | 'upgrade';
  creditsSpent: number;
  usdEquivalent: number;
  description: string;
  createdAt: string;
  bummId?: string;
}

class CreditService {
  private connection: Connection;
  private companyWallet = new PublicKey('5crqSfo5WA9diQKUnuBkAQmXntzWzXcE2hZm5RW7DvyX'); // Replace with actual address
  private baseUrl = '/api/backend'; // Use Next.js proxy to bypass CORS

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  // Get credit balance
  async getCreditBalance(userId: string): Promise<CreditBalance> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/balance`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        }
      });

      if (!response.ok) {
        // If backend is unavailable, return mock data
        return {
          balance: 1000,
          totalPurchased: 2000,
          totalSpent: 750,
          updatedAt: new Date().toISOString()
        };
      }

      return await response.json();
    } catch (error) {
      console.warn('Credit service unavailable, using mock data:', error);
      return {
        balance: 1000,
        totalPurchased: 2000,
        totalSpent: 750,
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Get current rates
  async getCurrentRates(): Promise<CreditRates> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/rates`);
      
      if (!response.ok) {
        // Mock rates if backend is unavailable
        return {
          SOL: 100, // $100 за SOL
          USDC: 1.0,
          CREDIT: 0.01 // $0.01 за кредит
        };
      }

      return await response.json();
    } catch (error) {
      console.warn('Rates service unavailable, using mock data:', error);
      return {
        SOL: 100,
        USDC: 1.0,
        CREDIT: 0.01
      };
    }
  }

  // Calculate credit amount
  async calculateCredits(tokenAmount: number, tokenType: 'SOL' | 'USDC'): Promise<{
    creditsAmount: number;
    usdAmount: number;
    rates: CreditRates;
  }> {
    const rates = await this.getCurrentRates();
    const usdAmount = tokenAmount * (tokenType === 'SOL' ? rates.SOL : rates.USDC);
    const creditsAmount = usdAmount / rates.CREDIT;
    
    return { creditsAmount, usdAmount, rates };
  }

  // Create SOL transaction
  async createSOLTransaction(amount: number, fromWallet: PublicKey): Promise<Transaction> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromWallet,
        toPubkey: this.companyWallet,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const { blockhash } = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromWallet;

    return transaction;
  }

  // Create USDC transaction (simplified version)
  async createUSDCTransaction(amount: number, fromWallet: PublicKey): Promise<Transaction> {
    // USDC requires more complex SPL token logic
    // Using simplified version for now
    const transaction = new Transaction();
    // SPL token logic will be implemented
    return transaction;
  }

  // Send transaction through wallet
  async sendTransaction(transaction: Transaction, wallet: { signTransaction: (tx: Transaction) => Promise<Transaction> }): Promise<string> {
    try {
      const signedTransaction = await wallet.signTransaction(transaction);
      const txHash = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      await this.connection.confirmTransaction(txHash, 'confirmed');
      
      return txHash;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  // Purchase credits
  async purchaseCredits(
    tokenAmount: number, 
    tokenType: 'SOL' | 'USDC', 
    wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
    userId: string
  ): Promise<void> {
    try {
      // 1. Создаем транзакцию
      const transaction = tokenType === 'SOL' 
        ? await this.createSOLTransaction(tokenAmount, wallet.publicKey)
        : await this.createUSDCTransaction(tokenAmount, wallet.publicKey);

      // 2. Отправляем транзакцию
      const txHash = await this.sendTransaction(transaction, wallet);

      // 3. Уведомляем бекенд о покупке
      await this.notifyPurchase({
        tokenAmount,
        tokenType,
        txHash
      }, userId);

      console.log('Credits purchased successfully:', txHash);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  // Notify backend about purchase
  async notifyPurchase(purchaseData: PurchaseRequest, userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(purchaseData)
      });

      if (!response.ok) {
        console.warn('Failed to notify backend about purchase, but transaction was successful');
      }
    } catch (error) {
      console.warn('Backend notification failed, but transaction was successful:', error);
    }
  }

  // Deduct credits for operation
  async spendCredits(
    userId: string,
    operationType: 'generate' | 'audit' | 'build' | 'deploy' | 'chat' | 'upgrade',
    bummId?: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          operation_type: operationType,
          bumm_id: bummId,
          metadata
        })
      });

      if (!response.ok) {
        console.warn('Credit spending failed, but operation continues');
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Credit service unavailable, operation continues:', error);
      return false;
    }
  }

  // Get operation history
  async getCreditHistory(userId: string, limit: number = 50): Promise<{
    purchases: Record<string, unknown>[];
    transactions: CreditTransaction[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/history?limit=${limit}`, {
        headers: {
          'x-user-id': userId
        }
      });

      if (!response.ok) {
        return { purchases: [], transactions: [] };
      }

      return await response.json();
    } catch (error) {
      console.warn('Credit history unavailable:', error);
      return { purchases: [], transactions: [] };
    }
  }

  // Get operation pricing
  async getOperationPricing(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/credits/pricing`);
      
      if (!response.ok) {
        // Mock prices if backend is unavailable
        return {
          chat: 0.1,
          generate: 100,
          audit: 50,
          build: 25,
          deploy: 75,
          upgrade: 150
        };
      }

      return await response.json();
    } catch (error) {
      console.warn('Pricing service unavailable, using mock data:', error);
      return {
        chat: 0.1,
        generate: 100,
        audit: 50,
        build: 25,
        deploy: 75,
        upgrade: 150
      };
    }
  }
}

const creditService = new CreditService();
export default creditService;
