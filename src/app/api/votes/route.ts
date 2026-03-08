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

// POST /api/votes – upsert a vote for a photo
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { photo_id, user_id, vote } = body;

    if (!photo_id || !user_id || ![1, -1].includes(vote)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    // Upsert the vote
    const { error: voteError } = await supabase
      .from('votes')
      .upsert({ user_id, photo_id, vote }, { onConflict: 'user_id,photo_id' });

    if (voteError) throw voteError;

    // Recalculate vote score for the photo
    const { data: voteSums } = await supabase
      .from('votes')
      .select('vote')
      .eq('photo_id', photo_id);

    const score = (voteSums || []).reduce((acc: number, v: { vote: number }) => acc + v.vote, 0);

    const { error: updateError } = await supabase
      .from('photos')
      .update({ vote_score: score })
      .eq('id', photo_id);

    if (updateError) throw updateError;

    // Update color history: find the all-time highest-rated photo (not limited to today)
    const today = new Date().toISOString().split('T')[0];
    const { data: topPhoto } = await supabase
      .from('photos')
      .select('id, king_color, queen_color')
      .eq('is_valid', true)
      .not('king_color', 'is', null)
      .not('queen_color', 'is', null)
      .order('vote_score', { ascending: false })
      .limit(1)
      .single();

    if (topPhoto) {
      await supabase.from('color_history').upsert(
        {
          date: today,
          king_color: topPhoto.king_color,
          queen_color: topPhoto.queen_color,
          photo_id: topPhoto.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      );
    }

    return NextResponse.json({ vote_score: score });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/votes – remove a vote
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { photo_id, user_id } = body;

    if (!photo_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('user_id', user_id)
      .eq('photo_id', photo_id);

    if (error) throw error;

    // Recalculate vote score
    const { data: voteSums } = await supabase
      .from('votes')
      .select('vote')
      .eq('photo_id', photo_id);

    const score = (voteSums || []).reduce((acc: number, v: { vote: number }) => acc + v.vote, 0);

    await supabase.from('photos').update({ vote_score: score }).eq('id', photo_id);

    return NextResponse.json({ vote_score: score });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
