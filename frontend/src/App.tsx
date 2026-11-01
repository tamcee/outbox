import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ScheduledList } from './components/emails/ScheduledList';
import { SentList } from './components/emails/SentList';
import { ComposeModal } from './components/compose/ComposeModal';
import { EmailDetailModal } from './components/emails/EmailDetailModal';
import { emailApi } from './api/client';
import { EmailItem, EmailStats } from './types';
import { useToast } from './context/ToastContext';

export const App: React.FC = () => {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const { success, error } = useToast();

  const [currentTab, setCurrentTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [stats, setStats] = useState<EmailStats>({ scheduled: 0, sent: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  // Fetch stats for sidebar badges
  const fetchStats = useCallback(async () => {
    try {
      const data = await emailApi.getStats();
      setStats(data);
    } catch {
      // Ignore background stats fetch errors
    }
  }, []);

  // Fetch emails based on current tab & search
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await emailApi.search(
          searchQuery.trim(),
          currentTab === 'scheduled' ? 'SCHEDULED' : undefined,
          page
        );
        setEmails(res.emails);
        setTotalPages(res.pagination.totalPages || 1);
      } else if (currentTab === 'scheduled') {
        const res = await emailApi.getScheduled(page, 20);
        setEmails(res.emails);
        setTotalPages(res.pagination.totalPages || 1);
      } else {
        const res = await emailApi.getSent(page, 20);
        setEmails(res.emails);
        setTotalPages(res.pagination.totalPages || 1);
      }
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [currentTab, searchQuery, page, error]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      success('Slack connected successfully! Hourly rate limit alerts are now active.');
      window.history.replaceState({}, '', window.location.pathname);
      refreshUser();
    } else if (params.get('slack') === 'error') {
      error('Failed to authorize with Slack.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [success, error, refreshUser]);

  useEffect(() => {
    if (user) {
      fetchEmails();
      fetchStats();
      // Auto-poll every 5 seconds to show live scheduled -> sent transitions
      const timer = setInterval(() => {
        fetchEmails();
        fetchStats();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [user, fetchEmails, fetchStats]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-400 font-medium tracking-wide">Loading 0NB Scheduler...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setPage(1);
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
        scheduledCount={stats.scheduled}
        sentCount={stats.sent + stats.failed}
      />

      {/* Main Content View (offset by sidebar width: 16rem = 256px) */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen bg-white">
        {/* Top Header Bar */}
        <Topbar
          onSearch={(q) => {
            setSearchQuery(q);
            setPage(1);
          }}
          onRefresh={() => {
            fetchEmails();
            fetchStats();
          }}
          isRefreshing={loading}
        />

        {/* Email Table / List Area */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'scheduled' ? (
            <ScheduledList
              emails={emails}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          ) : (
            <SentList
              emails={emails}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          )}

          {/* Simple Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-white">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduled={() => {
          fetchEmails();
          fetchStats();
        }}
      />

      {/* Email Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
};

