'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Reason {
  id: string;
  reason_text: string;
  upvotes: number;
  downvotes: number;
  submitted_at: string;
}

interface ReasonsGalleryProps {
  userId: string | null;
  refreshKey: number;
  filterDate?: string;
  forceVotesLocked?: boolean;
}

export default function ReasonsGallery({ userId, refreshKey, filterDate, forceVotesLocked = false }: ReasonsGalleryProps) {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [topReasons, setTopReasons] = useState<Set<string>>(new Set());
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const sortReasons = (list: Reason[], topReasonTexts: Set<string>) =>
    [...list].sort((a, b) => {
      // Top reasons always come first
      const aIsTop = topReasonTexts.has(a.reason_text);
      const bIsTop = topReasonTexts.has(b.reason_text);
      
      if (aIsTop && !bIsTop) return -1;
      if (!aIsTop && bIsTop) return 1;
      
      // For non-top reasons or when both are top, sort by score
      const scoreDiff = (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });

  // Fetch reasons
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('reasons')
          .select('id, reason_text, upvotes, downvotes, submitted_at')
          .eq('is_valid', true)
          .order('submitted_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (fetchError) {
          setError('Failed to load reasons.');
        } else {
          let filtered = (data || []) as Reason[];
          if (filterDate) {
            filtered = filtered.filter((r) => toEasternDateKey(r.submitted_at) === filterDate);
          }
          setReasons(sortReasons(filtered, topReasons));
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load reasons.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, filterDate, topReasons]);

  // Fetch color_history to identify top reasons
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('color_history')
          .select('date, reason')
          .eq('reason_locked', true)
          .not('reason', 'is', null);

        if (cancelled) return;

        if (!fetchError && data) {
          const topReasonTexts = new Set(
            data.map(entry => entry.reason).filter(Boolean)
          );
          setTopReasons(topReasonTexts);
          
          // Only dates explicitly locked by admin top-reason selection
          const dates = new Set(data.map(entry => entry.date).filter(Boolean));
          setLockedDates(dates);
          
          // Re-sort existing reasons with the new top reasons data
          setReasons(prev => sortReasons(prev, topReasonTexts));
        }
      } catch {
        // Silently fail - this is just for display enhancement
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Fetch user's votes
  useEffect(() => {
    if (!userId) {
      setUserVotes({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from('reason_votes_standalone')
        .select('reason_id, vote')
        .eq('user_id', userId);

      if (cancelled || !data) return;

      const votes: Record<string, number> = {};
      for (const v of data) {
        votes[v.reason_id] = v.vote as 1 | -1;
      }
      setUserVotes(votes);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const handleVote = async (reasonId: string, vote: 1 | -1) => {
    if (!userId) return;
    if (forceVotesLocked) return;

    const targetReason = reasons.find((r) => r.id === reasonId);
    if (!targetReason) return;
    
    const reasonDate = toEasternDateKey(targetReason.submitted_at);
    if (isVoteLocked(targetReason.submitted_at) || lockedDates.has(reasonDate)) return;

    const existingVote = userVotes[reasonId];

    // Optimistic update
    setReasons((prev) =>
      sortReasons(
        prev.map((r) => {
          if (r.id !== reasonId) return r;
          let upvotes = r.upvotes;
          let downvotes = r.downvotes;

          // Remove existing vote first
          if (existingVote === 1) {
            upvotes -= 1;
          } else if (existingVote === -1) {
            downvotes -= 1;
          }

          // Only add new vote if it's different from existing
          if (existingVote !== vote) {
            if (vote === 1) {
              upvotes += 1;
            } else if (vote === -1) {
              downvotes += 1;
            }
          }

          return { ...r, upvotes, downvotes };
        }),
        topReasons
      )
    );

    try {
      if (existingVote === vote) {
        // Remove the vote
        setUserVotes((prev) => {
          const next = { ...prev };
          delete next[reasonId];
          return next;
        });
        await fetch('/api/reason-votes-standalone', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason_id: reasonId, user_id: userId }),
        });
      } else {
        // Add or update the vote
        setUserVotes((prev) => ({ ...prev, [reasonId]: vote }));
        await fetch('/api/reason-votes-standalone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason_id: reasonId, user_id: userId, vote }),
        });
      }
    } catch (err) {
      console.error('Vote error:', err);
      // Revert optimistic update on error
      const { data } = await supabase
        .from('reasons')
        .select('id, reason_text, upvotes, downvotes, submitted_at')
        .eq('is_valid', true)
        .order('submitted_at', { ascending: false })
        .limit(50);
      if (data) {
        setReasons(sortReasons(data as Reason[], topReasons));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-500 animate-pulse">Loading reasons…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (reasons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">💭</p>
        <p className="text-gray-400 font-medium">No reasons yet.</p>
        <p className="text-gray-600 text-sm mt-1">Share your thoughts about these colors!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reasons.map((reason) => {
        const userVote = userVotes[reason.id];
        const isLocked = isVoteLocked(reason.submitted_at);
        const isTopReason = topReasons.has(reason.reason_text);
        const reasonDate = toEasternDateKey(reason.submitted_at);
        const isDateLocked = lockedDates.has(reasonDate);

        return (
          <div
            key={reason.id}
            className={`bg-white/80 dark:bg-gray-800 border rounded-lg p-4 transition-colors ${
              isTopReason
                ? 'border-yellow-400 dark:border-yellow-600 ring-2 ring-yellow-400/20 dark:ring-yellow-600/20'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-gray-900 dark:text-gray-100 flex-1">{reason.reason_text}</p>
              {isTopReason && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                  ⭐ Top
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleVote(reason.id, 1)}
                disabled={forceVotesLocked || isLocked || !userId || isDateLocked}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  userVote === 1
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-200 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                👍 {reason.upvotes}
              </button>
              <button
                onClick={() => handleVote(reason.id, -1)}
                disabled={forceVotesLocked || isLocked || !userId || isDateLocked}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  userVote === -1
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-200 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                👎 {reason.downvotes}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                {new Date(reason.submitted_at).toLocaleDateString()} {new Date(reason.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
