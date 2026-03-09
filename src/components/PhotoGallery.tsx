'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Photo, UserVotes } from '@/types';
import PhotoCard from './PhotoCard';

interface PhotoGalleryProps {
  userId: string | null;
  refreshKey: number;
  onColorsUpdate?: (kingColor: string, queenColor: string) => void;
}

export default function PhotoGallery({ userId, refreshKey, onColorsUpdate }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error: fetchError } = await supabase
        .from('photos')
        .select('*')
        .eq('is_valid', true)
        .order('vote_score', { ascending: false })
        .order('submitted_at', { ascending: false })
        .limit(30);

      if (cancelled) return;

      if (fetchError) {
        setError('Failed to load photos. Please try again.');
      } else {
        const photoList = (data || []) as Photo[];
        setPhotos(photoList);
        setError(null);
        if (photoList.length > 0 && onColorsUpdate) {
          const top = photoList[0];
          if (top.king_color && top.queen_color) {
            onColorsUpdate(top.king_color, top.queen_color);
          }
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, onColorsUpdate, retryKey]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from('votes')
        .select('photo_id, vote')
        .eq('user_id', userId);

      if (cancelled || !data) return;

      const votes: UserVotes = {};
      for (const v of data) {
        votes[v.photo_id] = v.vote as 1 | -1;
      }
      setUserVotes(votes);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const handleVote = async (photoId: string, vote: 1 | -1) => {
    if (!userId) return;

    const existingVote = userVotes[photoId];

    // Optimistic update
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;
        let delta: number = vote;
        if (existingVote === vote) {
          delta = -vote as number;
        } else if (existingVote) {
          delta = vote * 2;
        }
        return { ...p, vote_score: p.vote_score + delta };
      })
    );

    try {
      if (existingVote === vote) {
        // Remove the vote
        setUserVotes((prev) => {
          const next = { ...prev };
          delete next[photoId];
          return next;
        });
        await fetch('/api/votes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_id: photoId, user_id: userId }),
        });
      } else {
        // Add or update the vote
        setUserVotes((prev) => ({ ...prev, [photoId]: vote }));
        const response = await fetch('/api/votes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_id: photoId, user_id: userId, vote }),
        });
        const result = await response.json();
        if (response.ok && result.vote_score !== undefined) {
          // Update the photo with the server-calculated vote_score
          setPhotos((prev) =>
            prev.map((p) => (p.id === photoId ? { ...p, vote_score: result.vote_score } : p))
          );
        }
      }
    } catch (err) {
      console.error('Vote error:', err);
      // Revert optimistic update on error
      const { data } = await supabase
        .from('photos')
        .select('*')
        .eq('is_valid', true)
        .order('vote_score', { ascending: false })
        .limit(30);
      if (data) {
        setPhotos(data as Photo[]);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-500 animate-pulse">Loading submissions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="mt-3 text-sm text-purple-400 hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🌃</p>
        <p className="text-gray-400 font-medium">No submissions yet.</p>
        <p className="text-gray-600 text-sm mt-1">Be the first to submit a photo!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          userVote={userVotes[photo.id]}
          onVote={handleVote}
          isLoggedIn={Boolean(userId)}
        />
      ))}
    </div>
  );
}
