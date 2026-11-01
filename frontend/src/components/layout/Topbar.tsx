import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Slack } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { slackApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface TopbarProps {
  onSearch: (query: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  onSearch,
  onRefresh,
  isRefreshing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, onSearch]);

  const handleSlackConnect = async () => {
    try {
      if (user?.slackConnected) {
        if (confirm('Disconnect Slack notifications?')) {
          await slackApi.disconnect();
          await refreshUser();
          success('Slack disconnected');
        }
      } else {
        const url = await slackApi.getConnectUrl();
        window.location.href = url;
      }
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to connect Slack');
    }
  };

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-8 sticky top-0 z-20">
      {/* Search Input matching Figma pill design */}
      <div className="flex items-center gap-3 w-full max-w-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F5F6F8] border border-transparent rounded-full text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-gray-300 focus:outline-none transition-all"
          />
        </div>

        {/* Filter icon */}
        <button
          title="Filter"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all"
        >
          <Filter className="w-4 h-4" />
        </button>

        {/* Refresh icon */}
        <button
          onClick={onRefresh}
          title="Refresh emails"
          className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all ${
            isRefreshing ? 'animate-spin text-emerald-600' : ''
          }`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Right Action: Slack Connect button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSlackConnect}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            user?.slackConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Slack className="w-3.5 h-3.5 text-[#E01E5A]" />
          <span>{user?.slackConnected ? 'Slack Connected' : 'Connect Slack'}</span>
        </button>
      </div>
    </header>
  );
};

