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
      <div className="flex flex-col items-center">
        <div className="relative flex items-end justify-center">
          {/* Glow circle behind building */}
          <div
            className="absolute rounded-full transition-all duration-2000"
            style={{
              width: '275px',
              height: '275px',
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
              width: '225px',
              height: '225px',
              top: '-40px',
              backgroundColor: `${kingColor}33`,
              borderColor: `${kingColor}88`,
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
              background: `radial-gradient(circle, ${queenColor}cc 0%, ${queenColor}44 45%, transparent 70%)`,
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
              backgroundColor: `${queenColor}33`,
              borderColor: `${queenColor}88`,
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
