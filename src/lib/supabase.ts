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

export function translateErrorPt(err: any, fallback = 'Não foi possível concluir a operação.'): string {
  const raw = typeof err === 'string' ? err : err?.message || err?.error_description || ''
  if (!raw) return fallback
  const lower = raw.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado.'
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Este e-mail já está cadastrado na plataforma MyLabs.'
  }
  if (lower.includes('password should be at least')) {
    return 'A senha deve possuir no mínimo 6 caracteres.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.'
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'O formato do e-mail informado é inválido.'
  }
  if (lower.includes('duplicate key') && lower.includes('diet_meal_items')) {
    return 'Este alimento já está incluído nesta refeição. Ajuste a gramatura existente ou adicione em outra refeição.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Falha de conexão com o servidor. Verifique sua internet.'
  }
  return raw
}

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
    throw new Error(translateErrorPt(data?.error || `Falha na operação (${res.status})`))
  }
  return data as T
}

export async function getSignedOrPublicUrl(bucket: string, path: string): Promise<string> {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (bucket === 'exercise-media' || bucket === 'avatars' || bucket === 'client-diary-photos') {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return ''
  return data.signedUrl
}
