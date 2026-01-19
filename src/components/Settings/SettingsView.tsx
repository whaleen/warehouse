import { AppHeader } from "@/components/Navigation/AppHeader"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings as SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { PageContainer } from "@/components/Layout/PageContainer"
import supabase from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/AuthContext"
import { AvatarUploader } from "@/components/Auth/AvatarUploader"
import {
  getEnvActiveCompanyId,
  getEnvActiveLocationId,
  getStoredActiveCompanyId,
  getStoredActiveLocationId,
  setActiveLocationContext,
} from "@/lib/tenant"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DisplayManager } from "@/components/FloorDisplay/DisplayManager"

interface SettingsViewProps {
  onMenuClick?: () => void
  section?: SettingsSection
}

type LocationRow = {
  id: string
  company_id: string
  name: string
  slug: string
  created_at?: string | null
  active?: boolean | null
  companies?: {
    id?: string
    name?: string | null
    slug?: string | null
  } | null
}

type CompanyRow = {
  id: string
  name: string
  slug: string
  created_at?: string | null
  active?: boolean | null
}

type UserRow = {
  id: string | number
  username: string | null
  password: string | null
  role?: string | null
  image?: string | null
  company_ids?: string[] | null
}

const SUPER_ADMIN_STORAGE_KEY = "super_admin_unlocked"

type SettingsSection =
  | "locations"
  | "company"
  | "users"
  | "displays-setup"
  | "displays-list"
  | "displays-settings"

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export function SettingsView({ onMenuClick, section }: SettingsViewProps) {
  const { user, updateUser } = useAuth()
  const resolvedSection: SettingsSection = section ?? "locations"
  const sectionTitles: Record<SettingsSection, string> = {
    locations: "Locations",
    company: "Company",
    users: "Users",
    "displays-setup": "Display Setup",
    "displays-list": "Displays",
    "displays-settings": "Display Settings",
  }
  const pageTitle = section ? `Settings / ${sectionTitles[resolvedSection]}` : "Settings"
  const [activeLocationKey, setActiveLocationKey] = useState<string | null>(() => {
    return (
      getStoredActiveLocationId() ??
      getEnvActiveLocationId() ??
      getStoredActiveCompanyId() ??
      getEnvActiveCompanyId() ??
      null
    )
  })
  const [activeLocationSource, setActiveLocationSource] = useState<
    "local" | "env" | "local-company" | "env-company" | "none"
  >(() => {
    if (getStoredActiveLocationId()) return "local"
    if (getEnvActiveLocationId()) return "env"
    if (getStoredActiveCompanyId()) return "local-company"
    if (getEnvActiveCompanyId()) return "env-company"
    return "none"
  })
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationCompanyId, setLocationCompanyId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState("")
  const [locationSlug, setLocationSlug] = useState("")
  const [ssoUsername, setSsoUsername] = useState("")
  const [ssoPassword, setSsoPassword] = useState("")
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [newLocationName, setNewLocationName] = useState("")
  const [newLocationSlug, setNewLocationSlug] = useState("")
  const [newLocationSlugTouched, setNewLocationSlugTouched] = useState(false)
  const [newLocationCompanyId, setNewLocationCompanyId] = useState<string>("")
  const [locationManagerSaving, setLocationManagerSaving] = useState(false)
  const [locationManagerError, setLocationManagerError] = useState<string | null>(null)
  const [locationManagerSuccess, setLocationManagerSuccess] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null)
  const [username, setUsername] = useState(user?.username ?? "")
  const [password, setPassword] = useState(user?.password ?? "")
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [userSuccess, setUserSuccess] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [usersSavingId, setUsersSavingId] = useState<string | number | null>(null)
  const [usersSuccess, setUsersSuccess] = useState<string | null>(null)
  const [newUserName, setNewUserName] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user")
  const [newUserError, setNewUserError] = useState<string | null>(null)
  const [newUserSaving, setNewUserSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [companySavingId, setCompanySavingId] = useState<string | null>(null)
  const [companyManagerError, setCompanyManagerError] = useState<string | null>(null)
  const [companyManagerSuccess, setCompanyManagerSuccess] = useState<string | null>(null)
  const [newCompanyName, setNewCompanyName] = useState("")
  const [newCompanySlug, setNewCompanySlug] = useState("")
  const [newCompanySlugTouched, setNewCompanySlugTouched] = useState(false)
  const [newCompanySaving, setNewCompanySaving] = useState(false)
  const [superAdminUnlocked, setSuperAdminUnlocked] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(SUPER_ADMIN_STORAGE_KEY) === "true"
  })
  const [superAdminUsername, setSuperAdminUsername] = useState("")
  const [superAdminPassword, setSuperAdminPassword] = useState("")
  const [superAdminError, setSuperAdminError] = useState<string | null>(null)

  const roles = ["admin", "user"] as const

  useEffect(() => {
    if (!newLocationSlugTouched) {
      setNewLocationSlug(slugify(newLocationName))
    }
  }, [newLocationName, newLocationSlugTouched])

  useEffect(() => {
    if (!newCompanySlugTouched) {
      setNewCompanySlug(slugify(newCompanyName))
    }
  }, [newCompanyName, newCompanySlugTouched])

  useEffect(() => {
    if (newLocationCompanyId || companies.length === 0) return
    const fallbackCompanyId = locationCompanyId ?? companies[0]?.id ?? ""
    if (fallbackCompanyId) {
      setNewLocationCompanyId(fallbackCompanyId)
    }
  }, [companies, locationCompanyId, newLocationCompanyId])

  const fetchLocations = async () => {
    setLocationsLoading(true)
    setLocationsError(null)
    const { data, error } = await supabase
      .from("locations")
      .select("id, company_id, name, slug, created_at, active, companies:company_id (id, name, slug)")
      .order("created_at", { ascending: true })

    if (error) {
      setLocationsError(error.message)
      setLocations([])
      setLocationsLoading(false)
      return
    }

    setLocations((data ?? []) as LocationRow[])
    setLocationsLoading(false)
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchCompanies = async () => {
    setCompaniesLoading(true)
    setCompaniesError(null)
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug, created_at, active")
      .order("created_at", { ascending: true })

    if (error) {
      setCompaniesError(error.message)
      setCompanies([])
      setCompaniesLoading(false)
      return
    }

    setCompanies((data ?? []) as CompanyRow[])
    setCompaniesLoading(false)
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchUsers = async () => {
    setUsersLoading(true)
    setUsersError(null)
    const { data, error } = await supabase
      .from("users")
      .select("id, username, password, role, image, company_ids")
      .order("created_at", { ascending: true })

    if (error) {
      setUsersError(error.message)
      setUsers([])
      setUsersLoading(false)
      return
    }

    setUsers((data ?? []) as UserRow[])
    setUsersLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      if (!activeLocationKey) {
        setLocationError("Select an active location below.")
        setLocationLoading(false)
        setLocationId(null)
        setLocationCompanyId(null)
        setLocationName("")
        setLocationSlug("")
        setSsoUsername("")
        setSsoPassword("")
        return
      }

      setLocationLoading(true)
      setLocationError(null)
      setLocationSuccess(null)

      const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        activeLocationKey
      )
      const locationQuery = supabase.from("locations").select("id, company_id, name, slug")
      const locationLookup = isUuidLike
        ? await locationQuery.eq("id", activeLocationKey).maybeSingle()
        : await locationQuery.eq("slug", activeLocationKey).maybeSingle()

      let location = locationLookup.data as LocationRow | null
      let locationError = locationLookup.error

      if (!location?.id && isUuidLike) {
        const fallbackLookup = await supabase
          .from("locations")
          .select("id, company_id, name, slug")
          .eq("company_id", activeLocationKey)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()

        if (fallbackLookup.data) {
          location = fallbackLookup.data as LocationRow
          locationError = null
        } else if (fallbackLookup.error) {
          locationError = fallbackLookup.error
        }
      }

      if (locationError) {
        if (!cancelled) {
          setLocationError(locationError.message)
          setLocationLoading(false)
        }
        return
      }

      if (!location?.id) {
        if (!cancelled) {
          setLocationError(`No location found for "${activeLocationKey}".`)
          setLocationLoading(false)
        }
        return
      }

      const { data: settings, error: settingsError } = await supabase
        .from("settings")
        .select("sso_username, sso_password")
        .eq("location_id", location.id)
        .maybeSingle()

      if (settingsError) {
        if (!cancelled) {
          setLocationError(settingsError.message)
          setLocationLoading(false)
        }
        return
      }

      if (!cancelled) {
        setLocationId(location.id)
        setLocationCompanyId(location.company_id ?? null)
        setLocationName(location?.name ?? "")
        setLocationSlug(location?.slug ?? "")
        setSsoUsername(settings?.sso_username ?? "")
        setSsoPassword(settings?.sso_password ?? "")
        setActiveLocationContext(location.id, location.company_id ?? null)
        setLocationLoading(false)
      }
    }

    loadSettings()

    return () => {
      cancelled = true
    }
  }, [activeLocationKey])

  useEffect(() => {
    setUsername(user?.username ?? "")
    setPassword(user?.password ?? "")
  }, [user])

  const handleLocationSave = async () => {
    if (!activeLocationKey) {
      setLocationError("Select an active location below.")
      return
    }

    if (!locationId) {
      setLocationError("Location not loaded yet.")
      return
    }

    const trimmedSlug = locationSlug.trim()
    if (!trimmedSlug) {
      setLocationError("Location slug is required.")
      return
    }

    setLocationSaving(true)
    setLocationError(null)
    setLocationSuccess(null)

    if (!locationCompanyId) {
      setLocationError("Missing company for this location.")
      setLocationSaving(false)
      return
    }

    const { error: locationError } = await supabase
      .from("locations")
      .update({ name: locationName, slug: trimmedSlug })
      .eq("id", locationId)

    if (locationError) {
      setLocationError(locationError.message)
      setLocationSaving(false)
      return
    }

    const { error: settingsError } = await supabase
      .from("settings")
      .upsert(
        {
          location_id: locationId,
          company_id: locationCompanyId,
          sso_username: ssoUsername || null,
          sso_password: ssoPassword || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "location_id" }
      )

    if (settingsError) {
      setLocationError(settingsError.message)
      setLocationSaving(false)
      return
    }

    await fetchLocations()
    setLocationSuccess("Location settings saved.")
    setLocationSaving(false)
  }

  const handleUnlockSuperAdmin = () => {
    const expectedUsername = import.meta.env.VITE_SUPERADMIN_USERNAME as string | undefined
    const expectedPassword = import.meta.env.VITE_SUPERADMIN_PASSWORD as string | undefined

    if (!expectedUsername || !expectedPassword) {
      setSuperAdminError("Missing VITE_SUPERADMIN_USERNAME or VITE_SUPERADMIN_PASSWORD in .env.")
      return
    }

    if (superAdminUsername !== expectedUsername || superAdminPassword !== expectedPassword) {
      setSuperAdminError("Invalid super admin credentials.")
      return
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUPER_ADMIN_STORAGE_KEY, "true")
    }
    setSuperAdminUnlocked(true)
    setSuperAdminError(null)
    setSuperAdminPassword("")
  }

  const handleLockSuperAdmin = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SUPER_ADMIN_STORAGE_KEY)
    }
    setSuperAdminUnlocked(false)
    setSuperAdminUsername("")
    setSuperAdminPassword("")
    setSuperAdminError(null)
  }

  const handleSetActiveLocation = (location: LocationRow) => {
    setActiveLocationContext(location.id, location.company_id)
    setActiveLocationKey(location.id)
    setActiveLocationSource("local")
    setLocationManagerError(null)
    setLocationManagerSuccess("Active location updated.")
  }

  const handleCreateLocation = async () => {
    const trimmedName = newLocationName.trim()
    const trimmedSlug = (newLocationSlug || slugify(trimmedName)).trim()

    if (!trimmedName) {
      setLocationManagerError("Location name is required.")
      return
    }

    if (!trimmedSlug) {
      setLocationManagerError("Location slug is required.")
      return
    }

    if (!newLocationCompanyId) {
      setLocationManagerError("Select a company for this location.")
      return
    }

    setLocationManagerSaving(true)
    setLocationManagerError(null)
    setLocationManagerSuccess(null)

    const { data, error } = await supabase
      .from("locations")
      .insert({ name: trimmedName, slug: trimmedSlug, company_id: newLocationCompanyId })
      .select("id, name, slug, company_id")
      .single()

    if (error) {
      setLocationManagerError(error.message)
      setLocationManagerSaving(false)
      return
    }

    await fetchLocations()
    setNewLocationName("")
    setNewLocationSlug("")
    setNewLocationSlugTouched(false)
    if (data?.id) {
      handleSetActiveLocation(data as LocationRow)
    }
    setLocationManagerSaving(false)
  }

  const updateCompanyField = (id: string, field: keyof CompanyRow, value: string) => {
    setCompanies((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  const handleSaveCompanyRow = async (row: CompanyRow) => {
    const trimmedName = row.name?.trim()
    const trimmedSlug = row.slug?.trim()

    if (!trimmedName) {
      setCompanyManagerError("Company name is required.")
      return
    }

    if (!trimmedSlug) {
      setCompanyManagerError("Company slug is required.")
      return
    }

    setCompanySavingId(row.id)
    setCompanyManagerError(null)
    setCompanyManagerSuccess(null)

    const { error } = await supabase
      .from("companies")
      .update({ name: trimmedName, slug: trimmedSlug })
      .eq("id", row.id)

    if (error) {
      setCompanyManagerError(error.message)
      setCompanySavingId(null)
      return
    }

    setCompanySavingId(null)
    setCompanyManagerSuccess("Company updated.")
    await fetchCompanies()
    await fetchLocations()
  }

  const handleCreateCompany = async () => {
    const trimmedName = newCompanyName.trim()
    const trimmedSlug = (newCompanySlug || slugify(trimmedName)).trim()

    if (!trimmedName) {
      setCompanyManagerError("Company name is required.")
      return
    }

    if (!trimmedSlug) {
      setCompanyManagerError("Company slug is required.")
      return
    }

    setNewCompanySaving(true)
    setCompanyManagerError(null)
    setCompanyManagerSuccess(null)

    const { data, error } = await supabase
      .from("companies")
      .insert({ name: trimmedName, slug: trimmedSlug })
      .select("id, name, slug")
      .single()

    if (error) {
      setCompanyManagerError(error.message)
      setNewCompanySaving(false)
      return
    }

    await fetchCompanies()
    setNewCompanyName("")
    setNewCompanySlug("")
    setNewCompanySlugTouched(false)

    if (data?.id) {
      setNewLocationCompanyId(data.id)
    }

    setCompanyManagerSuccess("Company created.")
    setNewCompanySaving(false)
  }

  const handleUserSave = async () => {
    if (!user) {
      setUserError("No user loaded.")
      return
    }

    setUserSaving(true)
    setUserError(null)
    setUserSuccess(null)

    try {
      await updateUser({ username, password })
      setUserSuccess("User settings saved.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save user settings."
      setUserError(message)
    } finally {
      setUserSaving(false)
    }
  }

  const updateUserField = (id: string | number, field: keyof UserRow, value: string) => {
    setUsers((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  const handleSaveUserRow = async (row: UserRow) => {
    if (!row.username?.trim()) {
      setUsersError("Username is required.")
      return
    }

    setUsersSavingId(row.id)
    setUsersError(null)
    setUsersSuccess(null)

    const { error } = await supabase
      .from("users")
      .update({
        username: row.username,
        password: row.password ?? null,
        role: row.role ?? "user",
      })
      .eq("id", row.id)

    if (error) {
      setUsersError(error.message)
      setUsersSavingId(null)
      return
    }

    setUsersSavingId(null)
    setUsersSuccess("User updated.")
    await fetchUsers()
  }

  const handleDeleteUserRow = async (row: UserRow) => {
    setUsersSavingId(row.id)
    setUsersError(null)
    setUsersSuccess(null)

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", row.id)

    if (error) {
      setUsersError(error.message)
      setUsersSavingId(null)
      return
    }

    setUsersSavingId(null)
    setUsersSuccess("User deleted.")
    await fetchUsers()
  }

  const handleCreateUser = async () => {
    if (!newUserName.trim()) {
      setNewUserError("Username is required.")
      return
    }

    setNewUserSaving(true)
    setNewUserError(null)

    const { error } = await supabase.from("users").insert({
      username: newUserName.trim(),
      password: newUserPassword.trim() || null,
      role: newUserRole,
      company_ids: locationCompanyId ? [locationCompanyId] : [],
    })

    if (error) {
      setNewUserError(error.message)
      setNewUserSaving(false)
      return
    }

    setNewUserName("")
    setNewUserPassword("")
    setNewUserRole("user")
    setNewUserSaving(false)
    await fetchUsers()
  }

  const renderLocationSection = () => (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Location Context</h2>
            <p className="text-sm text-muted-foreground">
              Current active location and source.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>Active location key: {activeLocationKey || "not set"}</div>
          <div>Active source: {activeLocationSource}</div>
          <div>Resolved location ID: {locationId || "not loaded"}</div>
          <div>Resolved company ID: {locationCompanyId || "not loaded"}</div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Location Manager</h2>
            <p className="text-sm text-muted-foreground">
              Choose the active location and manage locations.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Locations</Label>
          {locationsLoading ? (
            <div className="text-sm text-muted-foreground">Loading locations…</div>
          ) : locations.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No locations yet. Create one below.
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((location) => {
                const isActive = location.id === locationId
                return (
                  <div
                    key={location.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {location.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {location.slug} • {location.companies?.name ?? "Unknown company"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      disabled={isActive}
                      onClick={() => handleSetActiveLocation(location)}
                    >
                      {isActive ? "Active" : "Set Active"}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          {locationsError && (
            <div className="text-sm text-destructive">{locationsError}</div>
          )}
        </div>

        {superAdminUnlocked ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-location-company">Company</Label>
                {companiesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading companies…</div>
                ) : companies.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Create a company first to add locations.
                  </div>
                ) : (
                  <Select value={newLocationCompanyId} onValueChange={setNewLocationCompanyId}>
                    <SelectTrigger id="new-location-company">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-location-name">New Location Name</Label>
                <Input
                  id="new-location-name"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g. Sacramento Warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-location-slug">New Location Slug</Label>
                <Input
                  id="new-location-slug"
                  value={newLocationSlug}
                  onChange={(e) => {
                    setNewLocationSlugTouched(true)
                    setNewLocationSlug(e.target.value)
                  }}
                  placeholder="e.g. sacramento-01"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                {locationManagerError && <span className="text-destructive">{locationManagerError}</span>}
                {!locationManagerError && locationManagerSuccess && (
                  <span className="text-emerald-600">{locationManagerSuccess}</span>
                )}
              </div>
              <Button onClick={handleCreateLocation} disabled={locationManagerSaving || companies.length === 0}>
                {locationManagerSaving ? "Creating…" : "Create Location"}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Unlock super admin in Company settings to create or edit locations.
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Location Profile</h2>
            <p className="text-sm text-muted-foreground">
              Update the location name used across the app.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location-name">Location Name</Label>
            <Input
              id="location-name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              disabled={locationLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location-slug">Location Slug</Label>
            <Input
              id="location-slug"
              value={locationSlug}
              onChange={(e) => setLocationSlug(e.target.value)}
              disabled={locationLoading}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">DMS SSO Credentials</h2>
            <p className="text-sm text-muted-foreground">
              Stored for this location and used by the sync function later.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sso-username">SSO Username</Label>
            <Input
              id="sso-username"
              value={ssoUsername}
              onChange={(e) => setSsoUsername(e.target.value)}
              disabled={locationLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sso-password">SSO Password</Label>
            <Input
              id="sso-password"
              type="password"
              value={ssoPassword}
              onChange={(e) => setSsoPassword(e.target.value)}
              disabled={locationLoading}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {locationError && <span className="text-destructive">{locationError}</span>}
          {!locationError && locationSuccess && (
            <span className="text-emerald-600">{locationSuccess}</span>
          )}
        </div>
        <Button onClick={handleLocationSave} disabled={locationSaving || locationLoading || !locationId}>
          {locationSaving ? "Saving…" : "Save Location Settings"}
        </Button>
      </div>
    </>
  )

  const renderCompanySection = () => (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Super Admin Access</h2>
            <p className="text-sm text-muted-foreground">
              Unlock to manage companies and locations.
            </p>
          </div>
        </div>

        {superAdminUnlocked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Super admin unlocked.</div>
            <Button variant="outline" onClick={handleLockSuperAdmin}>
              Lock
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="super-admin-username">Username</Label>
                <Input
                  id="super-admin-username"
                  value={superAdminUsername}
                  onChange={(e) => setSuperAdminUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="super-admin-password">Password</Label>
                <Input
                  id="super-admin-password"
                  type="password"
                  value={superAdminPassword}
                  onChange={(e) => setSuperAdminPassword(e.target.value)}
                />
              </div>
            </div>
            {superAdminError && (
              <div className="text-sm text-destructive">{superAdminError}</div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleUnlockSuperAdmin}>Unlock</Button>
            </div>
          </div>
        )}
      </Card>

      {superAdminUnlocked && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Company Manager</h2>
              <p className="text-sm text-muted-foreground">
                Create and edit companies for your locations.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Create Company</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-company-name">Company Name</Label>
                <Input
                  id="new-company-name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Northwest Appliances"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company-slug">Company Slug</Label>
                <Input
                  id="new-company-slug"
                  value={newCompanySlug}
                  onChange={(e) => {
                    setNewCompanySlugTouched(true)
                    setNewCompanySlug(e.target.value)
                  }}
                  placeholder="e.g. northwest-appliances"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                {companyManagerError && (
                  <span className="text-destructive">{companyManagerError}</span>
                )}
                {!companyManagerError && companyManagerSuccess && (
                  <span className="text-emerald-600">{companyManagerSuccess}</span>
                )}
              </div>
              <Button onClick={handleCreateCompany} disabled={newCompanySaving}>
                {newCompanySaving ? "Creating…" : "Create Company"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Existing Companies</h3>
              <Button variant="outline" size="sm" onClick={fetchCompanies}>
                Refresh
              </Button>
            </div>

            {companiesLoading ? (
              <div className="text-sm text-muted-foreground">Loading companies…</div>
            ) : companies.length === 0 ? (
              <div className="text-sm text-muted-foreground">No companies found.</div>
            ) : (
              <div className="space-y-3">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={company.name}
                          onChange={(e) => updateCompanyField(company.id, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          value={company.slug}
                          onChange={(e) => updateCompanyField(company.id, "slug", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>ID: {company.id}</span>
                      <Button
                        size="sm"
                        onClick={() => handleSaveCompanyRow(company)}
                        disabled={companySavingId === company.id}
                      >
                        {companySavingId === company.id ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {companiesError && (
              <div className="text-sm text-destructive">{companiesError}</div>
            )}
          </div>
        </Card>
      )}
    </>
  )

  const renderUsersSection = () => (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">User Settings</h2>
            <p className="text-sm text-muted-foreground">Update your local login details.</p>
          </div>
        </div>

        <div className="space-y-4">
          <AvatarUploader />

          <div className="space-y-2">
            <Label htmlFor="user-name">User Name</Label>
            <Input
              id="user-name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!user}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!user}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {userError && <span className="text-destructive">{userError}</span>}
          {!userError && userSuccess && <span className="text-emerald-600">{userSuccess}</span>}
        </div>
        <Button onClick={handleUserSave} disabled={userSaving || !user}>
          {userSaving ? "Saving…" : "Save User Settings"}
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">User Manager</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage users with admin or user roles.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Create User</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Username</Label>
              <Input
                id="new-user-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. josh"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-role">Role</Label>
              <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as "admin" | "user")}>
                <SelectTrigger id="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {newUserError && <span className="text-destructive">{newUserError}</span>}
            </div>
            <Button onClick={handleCreateUser} disabled={newUserSaving}>
              {newUserSaving ? "Creating…" : "Create User"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Existing Users</h3>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              Refresh
            </Button>
          </div>

          {usersLoading ? (
            <div className="text-sm text-muted-foreground">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users found.</div>
          ) : (
            <div className="space-y-3">
              {users.map((row) => {
                const rowId = row.id
                return (
                  <div
                    key={String(rowId)}
                    className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                        {row.image ? (
                          <img
                            src={row.image}
                            alt={row.username ?? "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <SettingsIcon className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {row.username ?? "User"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Role: {row.role ?? "user"}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={row.username ?? ""}
                          onChange={(e) => updateUserField(rowId, "username", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={(row.role ?? "user") as string}
                          onValueChange={(value) => updateUserField(rowId, "role", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={row.password ?? ""}
                          onChange={(e) => updateUserField(rowId, "password", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>ID: {String(rowId)}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveUserRow(row)}
                          disabled={usersSavingId === rowId}
                        >
                          {usersSavingId === rowId ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteUserRow(row)}
                          disabled={usersSavingId === rowId}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-sm">
            {usersError && <span className="text-destructive">{usersError}</span>}
            {!usersError && usersSuccess && <span className="text-emerald-600">{usersSuccess}</span>}
          </div>
        </div>
      </Card>
    </>
  )

  const renderDisplaySetupSection = () => <DisplayManager section="setup" />
  const renderDisplayListSection = () => <DisplayManager section="list" />
  const renderDisplaySettingsSection = () => <DisplayManager section="settings" />

  const renderSection = (value: SettingsSection) => {
    switch (value) {
      case "company":
        return renderCompanySection()
      case "users":
        return renderUsersSection()
      case "displays-setup":
        return renderDisplaySetupSection()
      case "displays-list":
        return renderDisplayListSection()
      case "displays-settings":
        return renderDisplaySettingsSection()
      case "locations":
      default:
        return renderLocationSection()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={pageTitle} onMenuClick={onMenuClick} />

      <PageContainer className="py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {section ? (
            renderSection(resolvedSection)
          ) : (
            <Tabs defaultValue="locations">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="locations">Locations</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="locations" className="space-y-6 mt-6">
                {renderLocationSection()}
              </TabsContent>

              <TabsContent value="company" className="space-y-6 mt-6">
                {renderCompanySection()}
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-6">
                {renderUsersSection()}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
