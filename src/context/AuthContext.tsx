import { createContext, useContext, useEffect, useMemo, useState } from "react"
import supabase from "@/lib/supabase"

export type UserProfile = {
  id: string
  email: string | null
  username: string | null
  image?: string | null
  role: "pending" | "member" | "admin" | string | null
  company_id?: string | null
}

export type AuthError = {
  message: string
  code?: string
}

export type AuthResult = {
  success: boolean
  error?: AuthError
}

type AuthContextType = {
  user: UserProfile | null
  login: (email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  verifyOtpAndUpdatePassword: (email: string, token: string, newPassword: string) => Promise<AuthResult>
  setPasswordFromRecovery: (newPassword: string) => Promise<AuthResult>
  updateUser: (updates: Partial<UserProfile>) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshUser: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data.user) {
      setUser(null)
      return
    }
    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email ?? null,
      username: data.user.user_metadata?.username ?? data.user.email?.split('@')[0] ?? null,
      image: data.user.user_metadata?.image ?? null,
      role: data.user.user_metadata?.role ?? 'pending',
      company_id: data.user.user_metadata?.company_id ?? null
    }
    setUser(profile)
  }

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const authUser = data.session?.user ?? null
        if (!authUser) {
          if (mounted) setUser(null)
        } else {
          const profile: UserProfile = {
            id: authUser.id,
            email: authUser.email ?? null,
            username: authUser.user_metadata?.username ?? authUser.email?.split('@')[0] ?? null,
            image: authUser.user_metadata?.image ?? null,
            role: authUser.user_metadata?.role ?? 'pending',
            company_id: authUser.user_metadata?.company_id ?? null
          }
          if (mounted) setUser(profile)
        }
      } catch (error) {
        console.error("Failed to load auth session:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email ?? null,
          username: session.user.user_metadata?.username ?? session.user.email?.split('@')[0] ?? null,
          image: session.user.user_metadata?.image ?? null,
          role: session.user.user_metadata?.role ?? 'pending',
          company_id: session.user.user_metadata?.company_id ?? null
        }
        if (mounted) setUser(profile)
      } catch (error) {
        console.error("Failed to refresh profile:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: error.status?.toString() }
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: { message: "Login failed - no user returned" }
      }
    }

    // Use user_metadata instead of profiles table
    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email ?? null,
      username: data.user.user_metadata?.username ?? data.user.email?.split('@')[0] ?? null,
      image: data.user.user_metadata?.image ?? null,
      role: data.user.user_metadata?.role ?? 'pending',
      company_id: data.user.user_metadata?.company_id ?? null
    }
    setUser(profile)
    return { success: true }
  }

  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message }
      }
    }

    return { success: true }
  }

  const verifyOtpAndUpdatePassword = async (
    email: string,
    token: string,
    newPassword: string
  ): Promise<AuthResult> => {
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      })

      if (verifyError) {
        return {
          success: false,
          error: { message: verifyError.message }
        }
      }

      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (sessionError) {
          return {
            success: false,
            error: { message: sessionError.message }
          }
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

      if (updateError) {
        return {
          success: false,
          error: { message: updateError.message }
        }
      }

      return { success: true }
    } catch (err) {
      console.error('Unexpected error in verifyOtpAndUpdatePassword:', err);
      return {
        success: false,
        error: { message: err instanceof Error ? err.message : 'Unknown error occurred' }
      }
    }
  }

  const setPasswordFromRecovery = async (newPassword: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      return {
        success: false,
        error: { message: error.message }
      }
    }

    return { success: true }
  }

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user) return

    // Update user_metadata in auth.users
    const { data, error } = await supabase.auth.updateUser({
      data: {
        username: updates.username ?? user.username,
        image: updates.image ?? user.image,
        role: updates.role ?? user.role,
        company_id: updates.company_id ?? user.company_id,
      }
    })

    if (error) throw error

    // Also update profiles table for user management queries
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        username: updates.username ?? user.username,
        image: updates.image ?? user.image,
        role: updates.role ?? user.role,
        company_id: updates.company_id ?? user.company_id,
        updated_at: new Date().toISOString(),
      })

    if (profileError) throw profileError

    // Update local state
    if (data.user) {
      setUser({
        ...user,
        ...updates
      })
    }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      sendPasswordReset,
      verifyOtpAndUpdatePassword,
      setPasswordFromRecovery,
      updateUser,
      updatePassword,
      refreshUser,
      loading
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
