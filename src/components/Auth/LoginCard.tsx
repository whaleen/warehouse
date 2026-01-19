import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { ThemeProvider } from "../theme-provider"

export function LoginCard() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const ok = await login(username, password)
    if (!ok) setError("Invalid username or password")

    setLoading(false)
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <img src="/blue-jacket.png" alt="Blue Jacket" className="h-16 w-16 rounded-full object-cover" />
          <h1 className="text-2xl font-bold">Warehouse</h1>
        </div>

        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </Card>
    </div>
    </ThemeProvider>
  )
}
