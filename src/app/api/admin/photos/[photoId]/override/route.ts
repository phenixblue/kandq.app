import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

interface Params {
  params: Promise<{ photoId: string }>;
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    throw new Error('Color must be a valid hex code (e.g. #ff00aa).');
  }

  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return trimmed.toUpperCase();
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { photoId } = await params;
  const { supabase } = auth;

  const body = await request.json().catch(() => ({}));

  let kingColor = '';
  let queenColor = '';
  try {
    kingColor = normalizeHex(String(body?.kingColor || ''));
    queenColor = normalizeHex(String(body?.queenColor || ''));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid color values.' },
      { status: 400 }
    );
  }

  const { data: existingPhoto, error: existingError } = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .single();

  if (existingError || !existingPhoto) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
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

  await supabase
    .from('color_history')
    .update({
      king_color: kingColor,
      queen_color: queenColor,
      updated_at: new Date().toISOString(),
    })
    .eq('photo_id', photoId);

  return NextResponse.json({ success: true, photo: updatedPhoto });
}
