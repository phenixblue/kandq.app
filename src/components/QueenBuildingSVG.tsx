'use client';

interface QueenBuildingSVGProps {
  className?: string;
}

export default function QueenBuildingSVG({ className }: QueenBuildingSVGProps) {
  return (
    <svg
      viewBox="0 0 160 340"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Queen Building silhouette"
    >
      <g fill="currentColor">
        {/* Base / podium */}
        <rect x="18" y="300" width="124" height="40" />

        {/* Lower body */}
        <rect x="26" y="225" width="108" height="80" />

        {/* Setback ledge */}
        <rect x="20" y="218" width="120" height="10" rx="1" />

        {/* Mid body */}
        <rect x="36" y="150" width="88" height="72" />

        {/* Setback ledge 2 */}
        <rect x="30" y="143" width="100" height="10" rx="1" />

        {/* Upper body */}
        <rect x="46" y="92" width="68" height="55" />

        {/* Crown base rectangle */}
        <rect x="46" y="82" width="68" height="14" rx="1" />

        {/* Crown - smooth arched dome */}
        <path d="M46,82 L46,62 Q80,18 114,62 L114,82 Z" />

        {/* Inner arch detail (decorative opening) */}
        <path
          d="M60,82 L60,68 Q80,44 100,68 L100,82 Z"
          fill="none"
          className="stroke-current"
          strokeWidth="3"
        />

        {/* Small finial atop arch */}
        <rect x="78" y="16" width="4" height="6" rx="1" />
        <polygon points="78,16 80,8 82,16" />
      </g>
    </svg>
  );
}
