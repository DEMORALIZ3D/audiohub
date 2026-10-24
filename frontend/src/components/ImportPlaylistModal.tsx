import { ArrowDownToLine, X } from 'lucide-react';
import type React from 'react';
import { MusicImporter } from './MusicImporter';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlistId?: string) => void;
  defaultTarget?: 'liked_songs' | 'new_playlist' | 'existing_playlist';
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultTarget = 'liked_songs',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col scrollbar-none">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#181818] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">
                Import Music & Playlists
              </h3>
              <p className="text-[11px] text-spotify-gray">
                Spotify, Apple Music, CSV file, or Exportify
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <MusicImporter
          isModal
          defaultTarget={defaultTarget}
          onClose={onClose}
          onSuccess={(res) => {
            onSuccess(res.id);
          }}
        />
      </div>
    </div>
  );
};
