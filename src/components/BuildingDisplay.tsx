'use client';

import KingBuildingSVG from './KingBuildingSVG';
import QueenBuildingSVG from './QueenBuildingSVG';
import { useTheme } from './ThemeProvider';

interface BuildingDisplayProps {
  kingColor: string;
  queenColor: string;
}

function isNearWhite(color: string) {
  const hex = color.trim().replace('#', '');
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return false;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return r >= 240 && g >= 240 && b >= 240;
}

export default function BuildingDisplay({ kingColor, queenColor }: BuildingDisplayProps) {
  const { theme } = useTheme();
  const kingIsNearWhiteInLight = theme === 'light' && isNearWhite(kingColor);
  const queenIsNearWhiteInLight = theme === 'light' && isNearWhite(queenColor);

  const kingGlowBackground = kingIsNearWhiteInLight
    ? 'radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(148,163,184,0.42) 45%, transparent 70%)'
    : `radial-gradient(circle, ${kingColor}cc 0%, ${kingColor}44 45%, transparent 70%)`;

  const queenGlowBackground = queenIsNearWhiteInLight
    ? 'radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(148,163,184,0.42) 45%, transparent 70%)'
    : `radial-gradient(circle, ${queenColor}cc 0%, ${queenColor}44 45%, transparent 70%)`;

  const kingInnerBackground = kingIsNearWhiteInLight ? 'rgba(148, 163, 184, 0.18)' : `${kingColor}33`;
  const queenInnerBackground = queenIsNearWhiteInLight ? 'rgba(148, 163, 184, 0.18)' : `${queenColor}33`;

  const kingBorderColor = theme === 'light' && isNearWhite(kingColor) ? '#111111cc' : `${kingColor}88`;
  const queenBorderColor = theme === 'light' && isNearWhite(queenColor) ? '#111111cc' : `${queenColor}88`;

  return (
    <div className="flex items-end justify-center gap-12 md:gap-24 w-full px-4">
      {/* King Building */}
      <div className="flex flex-col items-center">
        <div className="relative flex items-end justify-center">
          {/* Glow circle behind building */}
          <div
            className="absolute rounded-full transition-all duration-2000"
            style={{
              width: '275px',
              height: '275px',
              top: '-50px',
              background: kingGlowBackground,
              filter: 'blur(8px)',
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          <div
            className="absolute rounded-full border-2 transition-all duration-2000"
            style={{
              width: '225px',
              height: '225px',
              top: '-40px',
              backgroundColor: kingInnerBackground,
              borderColor: kingBorderColor,
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          {/* Building silhouette */}
          <KingBuildingSVG className="relative z-10 w-[13.5rem] md:w-[18rem] text-gray-900 dark:text-gray-700 drop-shadow-lg" />
        </div>
      </div>

      {/* Queen Building */}
      <div className="flex flex-col items-center">
        <div className="relative flex items-end justify-center">
          {/* Glow circle behind building */}
          <div
            className="absolute rounded-full transition-all duration-2000"
            style={{
              width: '275px',
              height: '275px',
              top: '-50px',
              background: queenGlowBackground,
              filter: 'blur(8px)',
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          <div
            className="absolute rounded-full border-2 transition-all duration-2000"
            style={{
              width: '225px',
              height: '225px',
              top: '-40px',
              backgroundColor: queenInnerBackground,
              borderColor: queenBorderColor,
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          {/* Building silhouette */}
          <QueenBuildingSVG className="relative z-10 w-[13.5rem] md:w-[18rem] text-gray-900 dark:text-gray-700 drop-shadow-lg" />
        </div>
      </div>
    </div>
  );
}
