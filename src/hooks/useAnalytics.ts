'use client';

import { useCallback } from 'react';

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

export const useAnalytics = () => {
  const trackEvent = useCallback((
    eventName: string,
    parameters?: Record<string, unknown>
  ) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  }, []);

  const trackPageView = useCallback((pagePath: string, pageTitle?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: pagePath,
        page_title: pageTitle,
      });
    }
  }, []);

  const trackContractGeneration = useCallback((description: string, projectId?: string) => {
    trackEvent('contract_generation', {
      event_category: 'smart_contract',
      event_label: description,
      project_id: projectId,
    });
  }, [trackEvent]);

  const trackContractBuild = useCallback((projectId: string) => {
    trackEvent('contract_build', {
      event_category: 'smart_contract',
      project_id: projectId,
    });
  }, [trackEvent]);

  const trackContractDeploy = useCallback((projectId: string, contractAddress?: string) => {
    trackEvent('contract_deploy', {
      event_category: 'smart_contract',
      project_id: projectId,
      contract_address: contractAddress,
    });
  }, [trackEvent]);

  const trackContractAudit = useCallback((projectId: string) => {
    trackEvent('contract_audit', {
      event_category: 'smart_contract',
      project_id: projectId,
    });
  }, [trackEvent]);

  const trackCreditPurchase = useCallback((amount: number, currency: string = 'USD') => {
    trackEvent('purchase', {
      event_category: 'ecommerce',
      value: amount,
      currency: currency,
    });
  }, [trackEvent]);

  const trackCreditSpend = useCallback((operation: string, credits: number, projectId?: string) => {
    trackEvent('credit_spend', {
      event_category: 'credits',
      event_label: operation,
      value: credits,
      project_id: projectId,
    });
  }, [trackEvent]);

  const trackWalletConnect = useCallback((walletType: string) => {
    trackEvent('wallet_connect', {
      event_category: 'wallet',
      event_label: walletType,
    });
  }, [trackEvent]);

  const trackProjectCreate = useCallback((projectName: string) => {
    trackEvent('project_create', {
      event_category: 'project',
      event_label: projectName,
    });
  }, [trackEvent]);

  const trackProjectDelete = useCallback((projectId: string) => {
    trackEvent('project_delete', {
      event_category: 'project',
      project_id: projectId,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackContractGeneration,
    trackContractBuild,
    trackContractDeploy,
    trackContractAudit,
    trackCreditPurchase,
    trackCreditSpend,
    trackWalletConnect,
    trackProjectCreate,
    trackProjectDelete,
  };
};
