'use client';

interface QueenBuildingSVGProps {
  className?: string;
}

export default function QueenBuildingSVG({ className }: QueenBuildingSVGProps) {
  return (
    <svg
      viewBox="0 0 100 280"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Queen Building silhouette"
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

        {/* Queen crown - rounded dome with vertical lines */}
        {/* Crown base rectangle */}
        <rect x="37" y="32" width="26" height="14" />
        
        {/* Rounded dome top */}
        <path d="M 37 32 Q 37 18 50 15 Q 63 18 63 32" strokeLinecap="round" />
        
        {/* Vertical ribs on dome */}
        <line x1="42" y1="25" x2="42" y2="32" />
        <line x1="50" y1="18" x2="50" y2="32" />
        <line x1="58" y1="25" x2="58" y2="32" />
        
        {/* Horizontal band on crown */}
        <line x1="37" y1="37" x2="63" y2="37" />
        
        {/* Central spire - finial on top */}
        <line x1="50" y1="15" x2="50" y2="8" strokeWidth="2" />
        <circle cx="50" cy="6" r="1.5" />
      </g>
    </svg>
  );
}
