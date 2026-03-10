import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

function getDateRange(date: string) {
  return {
    start: `${date}T00:00:00.000Z`,
    end: `${date}T23:59:59.999Z`,
  };
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function countExact(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;
  const date = request.nextUrl.searchParams.get('date') || '';

  if (date && !isDateInput(date)) {
    return NextResponse.json({ error: 'Date must use YYYY-MM-DD format.' }, { status: 400 });
  }

  try {
    const [
      totalPhotos,
      validPhotos,
      totalReasons,
      validReasons,
      totalPhotoVotes,
      totalReasonVotes,
      totalPhotoLockedDates,
      totalReasonLockedDates,
      topPhoto,
      topReason,
      photosForDates,
      reasonsForDates,
      photoSubmitters,
      reasonSubmitters,
    ] = await Promise.all([
      countExact(supabase.from('photos').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('photos').select('*', { count: 'exact', head: true }).eq('is_valid', true)),
      countExact(supabase.from('reasons').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('reasons').select('*', { count: 'exact', head: true }).eq('is_valid', true)),
      countExact(supabase.from('votes').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('reason_votes_standalone').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('color_history').select('*', { count: 'exact', head: true }).eq('photo_locked', true)),
      countExact(supabase.from('color_history').select('*', { count: 'exact', head: true }).eq('reason_locked', true)),
      supabase.from('photos').select('id, vote_score').eq('is_valid', true).order('vote_score', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('reasons').select('id, upvotes, downvotes').eq('is_valid', true).order('upvotes', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('photos').select('submitted_at'),
      supabase.from('reasons').select('submitted_at'),
      supabase.from('photos').select('user_id').not('user_id', 'is', null),
      supabase.from('reasons').select('user_id').not('user_id', 'is', null),
    ]);

    if (topPhoto.error) throw new Error(topPhoto.error.message);
    if (topReason.error) throw new Error(topReason.error.message);
    if (photosForDates.error) throw new Error(photosForDates.error.message);
    if (reasonsForDates.error) throw new Error(reasonsForDates.error.message);
    if (photoSubmitters.error) throw new Error(photoSubmitters.error.message);
    if (reasonSubmitters.error) throw new Error(reasonSubmitters.error.message);

    const photoDates = new Set((photosForDates.data || []).map((row) => row.submitted_at.slice(0, 10)));
    const reasonDates = new Set((reasonsForDates.data || []).map((row) => row.submitted_at.slice(0, 10)));
    const combinedSubmitters = new Set([
      ...(photoSubmitters.data || []).map((row) => row.user_id),
      ...(reasonSubmitters.data || []).map((row) => row.user_id),
    ]);

    const overall = {
      totalPhotos,
      validPhotos,
      totalReasons,
      validReasons,
      totalPhotoVotes,
      totalReasonVotes,
      totalDatesWithPhotos: photoDates.size,
      totalDatesWithReasons: reasonDates.size,
      totalUniqueSubmitters: combinedSubmitters.size,
      totalPhotoLockedDates,
      totalReasonLockedDates,
      averagePhotoVotesPerPhoto: totalPhotos > 0 ? Number((totalPhotoVotes / totalPhotos).toFixed(2)) : 0,
      averageReasonVotesPerReason: totalReasons > 0 ? Number((totalReasonVotes / totalReasons).toFixed(2)) : 0,
      highestPhotoScore: topPhoto.data?.vote_score ?? 0,
      highestReasonNetScore: topReason.data ? (topReason.data.upvotes - topReason.data.downvotes) : 0,
    };

    let byDate = null;

    if (date) {
      const { start, end } = getDateRange(date);

      const { data: datePhotos, error: datePhotosError } = await supabase
        .from('photos')
        .select('id, is_valid, vote_score')
        .gte('submitted_at', start)
        .lte('submitted_at', end);

      if (datePhotosError) throw new Error(datePhotosError.message);

      const { data: dateReasons, error: dateReasonsError } = await supabase
        .from('reasons')
        .select('id, is_valid, upvotes, downvotes')
        .gte('submitted_at', start)
        .lte('submitted_at', end);

      if (dateReasonsError) throw new Error(dateReasonsError.message);

      const photoIds = (datePhotos || []).map((row) => row.id);
      const reasonIds = (dateReasons || []).map((row) => row.id);

      let photoVotesForDate = 0;
      if (photoIds.length > 0) {
        photoVotesForDate = await countExact(
          supabase.from('votes').select('*', { count: 'exact', head: true }).in('photo_id', photoIds)
        );
      }

      let reasonVotesForDate = 0;
      if (reasonIds.length > 0) {
        reasonVotesForDate = await countExact(
          supabase.from('reason_votes_standalone').select('*', { count: 'exact', head: true }).in('reason_id', reasonIds)
        );
      }

      const { data: dayTopRow, error: dayTopError } = await supabase
        .from('color_history')
        .select('photo_locked, reason_locked, photo_id, reason')
        .eq('date', date)
        .maybeSingle();

      if (dayTopError) throw new Error(dayTopError.message);

      byDate = {
        date,
        photosSubmitted: datePhotos?.length ?? 0,
        validPhotos: (datePhotos || []).filter((row) => row.is_valid).length,
        reasonsSubmitted: dateReasons?.length ?? 0,
        validReasons: (dateReasons || []).filter((row) => row.is_valid).length,
        photoVotesCast: photoVotesForDate,
        reasonVotesCast: reasonVotesForDate,
        averagePhotoScore:
          (datePhotos || []).length > 0
            ? Number(
                (
                  (datePhotos || []).reduce((acc, row) => acc + (row.vote_score || 0), 0) /
                  (datePhotos || []).length
                ).toFixed(2)
              )
            : 0,
        averageReasonNetScore:
          (dateReasons || []).length > 0
            ? Number(
                (
                  (dateReasons || []).reduce((acc, row) => acc + ((row.upvotes || 0) - (row.downvotes || 0)), 0) /
                  (dateReasons || []).length
                ).toFixed(2)
              )
            : 0,
        photoTopLocked: Boolean(dayTopRow?.photo_locked),
        reasonTopLocked: Boolean(dayTopRow?.reason_locked),
        topPhotoId: dayTopRow?.photo_id || null,
        topReasonText: dayTopRow?.reason || null,
      };
    }

    return NextResponse.json({ overall, byDate });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load statistics.' },
      { status: 500 }
    );
  }
}
