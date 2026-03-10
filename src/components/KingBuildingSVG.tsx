'use client';

interface KingBuildingSVGProps {
  className?: string;
}

export default function KingBuildingSVG({ className }: KingBuildingSVGProps) {
  return (
    <svg
      viewBox="0 0 100 280"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="King Building silhouette"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Base */}
        <line x1="15" y1="240" x2="85" y2="240" strokeWidth="2" />

        {/* Uniform tower body outline */}
        <rect x="25" y="45" width="50" height="195" />

        {/* Horizontal floor lines */}
        <line x1="25" y1="58" x2="75" y2="58" />
        <line x1="25" y1="71" x2="75" y2="71" />
        <line x1="25" y1="84" x2="75" y2="84" />
        <line x1="25" y1="97" x2="75" y2="97" />
        <line x1="25" y1="110" x2="75" y2="110" />
        <line x1="25" y1="123" x2="75" y2="123" />
        <line x1="25" y1="136" x2="75" y2="136" />
        <line x1="25" y1="149" x2="75" y2="149" />
        <line x1="25" y1="162" x2="75" y2="162" />
        <line x1="25" y1="175" x2="75" y2="175" />
        <line x1="25" y1="188" x2="75" y2="188" />
        <line x1="25" y1="201" x2="75" y2="201" />
        <line x1="25" y1="214" x2="75" y2="214" />
        <line x1="25" y1="227" x2="75" y2="227" />

        {/* Central vertical spine */}
        <line x1="50" y1="45" x2="50" y2="240" strokeWidth="1.5" />

        {/* King crown - sharp, geometric with spire */}
        {/* Crown base rectangle */}
        <rect x="37" y="28" width="26" height="18" />
        
        {/* Horizontal lines on crown */}
        <line x1="37" y1="35" x2="63" y2="35" />
        
        {/* Central square feature */}
        <rect x="43" y="30" width="14" height="8" />
        <line x1="43" y1="34" x2="57" y2="34" />
        
        {/* Sharp spire - tall rectangular antenna */}
        <rect x="47" y="12" width="6" height="16" />
        <line x1="45" y1="12" x2="55" y2="12" strokeWidth="1" />
        <line x1="50" y1="8" x2="50" y2="12" strokeWidth="2" />
      </g>
    </svg>
  );
}
