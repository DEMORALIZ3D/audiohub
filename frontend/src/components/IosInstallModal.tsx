import { PlusSquare, Share, Smartphone, X } from 'lucide-react';
import type React from 'react';
import { usePwaInstall } from '../context/PwaInstallContext';

export const IosInstallModal: React.FC = () => {
  const { showIosModal, setShowIosModal } = usePwaInstall();

  if (!showIosModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={() => setShowIosModal(false)}
          className="absolute top-4 right-4 text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-white">Install on iPhone / iPad</h3>
            <p className="text-xs text-spotify-gray">Full-screen app with background playback</p>
          </div>
        </div>

        <div className="space-y-4 my-6 text-sm">
          <div className="flex items-start gap-3 bg-[#282828] p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="text-white font-semibold">Tap the Share icon</p>
              <p className="text-xs text-spotify-gray mt-0.5 flex items-center gap-1.5">
                In Safari's bottom toolbar, tap <Share className="w-4 h-4 text-blue-400 inline" />
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#282828] p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="text-white font-semibold">Add to Home Screen</p>
              <p className="text-xs text-spotify-gray mt-0.5 flex items-center gap-1.5">
                Scroll down and tap <PlusSquare className="w-4 h-4 text-white inline" />{' '}
                <span className="font-medium text-white">"Add to Home Screen"</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#282828] p-3 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="text-white font-semibold">Tap "Add" in top-right</p>
              <p className="text-xs text-spotify-gray mt-0.5">
                AudioHub will now launch as a dedicated standalone app on your home screen!
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowIosModal(false)}
          className="w-full py-3 rounded-full bg-spotify-green hover:bg-spotify-green/90 text-black font-extrabold text-sm transition-all shadow-lg active:scale-98"
        >
          Got It!
        </button>
      </div>
    </div>
  );
};
