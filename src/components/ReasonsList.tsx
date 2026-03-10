'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Reason {
  text: string;
  score: number;
  upvotes: number;
  downvotes: number;
  photoId: string;
  submittedAt: string;
  earliestSubmittedAt: string;
}

interface ReasonsListProps {
  date: string;
  userId: string | null;
}

interface PhotoRow {
  id: string;
  color_reason: string | null;
  reason_vote_score: number;
  submitted_at: string;
}

interface ReasonVoteRow {
  photo_id: string;
  vote: 1 | -1;
  user_id: string;
}

export default function ReasonsList({ date, userId }: ReasonsListProps) {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
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

  useEffect(() => {
    if (!date) {
      setReasons([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        // Get all photos for this date
        const startDate = `${date}T00:00:00Z`;
        const endDate = `${date}T23:59:59Z`;

        const { data: photos, error: photosError } = await supabase
          .from('photos')
          .select('id, color_reason, reason_vote_score, submitted_at')
          .eq('is_valid', true)
          .not('color_reason', 'is', null)
          .gte('submitted_at', startDate)
          .lte('submitted_at', endDate)
          .order('reason_vote_score', { ascending: false });

        if (cancelled) return;

        if (photosError) {
          console.error('Error fetching photos:', photosError);
          setReasons([]);
          setLoading(false);
          return;
        }

        const reasonMap = new Map<string, Reason>();

        if (photos) {
          (photos as PhotoRow[]).forEach((photo) => {
            if (photo.color_reason) {
              const existing = reasonMap.get(photo.color_reason);
              if (existing) {
                existing.score += photo.reason_vote_score;
                // Track the earliest submitted timestamp
                if (photo.submitted_at < existing.earliestSubmittedAt) {
                  existing.earliestSubmittedAt = photo.submitted_at;
                }
              } else {
                reasonMap.set(photo.color_reason, {
                  text: photo.color_reason,
                  score: photo.reason_vote_score,
                  upvotes: 0,
                  downvotes: 0,
                  photoId: photo.id,
                  submittedAt: photo.submitted_at,
                  earliestSubmittedAt: photo.submitted_at,
                });
              }
            }
          });
        }

        const sortedReasons = Array.from(reasonMap.values()).sort((a, b) => b.score - a.score);
        const representativePhotoIds = sortedReasons.map((reason) => reason.photoId);

        if (representativePhotoIds.length > 0) {
          const { data: reasonVotes } = await supabase
            .from('reason_votes')
            .select('photo_id, vote, user_id')
            .in('photo_id', representativePhotoIds);

          const countsByPhotoId: Record<string, { up: number; down: number }> = {};
          representativePhotoIds.forEach((photoId) => {
            countsByPhotoId[photoId] = { up: 0, down: 0 };
          });

          const voteMap: Record<string, number> = {};

          (reasonVotes as ReasonVoteRow[] | null || []).forEach((vote) => {
            const counts = countsByPhotoId[vote.photo_id];
            if (!counts) return;

            if (vote.vote === 1) {
              counts.up += 1;
            } else if (vote.vote === -1) {
              counts.down += 1;
            }

            if (userId && vote.user_id === userId) {
              voteMap[vote.photo_id] = vote.vote;
            }
          });

          setReasons(
            sortedReasons.map((reason) => ({
              ...reason,
              upvotes: countsByPhotoId[reason.photoId]?.up ?? 0,
              downvotes: countsByPhotoId[reason.photoId]?.down ?? 0,
              score: (countsByPhotoId[reason.photoId]?.up ?? 0) - (countsByPhotoId[reason.photoId]?.down ?? 0),
            }))
          );
          setUserVotes(voteMap);
        } else {
          setReasons(sortedReasons);
          setUserVotes({});
        }
      } catch (error) {
        console.error('Error in ReasonsList:', error);
        setReasons([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, userId]);

  const handleVote = async (reason: Reason, vote: 1 | -1) => {
    if (!userId || isVoteLocked(reason.earliestSubmittedAt)) return;

    try {
      const currentVote = userVotes[reason.photoId];

      if (currentVote === vote) {
        // Remove vote
        await supabase
          .from('reason_votes')
          .delete()
          .eq('user_id', userId)
          .eq('photo_id', reason.photoId);

        setUserVotes((prev) => {
          const next = { ...prev };
          delete next[reason.photoId];
          return next;
        });

        setReasons((prev) =>
          prev
            .map((r) => {
              if (r.photoId !== reason.photoId) return r;

              if (vote === 1) {
                const upvotes = Math.max(0, r.upvotes - 1);
                return { ...r, upvotes, score: upvotes - r.downvotes };
              }

              const downvotes = Math.max(0, r.downvotes - 1);
              return { ...r, downvotes, score: r.upvotes - downvotes };
            })
            .sort((a, b) => b.score - a.score)
        );
      } else {
        // Update or insert vote
        await supabase
          .from('reason_votes')
          .upsert(
            {
              user_id: userId,
              photo_id: reason.photoId,
              vote,
            },
            { onConflict: 'user_id,photo_id' }
          );

        setUserVotes((prev) => ({
          ...prev,
          [reason.photoId]: vote,
        }));

        setReasons((prev) =>
          prev
            .map((r) => {
              if (r.photoId !== reason.photoId) return r;

              if (currentVote === vote) return r;

              if (currentVote === undefined) {
                if (vote === 1) {
                  const upvotes = r.upvotes + 1;
                  return { ...r, upvotes, score: upvotes - r.downvotes };
                }

                const downvotes = r.downvotes + 1;
                return { ...r, downvotes, score: r.upvotes - downvotes };
              }

              if (currentVote === 1 && vote === -1) {
                const upvotes = Math.max(0, r.upvotes - 1);
                const downvotes = r.downvotes + 1;
                return { ...r, upvotes, downvotes, score: upvotes - downvotes };
              }

              if (currentVote === -1 && vote === 1) {
                const downvotes = Math.max(0, r.downvotes - 1);
                const upvotes = r.upvotes + 1;
                return { ...r, upvotes, downvotes, score: upvotes - downvotes };
              }

              return r;
            })
            .sort((a, b) => b.score - a.score)
        );
      }
    } catch (error) {
      console.error('Error voting on reason:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <span className="text-gray-600 dark:text-gray-400 text-sm animate-pulse">Loading reasons…</span>
      </div>
    );
  }

  if (reasons.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-700 dark:text-gray-400 text-sm">No reasons submitted yet for this day.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {reasons.map((reason) => (
          <div key={reason.photoId} className="bg-white/80 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-3 hover:bg-white/90 dark:hover:bg-gray-900 transition-colors shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gray-900 dark:text-gray-100 flex-1 break-words font-semibold">{reason.text}</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleVote(reason, 1)}
                disabled={!userId || isVoteLocked(reason.earliestSubmittedAt)}
                className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
                  userVotes[reason.photoId] === 1
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700'
                } ${(!userId || isVoteLocked(reason.earliestSubmittedAt)) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                👍 <span className="font-bold">{reason.upvotes}</span>
              </button>
              <button
                onClick={() => handleVote(reason, -1)}
                disabled={!userId || isVoteLocked(reason.earliestSubmittedAt)}
                className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
                  userVotes[reason.photoId] === -1
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700'
                } ${(!userId || isVoteLocked(reason.earliestSubmittedAt)) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                👎 <span className="font-bold">{reason.downvotes}</span>
              </button>
            </div>
            {isVoteLocked(reason.earliestSubmittedAt) && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Voting locked after 24 hours</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
