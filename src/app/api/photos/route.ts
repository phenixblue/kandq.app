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

// GET /api/photos – list valid photos ordered by vote score
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const filterDate = req.nextUrl.searchParams.get('date');

    let query = supabase
      .from('photos')
      .select('*')
      .eq('is_valid', true);

    if (filterDate) {
      const startDate = `${filterDate}T00:00:00.000Z`;
      const endDate = `${filterDate}T23:59:59.999Z`;
      query = query.gte('submitted_at', startDate).lte('submitted_at', endDate);
    }

    const { data, error } = await query
      .order('vote_score', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const photoRows = data || [];

    if (photoRows.length === 0) {
      return NextResponse.json([]);
    }

    const paths = photoRows.map((row) => row.storage_path).filter(Boolean);
    const signedUrlMap = new Map<string, string>();

    if (paths.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from('kandq-photos')
        .createSignedUrls(paths, 60 * 60);

      (signedUrls || []).forEach((entry, index) => {
        if (entry?.signedUrl) {
          signedUrlMap.set(paths[index], entry.signedUrl);
        }
      });
    }

    const withSignedUrls = photoRows.map((row) => ({
      ...row,
      url: signedUrlMap.get(row.storage_path) || row.url,
    }));

    return NextResponse.json(withSignedUrls);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/photos – create a new photo record
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { url, storage_path, king_color, queen_color, color_reason, user_id } = body;

    if (!url || !storage_path || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('photos')
      .insert({
        url,
        storage_path,
        king_color,
        queen_color,
        color_reason,
        user_id,
        is_valid: true,
        vote_score: 0,
        reason_vote_score: 0,
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update color history for today
    if (king_color && queen_color) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('color_history').upsert(
        {
          date: today,
          king_color,
          queen_color,
          reason: color_reason || null,
          photo_id: data.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
