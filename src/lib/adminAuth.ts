import { NextRequest } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

interface AdminAuthSuccess {
  supabase: SupabaseClient;
  user: User;
}

interface AdminAuthFailure {
  status: number;
  error: string;
}

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(
  request: NextRequest
): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return { status: 500, error: 'Supabase public environment variables are not configured.' };
  }

  if (!serviceRoleKey) {
    return { status: 500, error: 'SUPABASE_SERVICE_ROLE_KEY is required for admin routes.' };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { status: 401, error: 'Missing authorization token.' };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    return { status: 401, error: 'Invalid or expired session.' };
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return {
      status: 403,
      error: 'No admin emails configured. Set ADMIN_EMAILS in your environment.',
    };
  }

  const userEmail = (user.email || '').toLowerCase();
  if (!adminEmails.includes(userEmail)) {
    return { status: 403, error: 'You are not authorized to access admin features.' };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  return { supabase, user };
}
