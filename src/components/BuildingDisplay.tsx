'use client';

import KingBuildingSVG from './KingBuildingSVG';
import QueenBuildingSVG from './QueenBuildingSVG';

interface BuildingDisplayProps {
  kingColor: string;
  queenColor: string;
}

export default function BuildingDisplay({ kingColor, queenColor }: BuildingDisplayProps) {
  return (
    <div className="flex items-end justify-center gap-12 md:gap-24 w-full px-4">
      {/* King Building */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-end justify-center">
          {/* Glow circle behind building */}
          <div
            className="absolute rounded-full transition-all duration-2000"
            style={{
              width: '220px',
              height: '220px',
              top: '-50px',
              background: `radial-gradient(circle, ${kingColor}cc 0%, ${kingColor}44 45%, transparent 70%)`,
              filter: 'blur(8px)',
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          <div
            className="absolute rounded-full border-2 transition-all duration-2000"
            style={{
              width: '180px',
              height: '180px',
              top: '-40px',
              backgroundColor: `${kingColor}33`,
              borderColor: `${kingColor}88`,
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          {/* Building silhouette */}
          <KingBuildingSVG className="relative z-10 w-36 md:w-48 text-gray-900 dark:text-gray-700 drop-shadow-lg" />
        </div>
        <span className="text-sm font-semibold tracking-widest uppercase text-gray-400">
          King
        </span>
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg transition-all duration-2000"
          style={{ backgroundColor: kingColor }}
          title={`Current light color: ${kingColor}`}
        />
      </div>

      {/* Queen Building */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-end justify-center">
          {/* Glow circle behind building */}
          <div
            className="absolute rounded-full transition-all duration-2000"
            style={{
              width: '220px',
              height: '220px',
              top: '-50px',
              background: `radial-gradient(circle, ${queenColor}cc 0%, ${queenColor}44 45%, transparent 70%)`,
              filter: 'blur(8px)',
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          <div
            className="absolute rounded-full border-2 transition-all duration-2000"
            style={{
              width: '180px',
              height: '180px',
              top: '-40px',
              backgroundColor: `${queenColor}33`,
              borderColor: `${queenColor}88`,
              transform: 'translateX(-50%)',
              left: '50%',
            }}
          />
          {/* Building silhouette */}
          <QueenBuildingSVG className="relative z-10 w-36 md:w-48 text-gray-900 dark:text-gray-700 drop-shadow-lg" />
        </div>
        <span className="text-sm font-semibold tracking-widest uppercase text-gray-400">
          Queen
        </span>
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg transition-all duration-2000"
          style={{ backgroundColor: queenColor }}
          title={`Current light color: ${queenColor}`}
        />
      </div>
    </div>
  );
}
