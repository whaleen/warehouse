import { AppHeader } from "@/components/Navigation/AppHeader"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings as SettingsIcon } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { AvatarUploader } from "@/components/Auth/AvatarUploader"

interface SettingsViewProps {
  onSettingsClick: () => void
}

export function SettingsView({ onSettingsClick }: SettingsViewProps) {
  const { user, updateUser } = useAuth()
  const [username, setUsername] = useState(user?.username ?? "")
  const [password, setPassword] = useState(user?.password ?? "")
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleSave = async () => {
    setSaving(true)
    await updateUser({ username, password })
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Settings" onSettingsClick={onSettingsClick} />

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Application Settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your preferences and configurations
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Avatar uploader */}
            <AvatarUploader />

            <div className="space-y-2">
              <Label htmlFor="user-name">User Name</Label>
              <Input
                id="user-name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">About</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Warehouse Inventory Scanner</p>
            <p>Version 1.0.0</p>
            <p className="pt-2 text-xs">
              Settings page fully wired for avatar, username, and password.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
