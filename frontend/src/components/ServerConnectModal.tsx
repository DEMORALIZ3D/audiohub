import { AlertCircle, CheckCircle2, QrCode, RefreshCw, Server, Wifi, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_HOMELAB_URL,
  getServerBaseUrl,
  isStandaloneApp,
  isTvPlatform,
  setServerBaseUrl,
} from '../utils/apiConfig';

interface ServerConnectModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export const ServerConnectModal: React.FC<ServerConnectModalProps> = ({
  isOpen,
  onClose,
  canClose = true,
}) => {
  const currentUrl = getServerBaseUrl();
  const [urlInput, setUrlInput] = useState(currentUrl || 'http://localhost:4533');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [modalFocusIndex, setModalFocusIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 10009 || e.key === 'Return' || e.key === 'XF86Back') {
        if (canClose && onClose) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setModalFocusIndex((prev) => (prev + 1) % 3);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setModalFocusIndex((prev) => (prev - 1 + 3) % 3);
      } else if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        if (modalFocusIndex === 0) {
          handlePreset('http://localhost:4533');
        } else if (modalFocusIndex === 1) {
          handlePreset(DEFAULT_HOMELAB_URL);
        } else if (modalFocusIndex === 2) {
          testAndConnect(urlInput || 'http://localhost:4533');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canClose, onClose, modalFocusIndex, urlInput]);

  const normalizeUrl = (raw: string) => {
    let clean = raw.trim().replace(/\/+$/, '');
    if (!clean) return '';
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      const isIpOrLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(
        clean,
      );
      clean = isIpOrLocal ? `http://${clean}` : `https://${clean}`;
    }
    return clean;
  };

  const saveAndProceed = (targetUrl: string) => {
    const clean = normalizeUrl(targetUrl);
    if (!clean) return;
    setServerBaseUrl(clean);
    setStatus('success');
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const testAndConnect = async (urlToTest: string) => {
    let clean = normalizeUrl(urlToTest);
    if (!clean) {
      setStatus('error');
      setErrorMessage('Please enter a server address.');
      return;
    }

    setTesting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${clean}/api/v1/health`);
      } catch (e) {
        if (clean.startsWith('https://') && !urlToTest.includes('://')) {
          const httpFallback = clean.replace(/^https:\/\//, 'http://');
          try {
            res = await fetch(`${httpFallback}/api/v1/health`);
            if (res && (res.ok || res.status === 200)) {
              clean = httpFallback;
            }
          } catch {}
        }
        if (!res) throw e;
      }

      if (res && (res.ok || res.status === 200 || res.status === 304)) {
        saveAndProceed(clean);
        return;
      }
      throw new Error(`Server returned HTTP ${res?.status || 'error'}`);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err.message?.includes('Failed to fetch')
          ? 'Cannot reach server. Verify address or use Connect Anyway below.'
          : err.message || 'Server connection failed.',
      );
    } finally {
      setTesting(false);
    }
  };

  const handlePreset = (preset: string) => {
    setUrlInput(preset);
    testAndConnect(preset);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#18181c] border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Connect to AudioHub</h3>
            <p className="text-xs text-spotify-gray">
              {isStandaloneApp()
                ? 'Sideloaded / Native TV & Mobile Client'
                : 'Self-Hosted Server Address'}
            </p>
          </div>
        </div>

        <p className="text-xs text-white/70 mb-4 leading-relaxed">
          Enter your self-hosted AudioHub backend URL (e.g. LAN IP with port 4533 or your reverse
          proxy domain).
        </p>

        {/* Input */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1 block">
              Server Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setStatus('idle');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') testAndConnect(urlInput);
                }}
                placeholder="http://localhost:4533 or https://music.yourdomain.com"
                className="w-full bg-[#242428] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green font-mono transition-colors"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-white/40 font-semibold uppercase">Presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('http://localhost:4533')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                modalFocusIndex === 0
                  ? 'bg-emerald-400 text-black border-white ring-2 ring-white font-bold scale-105 shadow-md'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              localhost:4533
            </button>
            <button
              type="button"
              onClick={() => handlePreset(DEFAULT_HOMELAB_URL)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                modalFocusIndex === 1
                  ? 'bg-emerald-400 text-black border-white ring-2 ring-white font-bold scale-105 shadow-md'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
              }`}
            >
              LAN (:4533)
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'success' && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Connected! Loading library...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => saveAndProceed(urlInput)}
              className="text-emerald-400 hover:text-emerald-300 text-left font-semibold underline text-[11px] mt-0.5"
            >
              Save & Connect to {normalizeUrl(urlInput) || urlInput} anyway &rarr;
            </button>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => testAndConnect(urlInput)}
            disabled={testing || !urlInput.trim()}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2 ${
              modalFocusIndex === 2
                ? 'bg-emerald-400 text-black ring-4 ring-white scale-105'
                : 'bg-spotify-green hover:bg-spotify-green/90 text-black shadow-spotify-green/20'
            }`}
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>Save & Connect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
