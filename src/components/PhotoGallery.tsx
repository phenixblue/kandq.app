'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Photo, UserVotes } from '@/types';
import PhotoCard from './PhotoCard';

interface PhotoGalleryProps {
  userId: string | null;
  refreshKey: number;
  onColorsUpdate?: (kingColor: string, queenColor: string) => void;
  filterDate?: string;
  forceVotesLocked?: boolean;
}

export default function PhotoGallery({ userId, refreshKey, onColorsUpdate, filterDate, forceVotesLocked = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();

    const timer = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isVoteLocked = (submittedAt: string) => {
    if (!nowMs) return false;
    const submittedMs = new Date(submittedAt).getTime();
    return nowMs - submittedMs > 24 * 60 * 60 * 1000;
  };

  const toEasternDateKey = (timestamp: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));

  const sortPhotos = (list: Photo[]) =>
    [...list].sort((a, b) => {
      if (b.vote_score !== a.vote_score) {
        return b.vote_score - a.vote_score;
      }
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let query = supabase
        .from('photos')
        .select('*')
        .eq('is_valid', true);

      // Filter by date if provided
      if (filterDate) {
        const startDate = `${filterDate}T00:00:00Z`;
        const endDate = `${filterDate}T23:59:59Z`;
        query = query
          .gte('submitted_at', startDate)
          .lte('submitted_at', endDate);
      }

      const { data, error: fetchError } = await query
        .order('vote_score', { ascending: false })
        .order('submitted_at', { ascending: false })
        .limit(30);

      if (cancelled) return;

      if (fetchError) {
        setError('Failed to load photos. Please try again.');
      } else {
        const photoList = sortPhotos((data || []) as Photo[]);
        setPhotos(photoList);
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, onColorsUpdate, retryKey, filterDate]);

  useEffect(() => {
    if (!onColorsUpdate || photos.length === 0) return;
    const top = photos[0];
    if (top.king_color && top.queen_color) {
      onColorsUpdate(top.king_color, top.queen_color);
    }
  }, [photos, onColorsUpdate]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('color_history')
          .select('date, photo_id')
          .eq('photo_locked', true)
          .not('photo_id', 'is', null);

        if (cancelled) return;

        if (!fetchError && data) {
          // Only dates explicitly locked by admin top-photo selection
          const dates = new Set(data.map(entry => entry.date).filter(Boolean));
          setLockedDates(dates);
        }
      } catch {
        // Silently fail - this is just for display enhancement
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
    if (forceVotesLocked) return;

    const targetPhoto = photos.find((photo) => photo.id === photoId);
    if (!targetPhoto) return;
    
    const photoDate = toEasternDateKey(targetPhoto.submitted_at);
    if (isVoteLocked(targetPhoto.submitted_at) || lockedDates.has(photoDate)) return;

    const existingVote = userVotes[photoId];

    // Optimistic update
    setPhotos((prev) =>
      sortPhotos(
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
      )
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
            sortPhotos(
              prev.map((p) => (p.id === photoId ? { ...p, vote_score: result.vote_score } : p))
            )
          );
        }
      }
    } catch (err) {
      console.error('Vote error:', err);
      // Revert optimistic update on error
      let query = supabase
        .from('photos')
        .select('*')
        .eq('is_valid', true);

      if (filterDate) {
        const startDate = `${filterDate}T00:00:00Z`;
        const endDate = `${filterDate}T23:59:59Z`;
        query = query
          .gte('submitted_at', startDate)
          .lte('submitted_at', endDate);
      }

      const { data } = await query
        .order('vote_score', { ascending: false })
        .order('submitted_at', { ascending: false })
        .limit(30);
      if (data) {
        setPhotos(sortPhotos(data as Photo[]));
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
      {photos.map((photo) => {
        const photoDate = toEasternDateKey(photo.submitted_at);
        return (
          <PhotoCard
            key={photo.id}
            photo={photo}
            userVote={userVotes[photo.id]}
            onVote={handleVote}
            isLoggedIn={Boolean(userId)}
            votesLocked={forceVotesLocked || isVoteLocked(photo.submitted_at) || lockedDates.has(photoDate)}
          />
        );
      })}
    </div>
  );
}

