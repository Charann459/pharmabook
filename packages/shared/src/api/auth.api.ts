import { apiRequest } from './client';
import type { AuthPayload, User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: (token: string) =>
    apiRequest<User & { shop_name: string; gst_no: string }>('/api/auth/me', {
      token,
    }),

  logout: (token: string) =>
    apiRequest<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      token,
    }),

  refresh: (token: string) =>
    apiRequest<{ token: string }>('/api/auth/refresh', {
      method: 'POST',
      body: { token },
    }),
};
