import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, devLogin } = useAuth();
  const { error } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const details = params.get('details');
    if (err === 'auth_failed') {
      error(details ? `Google authentication failed: ${details}` : 'Google authentication failed. Please check credentials and try again.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (err === 'no_code') {
      error('Google login was cancelled or timed out.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [error]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await devLogin(email.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-gray-100 rounded-2xl p-8 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Login
        </h1>

        {/* Login with Google Button */}
        <button
          onClick={loginWithGoogle}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#E8F5E9] hover:bg-[#DCEDC8] active:bg-[#C5E1A5] text-gray-800 font-medium text-sm transition-all focus:outline-none"
        >
          {/* Google 4-color SVG Icon */}
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Login with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-7 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <span className="relative px-3 bg-white text-xs text-gray-400">
            or sign up through email
          </span>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F6F8] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F6F8] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#00A854] hover:bg-[#009249] active:bg-[#007e3e] text-white font-medium text-sm shadow-sm transition-all focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

