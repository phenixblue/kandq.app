import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
}
