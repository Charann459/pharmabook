'use client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const initApiClient = async (getToken?: () => string | null) => {
  const { configureClient } = await import('../../shared/src/api/client');
  configureClient(API_URL, getToken);
};

export { API_URL };