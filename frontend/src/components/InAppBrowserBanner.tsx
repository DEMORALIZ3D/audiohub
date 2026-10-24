import { ArrowUpRight, ExternalLink, Smartphone, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  attemptAutoBreakout,
  getInAppBrowserDetails,
  openInSystemBrowserOrApp,
} from '../utils/inAppBrowser';

export const InAppBrowserBanner: React.FC = () => {
  const [details, setDetails] = useState<{
    isInApp: boolean;
    name: string;
    isAndroid: boolean;
    isIos: boolean;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const browserDetails = getInAppBrowserDetails(navigator.userAgent);
    if (browserDetails.isInApp) {
      setDetails(browserDetails);

      // Attempt immediate background breakout on Android so PWA/Chrome launches automatically
      attemptAutoBreakout();
    }
  }, []);

  if (!details?.isInApp || isDismissed) {
    return null;
  }

  const handleOpenExternal = () => {
    openInSystemBrowserOrApp(window.location.href);
  };

  return (
    <div className="relative z-50 bg-gradient-to-r from-emerald-950 via-[#182a1e] to-black border-b border-emerald-500/30 text-white px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-spotify-green/20 text-spotify-green shrink-0 mt-0.5 sm:mt-0">
            <Smartphone className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Trapped in {details.name}?</span>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                Sandbox Mode
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Open in your installed AudioHub app or browser to stay logged in and enjoy background
              audio.
            </p>
            {details.isIos && (
              <p className="text-[11px] text-white/50 mt-0.5">
                Tip: You can also tap <span className="text-white font-semibold">•••</span> at
                top-right &rarr; <span className="text-white font-semibold">Open in Safari</span>.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleOpenExternal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs shadow-lg shadow-spotify-green/20 transition-all hover:scale-105 active:scale-95"
          >
            <span>Open in App / Browser</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-white/50 hover:text-white rounded-full transition-colors"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
