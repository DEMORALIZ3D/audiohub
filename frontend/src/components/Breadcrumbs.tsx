import { ArrowLeft, ChevronRight, Compass, Home } from 'lucide-react';
import type React from 'react';
import type { TabType } from '../types';

export interface BreadcrumbItem {
  label: string;
  tab?: TabType;
  id?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  backLabel?: string;
  onBack?: () => void;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  backLabel,
  onBack,
  className = '',
}) => {
  const handleItemClick = (item: BreadcrumbItem) => {
    if (item.onClick) {
      item.onClick();
      return;
    }
    if (item.tab) {
      window.dispatchEvent(
        new CustomEvent('audiohub:navigate', {
          detail: { tab: item.tab, id: item.id || null },
        }),
      );
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Default fallback: Go to previous item in breadcrumb trail if exists
    if (items.length > 1) {
      const prev = items[items.length - 2];
      handleItemClick(prev);
    } else {
      window.dispatchEvent(
        new CustomEvent('audiohub:navigate', {
          detail: { tab: 'home', id: null },
        }),
      );
    }
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-xs md:text-sm select-none py-2 px-4 md:px-8 overflow-x-auto no-scrollbar ${className}`}
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-white/80 hover:text-white border border-white/5 transition-all text-xs font-semibold flex-shrink-0 group shadow-sm active:scale-95"
        title={backLabel ? `Back to ${backLabel}` : 'Go back'}
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        <span className="hidden sm:inline">{backLabel ? `Back to ${backLabel}` : 'Back'}</span>
        <span className="sm:hidden">Back</span>
      </button>

      <div className="h-4 w-[1px] bg-white/10 mx-1 flex-shrink-0" />

      {/* Crumb trail */}
      <ol className="flex items-center gap-1.5 text-spotify-gray flex-wrap min-w-0">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const isFirst = idx === 0;

          return (
            <li key={idx} className="flex items-center gap-1.5 min-w-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />}
              {isLast ? (
                <span
                  className="font-bold text-white truncate max-w-[160px] sm:max-w-[280px] md:max-w-[420px]"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-1 hover:text-white hover:underline transition-colors truncate max-w-[140px] sm:max-w-[200px]"
                >
                  {isFirst && <Home className="w-3 h-3 text-spotify-green flex-shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
