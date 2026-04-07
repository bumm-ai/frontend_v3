'use client';

/**
 * Fetch pipeline status with Bearer auth; on 401 attempts refresh once so
 * long-running modals (build / audit / deploy) survive access_token TTL (~15m).
 */

import { API_BASE_URL, ENDPOINTS } from '@/config/api';
import { tryRefresh } from '@/services/authService';

function authHeaders(): HeadersInit {
  const t = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export async function fetchContractStatusAuthorized(bummUid: string): Promise<Response> {
  const url = `${API_BASE_URL}${ENDPOINTS.CONTRACT_STATUS(bummUid)}`;
  let res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401 && typeof window !== 'undefined') {
    const ok = await tryRefresh();
    if (ok) res = await fetch(url, { headers: authHeaders() });
  }
  return res;
}
