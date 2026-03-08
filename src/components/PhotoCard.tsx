'use client';

import { Photo, UserVotes } from '@/types';

interface PhotoCardProps {
  photo: Photo;
  userVote: 1 | -1 | undefined;
  onVote: (photoId: string, vote: 1 | -1) => void;
  isLoggedIn: boolean;
}

export default function PhotoCard({ photo, userVote, onVote, isLoggedIn }: PhotoCardProps) {
  const submittedAt = new Date(photo.submitted_at);
  const dateStr = submittedAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = submittedAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex flex-col">
      {/* Photo */}
      <div className="relative aspect-video bg-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt="King and Queen buildings submission"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Color chips overlay */}
        <div className="absolute top-2 right-2 flex gap-1.5">
          {photo.king_color && (
            <div
              className="w-5 h-5 rounded-full border-2 border-white/40 shadow"
              style={{ backgroundColor: photo.king_color }}
              title={`King: ${photo.king_color}`}
            />
          )}
          {photo.queen_color && (
            <div
              className="w-5 h-5 rounded-full border-2 border-white/40 shadow"
              style={{ backgroundColor: photo.queen_color }}
              title={`Queen: ${photo.queen_color}`}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {dateStr} · {timeStr}
        </div>

        {/* Voting */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => isLoggedIn && onVote(photo.id, 1)}
            disabled={!isLoggedIn}
            aria-label="Upvote"
            className={`p-1.5 rounded-lg transition-colors ${
              userVote === 1
                ? 'bg-green-700 text-white'
                : 'text-gray-400 hover:text-green-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            ▲
          </button>
          <span
            className={`text-sm font-semibold w-6 text-center ${
              photo.vote_score > 0
                ? 'text-green-400'
                : photo.vote_score < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {photo.vote_score}
          </span>
          <button
            onClick={() => isLoggedIn && onVote(photo.id, -1)}
            disabled={!isLoggedIn}
            aria-label="Downvote"
            className={`p-1.5 rounded-lg transition-colors ${
              userVote === -1
                ? 'bg-red-700 text-white'
                : 'text-gray-400 hover:text-red-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export for convenience
export type { UserVotes };
