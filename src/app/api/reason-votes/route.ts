import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured');
  }
  return createClient(url, key);
}

// POST /api/reason-votes – upsert a vote for a photo reason
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { photo_id, user_id, vote } = body;

    if (!photo_id || !user_id || ![1, -1].includes(vote)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const { error: voteError } = await supabase
      .from('reason_votes')
      .upsert({ user_id, photo_id, vote }, { onConflict: 'user_id,photo_id' });

    if (voteError) throw voteError;

    const { data: voteSums } = await supabase
      .from('reason_votes')
      .select('vote')
      .eq('photo_id', photo_id);

    const score = (voteSums || []).reduce((acc: number, row: { vote: number }) => acc + row.vote, 0);

    const { error: updateError } = await supabase
      .from('photos')
      .update({ reason_vote_score: score })
      .eq('id', photo_id);

    if (updateError) throw updateError;

    // Keep today's reason in history aligned to top reason-voted photo
    const today = new Date().toISOString().split('T')[0];
    const { data: topReasonPhoto } = await supabase
      .from('photos')
      .select('id, color_reason')
      .eq('is_valid', true)
      .not('color_reason', 'is', null)
      .order('reason_vote_score', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    if (topReasonPhoto?.color_reason) {
      await supabase.from('color_history').upsert(
        {
          date: today,
          reason: topReasonPhoto.color_reason,
          photo_id: topReasonPhoto.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      );
    }

    return NextResponse.json({ reason_vote_score: score });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/reason-votes – remove a reason vote
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { photo_id, user_id } = body;

    if (!photo_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('reason_votes')
      .delete()
      .eq('user_id', user_id)
      .eq('photo_id', photo_id);

    if (error) throw error;

    const { data: voteSums } = await supabase
      .from('reason_votes')
      .select('vote')
      .eq('photo_id', photo_id);

    const score = (voteSums || []).reduce((acc: number, row: { vote: number }) => acc + row.vote, 0);

    await supabase.from('photos').update({ reason_vote_score: score }).eq('id', photo_id);

    return NextResponse.json({ reason_vote_score: score });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
