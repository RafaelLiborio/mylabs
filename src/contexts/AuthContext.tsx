import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, invokeManageUsers } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type ProfileRow = Tables<'profiles'>

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

let bootstrapPromise: Promise<any> | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id)
    }
  }, [session?.user?.id, fetchProfile])

  useEffect(() => {
    // Ensure demo accounts exist in background once per session
    if (!bootstrapPromise) {
      bootstrapPromise = invokeManageUsers({ action: 'bootstrap_demo' }).catch(() => null)
    }

    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) {
        await fetchProfile(s.user.id)
      }
      if (mounted) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) {
        await fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
