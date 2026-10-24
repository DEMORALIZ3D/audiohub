import { Mic2, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { LyricLine } from '../types';

export const LyricsModal: React.FC = () => {
  const { currentTrack, currentTime, showLyrics, toggleLyrics } = usePlayer();
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!currentTrack || !showLyrics) return;

    setLoading(true);
    setLyrics([]);
    setPlainLyrics(null);

    const query = new URLSearchParams({
      track: currentTrack.title,
      artist: currentTrack.artist,
      duration: String(currentTrack.duration_seconds || 0),
    });

    fetch(`/api/v1/lyrics?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.synced_lyrics) {
          // Parse LRC format: [mm:ss.xx] text
          const lines: LyricLine[] = [];
          const rawLines = data.synced_lyrics.split('\n');
          const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

          for (const raw of rawLines) {
            const match = raw.match(timeRegex);
            if (match) {
              const minutes = parseInt(match[1], 10);
              const seconds = parseInt(match[2], 10);
              const frac = parseFloat('0.' + match[3]);
              const time = minutes * 60 + seconds + frac;
              const text = match[4].trim();
              if (text) {
                lines.push({ time, text });
              }
            }
          }
          setLyrics(lines);
        } else if (data.plain_lyrics) {
          setPlainLyrics(data.plain_lyrics);
        }
      })
      .catch((e) => console.error('Failed to load lyrics', e))
      .finally(() => setLoading(false));
  }, [currentTrack?.id, showLyrics]);

  // Auto scroll to active line
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]);

  if (!showLyrics) return null;

  // Find active line index
  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#121212]/95 backdrop-blur-xl flex flex-col p-6 text-white overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between max-w-4xl w-full mx-auto pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded bg-[#282828] overflow-hidden flex-shrink-0">
            {currentTrack?.cover_url && (
              <img src={currentTrack.cover_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold truncate">{currentTrack?.title}</h2>
            <p className="text-sm text-spotify-gray">{currentTrack?.artist}</p>
          </div>
        </div>
        <button
          onClick={toggleLyrics}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Lyrics Content */}
      <div className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto py-12 px-4 flex flex-col gap-6 text-center select-text">
        {loading ? (
          <div className="m-auto text-spotify-gray flex items-center gap-2">
            <Mic2 className="w-6 h-6 animate-pulse text-spotify-green" />
            <span>Finding synchronized lyrics...</span>
          </div>
        ) : lyrics.length > 0 ? (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            return (
              <p
                key={idx}
                ref={isActive ? activeLineRef : null}
                className={`text-2xl md:text-3xl font-extrabold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'text-white scale-105'
                    : isPast
                      ? 'text-white/40'
                      : 'text-white/20 hover:text-white/60'
                }`}
              >
                {line.text}
              </p>
            );
          })
        ) : plainLyrics ? (
          <div className="whitespace-pre-line text-xl leading-relaxed text-white/80">
            {plainLyrics}
          </div>
        ) : (
          <div className="m-auto text-spotify-gray">
            <p className="text-lg">No synced lyrics available for this track.</p>
            <p className="text-sm mt-1 text-white/40">Enjoy the music!</p>
          </div>
        )}
      </div>
    </div>
  );
};
