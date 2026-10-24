import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Tv } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { useBranding } from '../config/branding';
import { useAuth } from '../context/AuthContext';

export const PairTvView: React.FC = () => {
  const brand = useBranding();
  const { currentUser, login } = useAuth();

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Fallback login state if user is logged out on phone
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPin = params.get('pin');
    if (qPin && /^\d{4}$/.test(qPin.trim())) {
      setPin(qPin.trim());
    }
  }, []);

  const handlePairSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin.length < 4) {
      setError('Please enter the 4-digit PIN from your TV screen.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // If user is not logged in, log in first
      if (!currentUser) {
        if (!username.trim() || !password) {
          setError('Please sign in below to authorize this TV.');
          setLoading(false);
          return;
        }
        const authRes = await login(username, password);
        if (!authRes.success) {
          setError(authRes.error || 'Login failed. Check your username and password.');
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/v1/auth/magic/claim-by-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        throw new Error(data.detail || 'Failed to pair TV. Verify the PIN on the screen.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0d] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131318] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Pair Smart TV</h1>
            <p className="text-xs text-zinc-400">{brand.appName} TV Connect</p>
          </div>
        </div>

        {success ? (
          <div className="text-center py-6 space-y-4 animate-scaleIn">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">Smart TV Connected!</h2>
            <p className="text-sm text-zinc-300">
              Your Samsung Smart TV is now linked and signed in to your account.
            </p>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="mt-4 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition"
            >
              Go to Library
            </button>
          </div>
        ) : (
          <form onSubmit={handlePairSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                4-Digit TV PIN Code
              </label>
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                autoFocus
                className="w-full text-center font-mono text-4xl tracking-[0.4em] py-3.5 bg-[#1b1b22] border-2 border-emerald-500/50 rounded-2xl text-emerald-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 transition-all"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5 text-center">
                Enter the security PIN currently showing on your Samsung TV screen.
              </p>
            </div>

            {/* If not logged in on phone, ask credentials */}
            {!currentUser && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="text-xs font-semibold text-zinc-300">
                  Sign in to approve this TV:
                </div>
                <input
                  type="text"
                  placeholder="Username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#1b1b22] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1b1b22] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {currentUser && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/5 rounded-xl text-xs text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Pairing as <strong>{currentUser.username}</strong>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.trim().length < 4}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Link Smart TV</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
