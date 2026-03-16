'use client';

import { configureClient } from '../../../shared/src/api/client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const initApiClient = (getToken?: () => string | null) => {
  configureClient(API_URL, getToken);
};

export { API_URL };
