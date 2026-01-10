// components/Auth/AvatarUploader.tsx
import { useState } from "react"
import supabase from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AvatarUploader() {
  const { user, updateUser } = useAuth()
  const [uploading, setUploading] = useState(false)

  if (!user) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const ext = file.name.split(".").pop()
      const fileName = `${user.id}.${ext}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName).data

      if (!publicUrl) throw new Error("No public URL")


      // Update user.image in DB
      await updateUser({ image: publicUrl })
    } catch (err) {
      console.error("Avatar upload failed:", err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="h-24 w-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
        {user.image ? (
          <img
            src={user.image}
            alt={user.username}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserIcon className="h-12 w-12 text-primary" />
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        id="avatar-upload"
        onChange={handleFileChange}
      />
      <Button
        size="sm"
        disabled={uploading}
        onClick={() => document.getElementById("avatar-upload")?.click()}
      >
        {uploading ? "Uploading…" : "Change Avatar"}
      </Button>
    </div>
  )
}
