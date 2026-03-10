import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

interface Params {
  params: Promise<{ photoId: string }>;
}

function getDateInput(rawDate?: string): string {
  if (!rawDate) {
    return new Date().toISOString().split('T')[0];
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
  if (!isDateOnly) {
    throw new Error('Date must use YYYY-MM-DD format.');
  }

  return rawDate;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { photoId } = await params;
  const { supabase } = auth;

  let requestedDate = '';
  try {
    const body = await request.json().catch(() => ({}));
    requestedDate = getDateInput(body?.date);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid date.' },
      { status: 400 }
    );
  }

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, king_color, queen_color, color_reason')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  }

  if (!photo.king_color || !photo.queen_color) {
    return NextResponse.json(
      { error: 'Selected photo is missing detected colors.' },
      { status: 400 }
    );
  }

  const { error: upsertError } = await supabase
    .from('color_history')
    .upsert(
      {
        date: requestedDate,
        photo_id: photo.id,
        king_color: photo.king_color,
        queen_color: photo.queen_color,
        reason: photo.color_reason || null,
        photo_locked: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, date: requestedDate, photoId: photo.id });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { photoId } = await params;
  const { supabase } = auth;

  let requestedDate = '';
  try {
    const body = await request.json().catch(() => ({}));
    requestedDate = getDateInput(body?.date);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid date.' },
      { status: 400 }
    );
  }

  const { data: targetRow, error: targetError } = await supabase
    .from('color_history')
    .select('id, reason, reason_locked')
    .eq('date', requestedDate)
    .eq('photo_id', photoId)
    .eq('photo_locked', true)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetRow) {
    return NextResponse.json({ success: true, date: requestedDate, photoId, removed: false });
  }

  if (targetRow.reason_locked) {
    const { error: clearError } = await supabase
      .from('color_history')
      .update({
        photo_id: null,
        king_color: null,
        queen_color: null,
        photo_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetRow.id);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  } else {
    const { error: deleteError } = await supabase
      .from('color_history')
      .delete()
      .eq('id', targetRow.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, date: requestedDate, photoId, removed: true });
}
