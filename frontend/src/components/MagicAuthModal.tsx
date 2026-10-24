import { AlertCircle, Check, Laptop, Loader2, ShieldCheck, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { BRAND_CONFIG } from '../config/branding';

interface MagicAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  initialPin?: string;
  onSuccess?: () => void;
}

export const MagicAuthModal: React.FC<MagicAuthModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  initialPin = '',
  onSuccess,
}) => {
  const [pin, setPin] = useState(initialPin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!pin.trim()) {
      setError('Please confirm the 4-digit PIN shown on the device screen');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = localStorage.getItem('audiohub_user_id');
      const res = await fetch('/api/v1/auth/magic/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {}),
        },
        body: JSON.stringify({
          session_id: sessionId,
          pin: pin.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Authorization failed');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to authorize sign-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-scaleIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-4 text-emerald-400">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Device Authorized!</h3>
            <p className="text-xs text-zinc-400">
              Your new device is signing into {BRAND_CONFIG.appName} now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            {/* Device Icon */}
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 text-emerald-400">
              <Laptop className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold tracking-tight mb-1 text-white">
              Authorize Device Sign-In?
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              A computer or screen is asking to sign into your {BRAND_CONFIG.appName} account via
              Magic QR.
            </p>

            {error && (
              <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs flex items-center gap-2 mb-4 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* PIN Confirmation */}
            <div className="w-full mb-5 text-left">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Confirm 4-Digit Security PIN
              </label>
              <input
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4821"
                className="w-full text-center text-2xl font-mono font-black tracking-widest bg-zinc-800/80 border border-zinc-700 rounded-xl py-2.5 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-zinc-500 block mt-1 text-center">
                Match the PIN shown on the device screen
              </span>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2">
              <button
                onClick={handleApprove}
                disabled={loading || pin.length < 4}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-full text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Approve & Sign In</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition"
              >
                Cancel / Not Me
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
