import { createContext, useContext, useEffect, useState } from "react"
import supabase from "@/lib/supabase"

type User = {
  id: string
  username: string
  password: string
  image?: string | null
}

type AuthContextType = {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (updates: Partial<User>) => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, image, password")
      .eq("username", username)
      .single()

    if (error || !data) return false
    if (data.password !== password) return false

    const user = {
      id: data.id,
      username: data.username,
      password: data.password,
      image: data.image,
    }

    setUser(user)
    localStorage.setItem("user", JSON.stringify(user))
    return true
  }

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single()

    if (error) throw error

    setUser(data)
    localStorage.setItem("user", JSON.stringify(data))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
