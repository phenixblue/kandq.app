'use client';

interface KingBuildingSVGProps {
  className?: string;
}

export default function KingBuildingSVG({ className }: KingBuildingSVGProps) {
  return (
    <svg
      viewBox="0 0 160 340"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="King Building silhouette"
    >
      <g fill="currentColor">
        {/* Base / podium */}
        <rect x="18" y="295" width="124" height="45" />

        {/* Lower body */}
        <rect x="28" y="215" width="104" height="85" />

        {/* Setback ledge */}
        <rect x="22" y="208" width="116" height="10" rx="1" />

        {/* Mid body */}
        <rect x="38" y="140" width="84" height="72" />

        {/* Setback ledge 2 */}
        <rect x="32" y="133" width="96" height="10" rx="1" />

        {/* Upper body */}
        <rect x="50" y="82" width="60" height="55" />

        {/* Crown base */}
        <rect x="46" y="74" width="68" height="12" rx="1" />

        {/* Left spire */}
        <polygon points="52,74 57,38 62,74" />

        {/* Center-left spire */}
        <polygon points="66,74 71,24 76,74" />

        {/* Center spire (tallest) */}
        <polygon points="76,74 80,8 84,74" />

        {/* Center-right spire */}
        <polygon points="84,74 89,26 94,74" />

        {/* Right spire */}
        <polygon points="98,74 103,42 108,74" />

        {/* Antenna atop center spire */}
        <rect x="79" y="0" width="2" height="12" />
      </g>
    </svg>
  );
}
