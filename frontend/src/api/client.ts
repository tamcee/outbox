import axios from 'axios';
import {
  User,
  SenderAccount,
  EmailItem,
  EmailStats,
  PaginatedResponse,
  SchedulePayload,
} from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
});

export const authApi = {
  async getMe(): Promise<User> {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  async getGoogleAuthUrl(): Promise<string> {
    const res = await api.get<{ url: string }>('/auth/google');
    return res.data.url;
  },

  async devLogin(email?: string, name?: string): Promise<{ user: User; token: string }> {
    const res = await api.post<{ user: User; token: string }>('/auth/dev-login', {
      email,
      name,
    });
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};

export const emailApi = {
  async schedule(payload: SchedulePayload): Promise<any> {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },

  async getScheduled(page: number = 1, limit: number = 20): Promise<PaginatedResponse<EmailItem>> {
    const res = await api.get<PaginatedResponse<EmailItem>>('/emails/scheduled', {
      params: { page, limit },
    });
    return res.data;
  },

  async getSent(page: number = 1, limit: number = 20): Promise<PaginatedResponse<EmailItem>> {
    const res = await api.get<PaginatedResponse<EmailItem>>('/emails/sent', {
      params: { page, limit },
    });
    return res.data;
  },

  async getStats(): Promise<EmailStats> {
    const res = await api.get<EmailStats>('/emails/stats');
    return res.data;
  },

  async getById(id: string): Promise<EmailItem> {
    const res = await api.get<EmailItem>(`/emails/${id}`);
    return res.data;
  },

  async search(query: string, status?: string, page: number = 1): Promise<PaginatedResponse<EmailItem>> {
    const res = await api.get<PaginatedResponse<EmailItem>>('/emails/search', {
      params: { q: query, status, page },
    });
    return res.data;
  },
};

export const senderApi = {
  async getSenders(): Promise<SenderAccount[]> {
    const res = await api.get<SenderAccount[]>('/senders');
    return res.data;
  },
};

export const slackApi = {
  async getConnectUrl(): Promise<string> {
    const res = await api.get<{ url: string }>('/slack/connect');
    return res.data.url;
  },

  async disconnect(): Promise<void> {
    await api.post('/slack/disconnect');
  },

  async testNotification(): Promise<void> {
    await api.post('/slack/test');
  },
};

