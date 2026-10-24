import { RefreshCw, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

export const forcePwaUpdate = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (e) {
    console.warn('Cache purge error:', e);
  }
  // Hard reload with cache busting query param
  window.location.href = window.location.origin + '?updated=' + Date.now();
};

export const PwaUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const initialBuildTimeRef = useRef<number | null>(null);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/api/v1/version?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const serverTime = Number(data.build_time);
        if (serverTime > 0) {
          if (initialBuildTimeRef.current === null) {
            initialBuildTimeRef.current = serverTime;
          } else if (serverTime > initialBuildTimeRef.current) {
            setUpdateAvailable(true);
          }
        }
      }
    } catch {
      // Ignore network errors
    }
  };

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            for (const r of regs) r.update();
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slideDown select-none">
      <div className="bg-gradient-to-r from-[#1e1e1e] via-[#282828] to-[#1e1e1e] border border-spotify-green/60 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green flex-shrink-0 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-white">Update Ready</span>
              <span className="px-1.5 py-0.2 bg-spotify-green text-black font-black text-[9px] rounded-full">
                NEW
              </span>
            </div>
            <span className="text-[11px] text-spotify-gray truncate">
              New version deployed. Tap to reload.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => forcePwaUpdate()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-spotify-green text-black font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Update</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-full text-spotify-gray hover:text-white"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
