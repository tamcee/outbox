import React, { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { EmailItem } from '../../types';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';

interface SentListProps {
  emails: EmailItem[];
  loading: boolean;
  onSelectEmail: (email: EmailItem) => void;
  onOpenCompose: () => void;
}

export const SentList: React.FC<SentListProps> = ({
  emails,
  loading,
  onSelectEmail,
  onOpenCompose,
}) => {
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="divide-y divide-gray-100 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center px-8 py-4 gap-4 bg-white">
            <div className="w-28 h-4 bg-gray-200 rounded"></div>
            <div className="w-16 h-5 bg-gray-100 rounded-full"></div>
            <div className="flex-1 h-4 bg-gray-200 rounded"></div>
            <div className="w-5 h-5 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        type="sent"
        onAction={onOpenCompose}
      />
    );
  }

  const getSnippet = (html: string): string => {
    return html.replace(/<[^>]*>?/gm, '').trim();
  };

  return (
    <div className="bg-white divide-y divide-gray-100/80">
      {emails.map((email) => {
        const isStarred = Boolean(starredMap[email.id]);
        const snippet = getSnippet(email.body);

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email)}
            className="flex items-center justify-between px-8 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors group select-none"
          >
            {/* Left & Middle details */}
            <div className="flex items-center gap-4 overflow-hidden flex-1 min-w-0 pr-4">
              {/* Recipient matching Figma */}
              <div className="w-36 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-900 truncate block">
                  To: {email.recipient}
                </span>
              </div>

              {/* Status Badge matching Figma */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <Badge status={email.status} />
                {email.previewUrl && (
                  <a
                    href={email.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Open live Ethereal email preview"
                    className="text-gray-400 hover:text-emerald-600 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Subject & snippet preview matching Figma */}
              <div className="flex-1 min-w-0 truncate text-xs">
                <span className="font-semibold text-gray-900 mr-2">
                  {email.subject}
                </span>
                <span className="text-gray-400">
                  - {snippet || 'No additional content'}
                </span>
              </div>
            </div>

            {/* Right: Star Icon matching Figma */}
            <button
              onClick={(e) => toggleStar(e, email.id)}
              className="p-1 text-gray-300 hover:text-amber-400 transition-colors flex-shrink-0"
              title="Star email"
            >
              <Star
                className={`w-4 h-4 ${
                  isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
};

