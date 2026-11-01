import React from 'react';
import { Clock } from 'lucide-react';
import { EmailStatus } from '../../types';

interface BadgeProps {
  status?: EmailStatus;
  scheduledTime?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  scheduledTime,
  className = '',
}) => {
  if (scheduledTime) {
    const formatted = formatTime(scheduledTime);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FFF3E0] text-[#D97706] border border-[#FFE0B2]/50 ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-[#D97706]" />
        <span>{formatted}</span>
      </span>
    );
  }

  if (status === 'SENT') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#4B5563] ${className}`}
      >
        Sent
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#DC2626] ${className}`}
      >
        Failed
      </span>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DBEAFE] text-[#1D4ED8] animate-pulse ${className}`}
      >
        Sending...
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ${className}`}
    >
      {status || 'Unknown'}
    </span>
  );
};

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${dayName} ${timeStr}`;
  } catch {
    return dateStr;
  }
}

