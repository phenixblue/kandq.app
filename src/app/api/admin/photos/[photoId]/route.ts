import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

interface Params {
  params: Promise<{ photoId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { photoId } = await params;
  const { supabase } = auth;

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  }

  if (photo.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('kandq-photos')
      .remove([photo.storage_path]);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
