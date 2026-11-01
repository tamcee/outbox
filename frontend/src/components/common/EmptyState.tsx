import React from 'react';
import { Mail, Clock, Send, Search } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  type?: 'scheduled' | 'sent' | 'search' | 'generic';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionText,
  onAction,
}) => {
  const defaults = {
    scheduled: {
      icon: Clock,
      title: 'No scheduled emails',
      description: 'You do not have any emails queued for dispatch. Compose a new email or schedule a campaign to see them here.',
      actionText: 'Compose New Email',
    },
    sent: {
      icon: Send,
      title: 'No sent emails yet',
      description: 'Emails that have been successfully dispatched will show up here along with their live delivery preview links.',
      actionText: 'Compose New Email',
    },
    search: {
      icon: Search,
      title: 'No matching emails found',
      description: 'Try adjusting your search terms or filters to find what you are looking for.',
      actionText: undefined,
    },
    generic: {
      icon: Mail,
      title: 'No items to display',
      description: 'Your queue is empty.',
      actionText: undefined,
    },
  }[type];

  const Icon = defaults.icon;
  const finalTitle = title || defaults.title;
  const finalDesc = description || defaults.description;
  const finalAction = actionText || defaults.actionText;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto my-8">
      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4 text-[#00A854]">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1.5">{finalTitle}</h3>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">{finalDesc}</p>
      {finalAction && onAction && (
        <Button variant="outline-green" onClick={onAction}>
          {finalAction}
        </Button>
      )}
    </div>
  );
};

