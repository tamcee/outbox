export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  slackWebhookUrl?: string | null;
  slackChannel?: string | null;
  slackTeamName?: string | null;
  slackConnected: boolean;
  createdAt: string;
}

export interface SenderAccount {
  id: string;
  email: string;
  host: string;
  port: number;
  currentHourlyCount?: number;
}

export interface EmailItem {
  id: string;
  userId: string;
  campaignId?: string | null;
  senderId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
  };
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface PaginatedResponse<T> {
  emails: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenSec: number;
  hourlyLimit?: number;
}

