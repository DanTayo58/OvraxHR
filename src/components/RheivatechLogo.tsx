import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface RheivatechLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtext?: boolean;
  animated?: boolean;
  theme?: 'light' | 'dark';
}

export const RheivatechLogo: React.FC<RheivatechLogoProps> = ({
  size = 'md',
  showSubtext = true,
  animated = false,
  theme,
}) => {
  const [imgSrc, setImgSrc] = useState('/logo.svg');
  const [imgError, setImgError] = useState(false);

  const handleImageError = () => {
    if (imgSrc === '/logo.svg') {
      setImgSrc('/logo.png');
    } else if (imgSrc === '/logo.png') {
      setImgSrc('/rheivatech-logo.png');
    } else {
      setImgError(true);
    }
  };

  const sizeMap = {
    sm: { img: 'w-8 h-8', title: 'text-lg', sub: 'text-[10px]', icon: 'w-4 h-4' },
    md: { img: 'w-10 h-10', title: 'text-2xl', sub: 'text-[11px]', icon: 'w-5 h-5' },
    lg: { img: 'w-14 h-14', title: 'text-3xl', sub: 'text-xs', icon: 'w-7 h-7' },
    xl: { img: 'w-20 h-20', title: 'text-4xl', sub: 'text-sm', icon: 'w-10 h-10' },
  };

  const dim = sizeMap[size];

  const titleColor =
    theme === 'light'
      ? 'text-slate-900'
      : theme === 'dark'
      ? 'text-white'
      : 'text-slate-900 dark:text-white';

  const badgeClass =
    theme === 'light'
      ? 'bg-blue-100/90 text-blue-700 border-blue-200'
      : theme === 'dark'
      ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
      : 'bg-blue-100/90 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/25';

  const subtextColor =
    theme === 'light'
      ? 'text-slate-600'
      : theme === 'dark'
      ? 'text-slate-400'
      : 'text-slate-600 dark:text-slate-400';

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative group shrink-0">
        <div
          className={`${dim.img} rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex items-center justify-center border border-slate-200 dark:border-blue-500/30 relative p-1 transition-all duration-300 group-hover:border-blue-500/50`}
        >
          {!imgError ? (
            <img
              src={imgSrc}
              alt="OvraxHR Logo"
              onError={handleImageError}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-contain ${animated ? 'animate-pulse' : ''}`}
            />
          ) : (
            <svg
              viewBox="0 0 500 500"
              className={`w-full h-full ${animated ? 'animate-pulse' : ''}`}
            >
              <defs>
                <linearGradient id="rheivaBlueFallback" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e64a7" />
                  <stop offset="100%" stopColor="#164e86" />
                </linearGradient>
              </defs>
              <g fill="none" stroke="#ffffff" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 135 375 A 50 50 0 1 1 165 440 A 50 50 0 0 1 135 375 C 95 320 100 210 145 140 A 25 25 0 0 1 185 170 C 145 230 145 310 185 365" />
                <path d="M 170 50 C 270 15 420 25 435 150 C 445 250 350 240 255 260 L 395 445 A 25 25 0 0 1 355 475 L 210 280 C 310 250 380 230 375 150 C 365 75 250 65 170 105 A 25 25 0 0 1 170 50 Z" />
              </g>
              <g fill="url(#rheivaBlueFallback)" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 150 350 A 40 40 0 1 1 150 430 A 40 40 0 0 1 150 350 Z M 150 370 A 20 20 0 1 0 150 410 A 20 20 0 0 0 150 370 Z" />
                <circle cx="150" cy="390" r="18" />
                <path d="M 170 55 C 265 20 410 30 425 145 C 435 235 345 225 255 250 L 390 430 A 18 18 0 0 1 360 455 L 220 270 C 315 240 375 220 370 145 C 360 75 250 65 170 100 Z" />
              </g>
            </svg>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-extrabold tracking-tight ${titleColor} ${dim.title} font-sans`}>
            OvraxHR
          </span>
          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border ${badgeClass}`}>
            HR Aid Suite
          </span>
        </div>
        {showSubtext && (
          <span className={`font-mono tracking-wider uppercase font-medium ${subtextColor} ${dim.sub}`}>
            Full HR Aid & Attendance System
          </span>
        )}
      </div>
    </div>
  );
};
