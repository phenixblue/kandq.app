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

function isAdmin(token: string | null): boolean {
  if (!token) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return adminEmails.includes(payload.email);
  } catch {
    return false;
  }
}

// POST /api/admin/reasons/top-of-day - Mark a reason as top for a specific day
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!isAdmin(token)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceClient();
    const body = await req.json();
    const { reason_id, date } = body;

    if (!reason_id || !date) {
      return NextResponse.json({ error: 'Missing reason_id or date' }, { status: 400 });
    }

    // Get the reason text
    const { data: reason, error: reasonError } = await supabase
      .from('reasons')
      .select('reason_text')
      .eq('id', reason_id)
      .single();

    if (reasonError || !reason) {
      return NextResponse.json({ error: 'Reason not found' }, { status: 404 });
    }

    // Upsert into color_history
    const { error: upsertError } = await supabase
      .from('color_history')
      .upsert(
        {
          date,
          reason: reason.reason_text,
          reason_locked: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'date',
        }
      );

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true, date }, { status: 200 });
  } catch (err: unknown) {
    console.error('Mark top reason error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/reasons/top-of-day - Unselect a top reason for a specific day
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!isAdmin(token)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceClient();
    const body = await req.json();
    const { reason_id, date } = body;

    if (!reason_id || !date) {
      return NextResponse.json({ error: 'Missing reason_id or date' }, { status: 400 });
    }

    const { data: reason, error: reasonError } = await supabase
      .from('reasons')
      .select('reason_text')
      .eq('id', reason_id)
      .single();

    if (reasonError || !reason) {
      return NextResponse.json({ error: 'Reason not found' }, { status: 404 });
    }

    const { data: targetRow, error: targetError } = await supabase
      .from('color_history')
      .select('id, photo_id, photo_locked')
      .eq('date', date)
      .eq('reason', reason.reason_text)
      .eq('reason_locked', true)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }

    if (!targetRow) {
      return NextResponse.json({ success: true, date, removed: false }, { status: 200 });
    }

    if (targetRow.photo_locked) {
      const { error: clearError } = await supabase
        .from('color_history')
        .update({
          reason: null,
          reason_locked: false,
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

    return NextResponse.json({ success: true, date, removed: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('Unmark top reason error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
