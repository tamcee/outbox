import React, { useState } from 'react';
import { Clock, Send, ChevronDown, LogOut, Slack, ExternalLink, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { slackApi } from '../../api/client';

interface SidebarProps {
  currentTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenCompose,
  scheduledCount,
  sentCount,
}) => {
  const { user, logout, refreshUser } = useAuth();
  const { success, error } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);

  const handleSlackAction = async () => {
    setUserMenuOpen(false);
    if (user?.slackConnected) {
      if (confirm('Are you sure you want to disconnect Slack?')) {
        try {
          setSlackLoading(true);
          await slackApi.disconnect();
          await refreshUser();
          success('Slack disconnected');
        } catch {
          error('Failed to disconnect Slack');
        } finally {
          setSlackLoading(false);
        }
      }
    } else {
      try {
        setSlackLoading(true);
        const url = await slackApi.getConnectUrl();
        window.location.href = url;
      } catch (err: any) {
        error(err.response?.data?.error || 'Failed to start Slack OAuth');
      } finally {
        setSlackLoading(false);
      }
    }
  };

  const avatarUrl =
    user?.avatar ||
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120';

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Top Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="font-mono text-2xl font-black tracking-tighter text-gray-950 flex items-center">
            <span className="tracking-widest">0NB</span>
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="px-4 mb-4 relative">
        <div
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 cursor-pointer transition-all border border-gray-100/60"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={avatarUrl}
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white shadow-xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {user?.name || 'Oliver Brown'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {user?.email || 'oliver.brown@domain.io'}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
        </div>

        {/* User Dropdown */}
        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setUserMenuOpen(false)}
            />
            <div className="absolute left-4 right-4 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-scale-in">
              <button
                onClick={handleSlackAction}
                disabled={slackLoading}
                className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Slack className="w-3.5 h-3.5 text-[#E01E5A]" />
                  {user?.slackConnected ? 'Disconnect Slack' : 'Connect Slack'}
                </span>
                {user?.slackConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <a
                href="/admin/queues"
                target="_blank"
                rel="noreferrer"
                className="w-full px-3.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  Queue Dashboard
                </span>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>

              <div className="border-t border-gray-100 my-1" />

              <button
                onClick={logout}
                className="w-full px-3.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {/* Compose Button */}
      <div className="px-4 mb-6">
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 rounded-full border border-[#10B981] bg-white hover:bg-emerald-50 active:bg-emerald-100 text-[#00A854] font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2"
        >
          Compose
        </button>
      </div>

      {/* Navigation section */}
      <div className="px-4 flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          CORE
        </p>
        <nav className="space-y-1">
          {/* Scheduled Nav Item */}
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'scheduled'
                ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock
                className={`w-4 h-4 ${
                  currentTab === 'scheduled' ? 'text-[#00A854]' : 'text-gray-400'
                }`}
              />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs ${
                currentTab === 'scheduled' ? 'text-[#00A854] font-bold' : 'text-gray-400'
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          {/* Sent Nav Item */}
          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'sent'
                ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send
                className={`w-4 h-4 ${
                  currentTab === 'sent' ? 'text-[#00A854]' : 'text-gray-400'
                }`}
              />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs ${
                currentTab === 'sent' ? 'text-[#00A854] font-bold' : 'text-gray-400'
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Slack status indicator at bottom */}
      <div className="p-4 border-t border-gray-100/60 bg-gray-50/50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Slack className="w-3.5 h-3.5 text-gray-400" />
            <span>Slack Alerts</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              user?.slackConnected
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {user?.slackConnected ? 'Connected' : 'Off'}
          </span>
        </div>
      </div>
    </aside>
  );
};

