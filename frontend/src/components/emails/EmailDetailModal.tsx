import React from 'react';
import {
  ArrowLeft,
  Star,
  FolderArchive,
  Trash2,
  ExternalLink,
  ChevronDown,
  Paperclip,
} from 'lucide-react';
import { EmailItem } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface EmailDetailModalProps {
  email: EmailItem | null;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose }) => {
  const { user } = useAuth();
  if (!email) return null;

  const senderEmail = email.sender?.email || 'sender@example.com';
  const initial = (email.sender?.email || email.recipient || 'S')
    .charAt(0)
    .toUpperCase();

  const formattedDate = new Date(email.sentAt || email.scheduledAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-fade-in">
      {/* Top Header matching Figma */}
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white">
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {email.subject}
          </h2>
        </div>

        {/* Right action icons matching Figma */}
        <div className="flex items-center gap-3">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
            <FolderArchive className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
            <Trash2 className="w-4 h-4" />
          </button>
          <img
            src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120'}
            alt="User"
            className="w-7 h-7 rounded-full object-cover ml-2 border border-gray-200"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-10 py-8 max-w-4xl mx-auto w-full">
        {/* Ethereal Preview URL Banner if sent */}
        {email.previewUrl && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>This email was dispatched via Nodemailer Ethereal test inbox!</span>
            </div>
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00A854] hover:bg-[#008a45] text-white text-xs font-semibold shadow-xs transition-all"
            >
              <span>View Ethereal Preview</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Sender details line matching Figma */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            {/* Green circular initial avatar */}
            <div className="w-10 h-10 rounded-full bg-[#00A854] text-white flex items-center justify-center font-bold text-sm">
              {initial}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {email.sender?.email ? email.sender.email.split('@')[0] : 'Sender'}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{senderEmail}&gt;
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span>to {email.recipient}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 font-medium">
            {formattedDate}
          </div>
        </div>

        {/* Formatted Email Body */}
        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed space-y-4">
          <div
            dangerouslySetInnerHTML={{ __html: email.body }}
            className="email-body-content"
          />
        </div>

        {/* Attachment thumbnails matching Figma */}
        <div className="mt-12 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Attachments (2)
          </p>
          <div className="flex items-center gap-4">
            <div className="w-48 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:border-emerald-400 transition-all cursor-pointer">
              <div className="h-24 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                <Paperclip className="w-6 h-6 opacity-75" />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 truncate">Tennis_Coach_Profile.png</p>
                <p className="text-[11px] text-gray-400">1.2 MB</p>
              </div>
            </div>

            <div className="w-48 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:border-emerald-400 transition-all cursor-pointer">
              <div className="h-24 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                <Paperclip className="w-6 h-6 opacity-75" />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 truncate">Tennis_Coach_Profile2.png</p>
                <p className="text-[11px] text-gray-400">1.2 MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

