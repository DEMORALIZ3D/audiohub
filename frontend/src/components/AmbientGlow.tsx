import type React from 'react';
import { usePlayer } from '../context/PlayerContext';

export const AmbientGlow: React.FC = () => {
  const { currentTrack, currentPalette, isPlaying } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30 transition-opacity duration-1000">
      {/* Top Left Organic Glow */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] transition-all duration-1000 ${
          isPlaying ? 'scale-125 opacity-70 animate-pulse' : 'scale-90 opacity-30'
        }`}
        style={{ backgroundColor: currentPalette.primary }}
      />

      {/* Center Subtle Aura */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px] transition-all duration-1000 ${
          isPlaying ? 'scale-110 opacity-50' : 'scale-80 opacity-20'
        }`}
        style={{ backgroundColor: currentPalette.accent || currentPalette.secondary }}
      />

      {/* Bottom Right Complementary Glow */}
      <div
        className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[120px] transition-all duration-1000 ${
          isPlaying ? 'scale-125 opacity-60' : 'scale-90 opacity-25'
        }`}
        style={{ backgroundColor: currentPalette.secondary }}
      />
    </div>
  );
};
