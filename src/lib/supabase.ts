import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const FALLBACK_URL = 'https://eifwvrmoyotgtmvxzzfb.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZnd2cm1veW90Z3Rtdnh6emZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MTA1MjcsImV4cCI6MjExMDA4NjUyN30.do2N5vSf69qgEKvugK1zpOr4nSP4dVvLFvsh3hH1X8Y'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export async function invokeManageUsers<T = any>(payload: Record<string, any>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Falha na operação (${res.status})`)
  }
  return data as T
}

export async function getSignedOrPublicUrl(bucket: string, path: string): Promise<string> {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (bucket === 'exercise-media' || bucket === 'avatars') {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return ''
  return data.signedUrl
}
