import type React from 'react';

interface DancingBarsProps {
  isPlaying?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DancingBars: React.FC<DancingBarsProps> = ({
  isPlaying = true,
  color = '#1ed760',
  size = 'md',
  className = '',
}) => {
  const heightClass = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';
  const widthClass = size === 'sm' ? 'w-0.5' : size === 'lg' ? 'w-1' : 'w-0.5';

  return (
    <div className={`flex items-end gap-0.5 ${heightClass} ${className}`}>
      <span
        className={`${widthClass} rounded-full bg-current transition-all duration-150 ${
          isPlaying ? 'animate-equalizer-1' : 'h-1'
        }`}
        style={{ color, height: isPlaying ? undefined : '30%' }}
      />
      <span
        className={`${widthClass} rounded-full bg-current transition-all duration-150 ${
          isPlaying ? 'animate-equalizer-2' : 'h-2'
        }`}
        style={{ color, height: isPlaying ? undefined : '80%' }}
      />
      <span
        className={`${widthClass} rounded-full bg-current transition-all duration-150 ${
          isPlaying ? 'animate-equalizer-3' : 'h-1.5'
        }`}
        style={{ color, height: isPlaying ? undefined : '50%' }}
      />
      <span
        className={`${widthClass} rounded-full bg-current transition-all duration-150 ${
          isPlaying ? 'animate-equalizer-4' : 'h-2.5'
        }`}
        style={{ color, height: isPlaying ? undefined : '100%' }}
      />
    </div>
  );
};
