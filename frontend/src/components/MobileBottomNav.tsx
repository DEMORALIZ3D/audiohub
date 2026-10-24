import { Home, Library, Search, Settings } from 'lucide-react';
import type React from 'react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenLibrary: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenLibrary,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-[#121212]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around z-40 px-2 text-xs font-medium select-none">
      <button
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 ${
          activeTab === 'home' ? 'text-white' : 'text-spotify-gray hover:text-white'
        }`}
      >
        <Home className={`w-6 h-6 ${activeTab === 'home' ? 'text-white' : ''}`} />
        <span>Home</span>
      </button>

      <button
        onClick={() => setActiveTab('search')}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 ${
          activeTab === 'search' ? 'text-white' : 'text-spotify-gray hover:text-white'
        }`}
      >
        <Search className={`w-6 h-6 ${activeTab === 'search' ? 'text-white' : ''}`} />
        <span>Search</span>
      </button>

      <button
        onClick={onOpenLibrary}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 ${
          activeTab === 'library' || activeTab === 'liked' || activeTab === 'playlist'
            ? 'text-white'
            : 'text-spotify-gray hover:text-white'
        }`}
      >
        <Library className={`w-6 h-6 ${activeTab === 'library' ? 'text-white' : ''}`} />
        <span>Your Library</span>
      </button>

      <button
        onClick={() => setActiveTab('settings')}
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 ${
          activeTab === 'settings' ? 'text-white' : 'text-spotify-gray hover:text-white'
        }`}
      >
        <Settings className={`w-6 h-6 ${activeTab === 'settings' ? 'text-white' : ''}`} />
        <span>Settings</span>
      </button>
    </div>
  );
};
