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

// POST /api/reason-votes-standalone – vote on a standalone reason
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { reason_id, user_id, vote } = body;

    if (!reason_id || !user_id || ![1, -1].includes(vote)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    // Check if user already voted
    const { data: existing } = await supabase
      .from('reason_votes_standalone')
      .select('*')
      .eq('user_id', user_id)
      .eq('reason_id', reason_id)
      .single();

    if (existing) {
      if (existing.vote === vote) {
        // Same vote: delete it
        const { error: deleteError } = await supabase
          .from('reason_votes_standalone')
          .delete()
          .eq('user_id', user_id)
          .eq('reason_id', reason_id);
        if (deleteError) throw deleteError;
      } else {
        // Different vote: update it
        const { error: updateError } = await supabase
          .from('reason_votes_standalone')
          .update({ vote })
          .eq('user_id', user_id)
          .eq('reason_id', reason_id);
        if (updateError) throw updateError;
      }
    } else {
      // New vote: insert it
      const { error: insertError } = await supabase
        .from('reason_votes_standalone')
        .insert({ user_id, reason_id, vote });
      if (insertError) throw insertError;
    }

    // Recalculate vote counts
    const { data: upvotes } = await supabase
      .from('reason_votes_standalone')
      .select('vote')
      .eq('reason_id', reason_id)
      .eq('vote', 1);

    const { data: downvotes } = await supabase
      .from('reason_votes_standalone')
      .select('vote')
      .eq('reason_id', reason_id)
      .eq('vote', -1);

    const upvoteCount = upvotes?.length || 0;
    const downvoteCount = downvotes?.length || 0;

    const { error: updateReasonError } = await supabase
      .from('reasons')
      .update({ upvotes: upvoteCount, downvotes: downvoteCount })
      .eq('id', reason_id);

    if (updateReasonError) throw updateReasonError;

    return NextResponse.json(
      { upvotes: upvoteCount, downvotes: downvoteCount },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/reason-votes-standalone – remove a vote on a standalone reason
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { reason_id, user_id } = body;

    if (!reason_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('reason_votes_standalone')
      .delete()
      .eq('user_id', user_id)
      .eq('reason_id', reason_id);

    if (deleteError) throw deleteError;

    // Recalculate vote counts
    const { data: upvotes } = await supabase
      .from('reason_votes_standalone')
      .select('vote')
      .eq('reason_id', reason_id)
      .eq('vote', 1);

    const { data: downvotes } = await supabase
      .from('reason_votes_standalone')
      .select('vote')
      .eq('reason_id', reason_id)
      .eq('vote', -1);

    const upvoteCount = upvotes?.length || 0;
    const downvoteCount = downvotes?.length || 0;

    const { error: updateReasonError } = await supabase
      .from('reasons')
      .update({ upvotes: upvoteCount, downvotes: downvoteCount })
      .eq('id', reason_id);

    if (updateReasonError) throw updateReasonError;

    return NextResponse.json({ status: 'deleted' }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
