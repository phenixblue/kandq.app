import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

interface Params {
  params: Promise<{ photoId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { photoId } = await params;
  const { supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const kingColor = typeof body?.kingColor === 'string' ? body.kingColor : null;
  const queenColor = typeof body?.queenColor === 'string' ? body.queenColor : null;
  const isValid = body?.isValid === true;

  if (!kingColor || !queenColor || !isValid) {
    return NextResponse.json(
      { error: 'Only valid analysis results with both colors can be persisted.' },
      { status: 400 }
    );
  }

  const { data: existingPhoto, error: existingError } = await supabase
    .from('photos')
    .select('id, king_color, queen_color, is_valid')
    .eq('id', photoId)
    .single();

  if (existingError || !existingPhoto) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  }

  const sameKing = (existingPhoto.king_color || '').toLowerCase() === kingColor.toLowerCase();
  const sameQueen = (existingPhoto.queen_color || '').toLowerCase() === queenColor.toLowerCase();
  const sameValidity = existingPhoto.is_valid === true;
  const changed = !(sameKing && sameQueen && sameValidity);

  if (!changed) {
    return NextResponse.json({ updated: false, photo: existingPhoto });
  }

  const { data: updatedPhoto, error: updateError } = await supabase
    .from('photos')
    .update({
      king_color: kingColor,
      queen_color: queenColor,
      is_valid: true,
      analyzed_at: new Date().toISOString(),
    })
    .eq('id', photoId)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Keep any existing color_history row linked to this photo in sync.
  await supabase
    .from('color_history')
    .update({
      king_color: kingColor,
      queen_color: queenColor,
      updated_at: new Date().toISOString(),
    })
    .eq('photo_id', photoId);

  return NextResponse.json({ updated: true, photo: updatedPhoto });
}
