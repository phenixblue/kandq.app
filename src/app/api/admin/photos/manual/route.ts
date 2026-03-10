import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const adminAuth = await requireAdmin(request);
    if ('error' in adminAuth) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
    }

    const body = await request.json();
    const { date, kingColor, queenColor, reason, url, storagePath } = body;

    if (!date || !kingColor || !queenColor || !url || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: date, kingColor, queenColor, url, storagePath' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate hex colors
    const hexPattern = /^#[0-9A-F]{6}$/i;
    if (!hexPattern.test(kingColor) || !hexPattern.test(queenColor)) {
      return NextResponse.json(
        { error: 'Invalid color format. Use 6-digit hex codes like #FFFFFF' },
        { status: 400 }
      );
    }

    const user = adminAuth.user;

    // Use service client for insert (bypasses RLS)
    const supabase = adminAuth.supabase ?? getServiceClient();

    // Insert photo with normal baseline scores
    // Note: submitted_at will use the date input as TIMESTAMPTZ
    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        user_id: user.id,
        url,
        storage_path: storagePath,
        king_color: kingColor.toUpperCase(),
        queen_color: queenColor.toUpperCase(),
        color_reason: reason || null,
        is_valid: true,
        vote_score: 0,
        reason_vote_score: 0,
        submitted_at: `${date}T12:00:00.000Z`,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create photo: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Update color_history for this date
    const { error: historyError } = await supabase
      .from('color_history')
      .upsert(
        {
          date,
          king_color: kingColor.toUpperCase(),
          queen_color: queenColor.toUpperCase(),
          reason: reason || null,
        },
        { onConflict: 'date' }
      );

    if (historyError) {
      console.error('Failed to update color_history:', historyError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      photo,
      date,
    });

  } catch (error) {
    console.error('Manual entry error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
