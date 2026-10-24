import { KeyRound, Loader2, RefreshCw, Smartphone, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { BRAND_CONFIG } from '../config/branding';
import { AzifyLogoMark } from './AzifyLogoMark';

interface PairDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TransferQrData {
  token: string;
  pin: string;
  claim_url: string;
  qr_svg_url: string;
  local_proxy_url: string;
  expires_in: number;
}

export const PairDeviceModal: React.FC<PairDeviceModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TransferQrData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTransferQr = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem('audiohub_user_id');
      const res = await fetch('/api/v1/auth/magic/transfer-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {}),
        },
        body: JSON.stringify({ device_name: 'Companion Device' }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate device pairing QR');
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Could not generate transfer QR code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTransferQr();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

        <div className="flex flex-col items-center text-center">
          {/* Header Icon */}
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 text-emerald-400">
            <Smartphone className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold tracking-tight text-white mb-1">Pair Phone or Tablet</h3>
          <p className="text-xs text-zinc-400 mb-4">
            Scan this QR code with your phone camera to log into {BRAND_CONFIG.appName} instantly.
          </p>

          {/* QR Code Container */}
          <div className="relative w-56 h-56 bg-white p-3 rounded-2xl shadow-xl border-2 border-emerald-500/40 flex items-center justify-center overflow-hidden mb-4">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-zinc-600">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-medium">Generating QR code...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500 text-xs">
                <p className="font-semibold mb-2">QR Generation Failed</p>
                <button
                  onClick={fetchTransferQr}
                  className="px-3 py-1 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  Retry
                </button>
              </div>
            ) : data ? (
              <div className="relative w-full h-full">
                <img
                  src={data.local_proxy_url || data.qr_svg_url}
                  alt="Pairing QR Code"
                  className="w-full h-full object-contain select-none"
                />
                {/* Center Brand Logo Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 bg-[#121214] rounded-xl shadow-lg border border-emerald-500/30 p-1 flex items-center justify-center pointer-events-none">
                  <AzifyLogoMark className="w-full h-full" animated={false} glow={false} />
                </div>
              </div>
            ) : null}
          </div>

          {/* Security PIN Badge */}
          {data && (
            <div className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl p-2.5 mb-4 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Security PIN:</span>
              </div>
              <span className="font-mono text-xl font-black text-emerald-400 tracking-widest">
                {data.pin}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="w-full flex items-center justify-between text-xs text-zinc-400">
            <button
              onClick={fetchTransferQr}
              disabled={loading}
              className="flex items-center gap-1.5 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>New QR Code</span>
            </button>

            <span className="text-[11px] text-zinc-500">Expires in 5 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
