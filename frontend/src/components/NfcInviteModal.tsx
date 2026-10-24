import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Radio,
  RefreshCw,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { BRAND_CONFIG } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { isNfcSupported, writeNfcUrl } from '../utils/nfcUtils';
import { AzifyLogoMark } from './AzifyLogoMark';

interface NfcInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NfcInviteData {
  token: string;
  invite_url: string;
  admin_name: string;
  qr_svg_url?: string;
  local_proxy_url?: string;
  expires_in?: number;
}

export const NfcInviteModal: React.FC<NfcInviteModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<NfcInviteData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<
    'idle' | 'transmitting' | 'success' | 'unsupported' | 'error'
  >('idle');
  const [nfcErrorMsg, setNfcErrorMsg] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const nfcAvailable = isNfcSupported();

  const fetchInvite = async () => {
    setLoading(true);
    setError('');
    setNfcStatus('idle');

    try {
      const res = await fetch('/api/v1/auth/nfc/create-invite', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to generate NFC invite');
      }

      const data: NfcInviteData = await res.json();
      setInviteData(data);

      // If NFC is supported, automatically begin writing/listening
      if (nfcAvailable && data.invite_url) {
        startNfcBroadcast(data.invite_url);
      } else if (!nfcAvailable) {
        setNfcStatus('unsupported');
      }
    } catch (err: any) {
      setError(err.message || 'Could not initialize NFC invite');
    } finally {
      setLoading(false);
    }
  };

  const startNfcBroadcast = async (url: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setNfcStatus('transmitting');
    setNfcErrorMsg('');

    const res = await writeNfcUrl(url, ac.signal);
    if (res.success) {
      setNfcStatus('success');
      setTimeout(() => {
        if (isOpen) setNfcStatus('transmitting'); // Reset to keep beaming for next tap
      }, 4000);
    } else if (res.error && res.error !== 'aborted') {
      setNfcStatus('error');
      setNfcErrorMsg(res.error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvite();
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen]);

  const handleCopy = async () => {
    if (!inviteData?.invite_url) return;
    try {
      await navigator.clipboard.writeText(inviteData.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (!inviteData?.invite_url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${BRAND_CONFIG.appName}`,
          text: `You've been invited by ${inviteData.admin_name} to join ${BRAND_CONFIG.appName}! Tap here to sign up:`,
          url: inviteData.invite_url,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-[#181818] border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative flex flex-col items-center overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-2.5 text-purple-400 shadow-lg">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">NFC Tap-to-Invite</h2>
          <p className="text-xs text-spotify-gray mt-0.5">
            Hold phones back-to-back to onboard your guest instantly
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-spotify-gray">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-xs">Preparing secure NFC invite...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-400 text-xs px-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <p>{error}</p>
            <button
              onClick={fetchInvite}
              className="mt-4 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* NFC Concentric Waves & Animation */}
            <div className="relative w-48 h-48 flex items-center justify-center my-2">
              {/* Concentric Pulsing Rings */}
              {nfcStatus === 'transmitting' && (
                <>
                  <div
                    className="absolute w-44 h-44 rounded-full border border-purple-500/20 animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                  <div
                    className="absolute w-36 h-36 rounded-full border border-emerald-500/30 animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  <div
                    className="absolute w-28 h-28 rounded-full border border-purple-400/40 animate-ping"
                    style={{ animationDuration: '1.5s' }}
                  />
                </>
              )}

              {/* Center Code / Badge */}
              <div className="relative w-40 h-40 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-purple-500/40 flex items-center justify-center overflow-hidden z-10">
                {inviteData?.local_proxy_url || inviteData?.qr_svg_url ? (
                  <img
                    src={inviteData.local_proxy_url || inviteData.qr_svg_url}
                    alt="NFC Invite QR Fallback"
                    className="w-full h-full object-contain select-none"
                  />
                ) : (
                  <div className="flex flex-col items-center text-black text-center p-2">
                    <Smartphone className="w-10 h-10 text-purple-600 mb-1" />
                    <span className="text-[10px] font-bold">Tap Backs Together</span>
                  </div>
                )}

                {/* Center Brand Logo Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-[#121214] rounded-lg shadow-lg border border-emerald-500/30 p-0.5 flex items-center justify-center pointer-events-none">
                  <AzifyLogoMark className="w-full h-full" animated={false} glow={false} />
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <div className="mt-3 mb-4 w-full text-center">
              {nfcStatus === 'success' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold animate-bounce">
                  <Check className="w-4 h-4" />
                  <span>Invite Beamed Successfully!</span>
                </div>
              ) : nfcStatus === 'transmitting' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span>NFC Ready • Tap backs together</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
                  <span>Aim camera at QR or tap via NFC</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-400 mt-2 px-2 leading-relaxed">
                Guest will open directly to sign up with VIP invite permissions from{' '}
                <b>{inviteData?.admin_name}</b>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-white/10">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-purple-400" />
                )}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all active:scale-95 shadow-lg shadow-purple-600/30"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Invite</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
