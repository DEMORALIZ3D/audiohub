import { Check, Clock, Moon, X } from 'lucide-react';
import type React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { sleepTimerMode, sleepTimerRemaining, setSleepTimer } = usePlayer();

  if (!isOpen) return null;

  const options: { label: string; value: number | 'end_of_track' | null }[] = [
    { label: 'Turn Off Timer', value: null },
    { label: '5 Minutes', value: 5 },
    { label: '15 Minutes', value: 15 },
    { label: '30 Minutes', value: 30 },
    { label: '45 Minutes', value: 45 },
    { label: '1 Hour', value: 60 },
    { label: 'End of Current Track', value: 'end_of_track' },
  ];

  const handleSelect = (value: number | 'end_of_track' | null) => {
    setSleepTimer(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Moon className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">Sleep Timer</h3>
              <p className="text-[11px] text-spotify-gray">
                {sleepTimerRemaining !== null
                  ? `Active: ${formatTime(sleepTimerRemaining)} remaining`
                  : sleepTimerMode === 'end_of_track'
                    ? 'Active: Stopping at end of track'
                    : 'Stops music with smooth fade-out'}
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

        {/* Options List */}
        <div className="p-3 space-y-1">
          {options.map((opt, idx) => {
            const isSelected =
              opt.value === sleepTimerMode || (opt.value === null && sleepTimerMode === null);

            return (
              <button
                key={idx}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-spotify-green/15 text-spotify-green border border-spotify-green/30'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${isSelected ? 'text-spotify-green' : 'text-spotify-gray'}`}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
