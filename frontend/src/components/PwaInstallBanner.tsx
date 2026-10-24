import { Download, Smartphone, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePwaInstall } from '../context/PwaInstallContext';

export const PwaInstallBanner: React.FC = () => {
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed in last 3 days
    const dismissedTime = localStorage.getItem('audiohub_pwa_dismissed');
    if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 3 * 86400000) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    localStorage.setItem('audiohub_pwa_dismissed', Date.now().toString());
  };

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="md:hidden fixed top-3 left-3 right-3 z-40 animate-slide-down">
      <div className="bg-gradient-to-r from-[#1e1e1e] via-[#252525] to-[#1e1e1e] border border-spotify-green/30 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-spotify-green/20 border border-spotify-green/30 flex items-center justify-center text-spotify-green flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-white truncate">
                Install AudioHub App
              </span>
              <span className="px-1.5 py-0.2 bg-spotify-green text-black font-black text-[9px] rounded-full">
                FREE
              </span>
            </div>
            <span className="text-[11px] text-spotify-gray truncate">
              Better background playback & full screen
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={promptInstall}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-spotify-green text-black font-extrabold text-xs shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-spotify-gray hover:text-white hover:bg-white/10"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
