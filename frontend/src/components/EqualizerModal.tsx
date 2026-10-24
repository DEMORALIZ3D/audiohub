import { ShieldCheck, Sliders, Volume2, X } from 'lucide-react';
import type React from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { EQBands, EQPreset } from '../types';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_LABELS: { id: EQPreset; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'bass_boost', label: 'Bass Boost' },
  { id: 'vocal', label: 'Vocal Booster' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'rock', label: 'Rock' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'night', label: 'Night Mode' },
];

const BANDS_CONFIG: { key: keyof EQBands; label: string; freq: string }[] = [
  { key: 'bass', label: 'Bass', freq: '60 Hz' },
  { key: 'lowMid', label: 'Low-Mid', freq: '250 Hz' },
  { key: 'mid', label: 'Mid', freq: '1 kHz' },
  { key: 'highMid', label: 'High-Mid', freq: '4 kHz' },
  { key: 'treble', label: 'Treble', freq: '12 kHz' },
];

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const {
    isEQEnabled,
    setIsEQEnabled,
    eqPreset,
    setEQPreset,
    eqBands,
    setEQBand,
    isNormalizationEnabled,
    setIsNormalizationEnabled,
  } = usePlayer();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">
                Audio Equalizer & Processing
              </h3>
              <p className="text-[11px] text-spotify-gray">Web Audio API • Real-time processing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Toggles Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* EQ Master Toggle */}
            <div
              onClick={() => setIsEQEnabled(!isEQEnabled)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                isEQEnabled
                  ? 'border-spotify-green bg-spotify-green/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders
                  className={`w-4 h-4 ${isEQEnabled ? 'text-spotify-green' : 'text-spotify-gray'}`}
                />
                <span className="text-xs font-bold text-white">Equalizer</span>
              </div>
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  isEQEnabled ? 'bg-spotify-green' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black shadow transition-transform ${
                    isEQEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Normalization Master Toggle */}
            <div
              onClick={() => setIsNormalizationEnabled(!isNormalizationEnabled)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                isNormalizationEnabled
                  ? 'border-spotify-green bg-spotify-green/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Volume2
                  className={`w-4 h-4 ${isNormalizationEnabled ? 'text-spotify-green' : 'text-spotify-gray'}`}
                />
                <div>
                  <span className="text-xs font-bold text-white block">Normalize Volume</span>
                  <span className="text-[10px] text-spotify-gray block">Equal loudness</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  isNormalizationEnabled ? 'bg-spotify-green' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black shadow transition-transform ${
                    isNormalizationEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Presets Chips */}
          <div>
            <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider block mb-2.5">
              Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_LABELS.map((p) => (
                <button
                  key={p.id}
                  disabled={!isEQEnabled}
                  onClick={() => setEQPreset(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none ${
                    eqPreset === p.id && isEQEnabled
                      ? 'bg-spotify-green text-black font-bold'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5-Band Slider Board */}
          <div
            className={`space-y-4 transition-opacity ${isEQEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
          >
            <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider block">
              Frequency Sliders
            </span>
            <div className="grid grid-cols-5 gap-2 text-center pt-2">
              {BANDS_CONFIG.map((b) => {
                const val = eqBands[b.key];
                return (
                  <div key={b.key} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-bold text-spotify-green">
                      {val > 0 ? `+${val}` : val} dB
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={val}
                      onChange={(e) => setEQBand(b.key, parseFloat(e.target.value))}
                      className="h-28 w-2 appearance-none bg-white/20 rounded-lg outline-none accent-spotify-green [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                    />
                    <div className="mt-1">
                      <span className="text-xs font-bold text-white block">{b.label}</span>
                      <span className="text-[10px] text-spotify-gray block">{b.freq}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
