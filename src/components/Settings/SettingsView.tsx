import { AppHeader } from "@/components/Navigation/AppHeader"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings as SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { PageContainer } from "@/components/Layout/PageContainer"
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
import { getStoredUiHandedness, setStoredUiHandedness, type UiHandedness } from "@/lib/uiPreferences"
import { useTheme } from "@/components/theme-provider"
import {
  useCompanies,
  useCreateCompany,
  useCreateLocation,
  useLocationSettings,
  useLocations,
  useUpdateCompany,
  useUpdateLocation,
  useUpdateUserProfile,
  useUpsertSettings,
  useUsers,
} from "@/hooks/queries/useSettings"
import type { LocationRecord, CompanyRecord, UserRecord } from "@/lib/settingsManager"

interface SettingsViewProps {
  onMenuClick?: () => void
  section?: SettingsSection
}

type LocationRow = LocationRecord
type CompanyRow = CompanyRecord
type UserRow = UserRecord

const SUPER_ADMIN_STORAGE_KEY = "super_admin_unlocked"

type SettingsSection =
  | "locations"
  | "location"
  | "company"
  | "users"
  | "profile"
  | "displays"

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export function SettingsView({ onMenuClick, section }: SettingsViewProps) {
  const isMobile = useIsMobile();
  const { user, updateUser, updatePassword } = useAuth()
  const { theme, setTheme } = useTheme()
  const resolvedSection: SettingsSection = section ?? "location"
  const sectionTitles: Record<SettingsSection, string> = {
    locations: "Locations",
    location: "Location Settings",
    company: "Company Profile",
    users: "Team",
    profile: "User Settings",
    displays: "Displays",
  }
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
  const locationsQuery = useLocations()
  const companiesQuery = useCompanies()
  const usersQuery = useUsers()
  const locationSettingsQuery = useLocationSettings(activeLocationKey)
  const updateLocationMutation = useUpdateLocation()
  const upsertSettingsMutation = useUpsertSettings()
  const createLocationMutation = useCreateLocation()
  const updateCompanyMutation = useUpdateCompany()
  const createCompanyMutation = useCreateCompany()
  const updateUserMutation = useUpdateUserProfile()
  const refetchCompanies = companiesQuery.refetch
  const refetchUsers = usersQuery.refetch
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationCompanyId, setLocationCompanyId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState("")
  const [locationSlug, setLocationSlug] = useState("")
  const [ssoUsername, setSsoUsername] = useState("")
  const [ssoPassword, setSsoPassword] = useState("")
  const [uiHandedness, setUiHandedness] = useState<UiHandedness>(() => getStoredUiHandedness())
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [newLocationName, setNewLocationName] = useState("")
  const [newLocationSlug, setNewLocationSlug] = useState("")
  const [newLocationSlugTouched, setNewLocationSlugTouched] = useState(false)
  const [newLocationCompanyId, setNewLocationCompanyId] = useState<string>("")
  const [locationManagerSaving, setLocationManagerSaving] = useState(false)
  const [locationManagerError, setLocationManagerError] = useState<string | null>(null)
  const [locationManagerSuccess, setLocationManagerSuccess] = useState<string | null>(null)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null)
  const [username, setUsername] = useState(user?.username ?? "")
  const [password, setPassword] = useState("")
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [userSuccess, setUserSuccess] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [usersSavingId, setUsersSavingId] = useState<string | number | null>(null)
  const [usersSuccess, setUsersSuccess] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
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

  const locationsLoading = locationsQuery.isLoading
  const locationsQueryError =
    locationsQuery.error instanceof Error ? locationsQuery.error.message : null
  const companiesLoading = companiesQuery.isLoading
  const companiesQueryError =
    companiesQuery.error instanceof Error ? companiesQuery.error.message : null
  const usersLoading = usersQuery.isLoading
  const usersQueryError =
    usersQuery.error instanceof Error ? usersQuery.error.message : null
  const locationLoading = locationSettingsQuery.isLoading

  const companyLabel = companies.find((company) => company.id === locationCompanyId)?.name ?? ""
  const locationLabel = locationName || ""
  const sectionContext =
    resolvedSection === "company" || resolvedSection === "locations"
      ? companyLabel
      : resolvedSection === "location" || resolvedSection === "users" || resolvedSection === "displays"
      ? locationLabel
      : ""
  const pageTitle = section
    ? `Settings / ${sectionTitles[resolvedSection]}${sectionContext ? ` · ${sectionContext}` : ""}`
    : "Settings"

  const roles = ["pending", "member", "admin"] as const

  useEffect(() => {
    if (!newLocationSlugTouched) {
      setNewLocationSlug(slugify(newLocationName))
    }
  }, [newLocationName, newLocationSlugTouched])

  useEffect(() => {
    if (locationsQuery.data) {
      setLocations(locationsQuery.data)
    }
  }, [locationsQuery.data])

  useEffect(() => {
    if (companiesQuery.data) {
      setCompanies(companiesQuery.data)
    }
  }, [companiesQuery.data])

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(usersQuery.data)
    }
  }, [usersQuery.data])

  useEffect(() => {
    if (locationCompanyId) {
      setNewLocationCompanyId(locationCompanyId)
    }
  }, [locationCompanyId])

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

  useEffect(() => {
    if (!activeLocationKey) {
      setLocationError("Select an active location below.")
      setLocationId(null)
      setLocationCompanyId(null)
      setLocationName("")
      setLocationSlug("")
      setSsoUsername("")
      setSsoPassword("")
      return
    }

    setLocationError(null)
    setLocationSuccess(null)

    if (locationSettingsQuery.error) {
      const message =
        locationSettingsQuery.error instanceof Error
          ? locationSettingsQuery.error.message
          : "Failed to load location settings."
      setLocationError(message)
      return
    }

    if (!locationSettingsQuery.data) return

    const { location, settings } = locationSettingsQuery.data
    setLocationId(location.id)
    setLocationCompanyId(location.company_id ?? null)
    setLocationName(location?.name ?? "")
    setLocationSlug(location?.slug ?? "")
    setSsoUsername(settings?.sso_username ?? "")
    setSsoPassword(settings?.sso_password ?? "")
    const resolvedHandedness =
      settings?.ui_handedness === "left" || settings?.ui_handedness === "right"
        ? (settings.ui_handedness as UiHandedness)
        : getStoredUiHandedness()
    setUiHandedness(resolvedHandedness)
    setStoredUiHandedness(resolvedHandedness)
    setActiveLocationContext(location.id, location.company_id ?? null)
  }, [activeLocationKey, locationSettingsQuery.data, locationSettingsQuery.error])

  useEffect(() => {
    setUsername(user?.username ?? "")
    setPassword("")
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

    try {
      await updateLocationMutation.mutateAsync({
        locationId,
        name: locationName,
        slug: trimmedSlug,
      })

      await upsertSettingsMutation.mutateAsync({
        locationId,
        companyId: locationCompanyId,
        ssoUsername: ssoUsername || null,
        ssoPassword: ssoPassword || null,
        uiHandedness,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save location settings."
      setLocationError(message)
      setLocationSaving(false)
      return
    }

    setStoredUiHandedness(uiHandedness)
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
    window.dispatchEvent(new Event("app:locationchange"))
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
      setLocationManagerError("Missing company for this location.")
      return
    }

    setLocationManagerSaving(true)
    setLocationManagerError(null)
    setLocationManagerSuccess(null)

    try {
      const data = await createLocationMutation.mutateAsync({
        name: trimmedName,
        slug: trimmedSlug,
        companyId: newLocationCompanyId,
      })
      setNewLocationName("")
      setNewLocationSlug("")
      setNewLocationSlugTouched(false)
      if (data?.id) {
        handleSetActiveLocation(data as LocationRow)
      }
      setLocationManagerSaving(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create location."
      setLocationManagerError(message)
      setLocationManagerSaving(false)
    }
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

    try {
      await updateCompanyMutation.mutateAsync({
        companyId: row.id,
        name: trimmedName,
        slug: trimmedSlug,
      })
      setCompanySavingId(null)
      setCompanyManagerSuccess("Company updated.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update company."
      setCompanyManagerError(message)
      setCompanySavingId(null)
      return
    }
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

    try {
      const data = await createCompanyMutation.mutateAsync({
        name: trimmedName,
        slug: trimmedSlug,
      })
      setNewCompanyName("")
      setNewCompanySlug("")
      setNewCompanySlugTouched(false)

      if (data?.id) {
        setNewLocationCompanyId(data.id)
      }

      setCompanyManagerSuccess("Company created.")
      setNewCompanySaving(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create company."
      setCompanyManagerError(message)
      setNewCompanySaving(false)
    }
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
      await updateUser({ username })
      if (password.trim()) {
        await updatePassword(password.trim())
        setPassword("")
      }
      let settingsErrorMessage: string | null = null
      if (locationId && locationCompanyId) {
        try {
          await upsertSettingsMutation.mutateAsync({
            locationId,
            companyId: locationCompanyId,
            uiHandedness,
          })
        } catch (settingsError) {
          settingsErrorMessage =
            settingsError instanceof Error ? settingsError.message : "Failed to update handedness."
        }
      }
      setStoredUiHandedness(uiHandedness)
      if (settingsErrorMessage) {
        setUserError(`Saved profile, but failed to update handedness: ${settingsErrorMessage}`)
      } else {
        setUserSuccess("User settings saved.")
      }
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

    try {
      await updateUserMutation.mutateAsync({
        id: String(row.id),
        username: row.username,
        role: row.role ?? "member",
        companyId: row.company_id ?? null,
      })
      setUsersSavingId(null)
      setUsersSuccess("User updated.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user."
      setUsersError(message)
      setUsersSavingId(null)
      return
    }
  }

  const renderLocationManagerSection = () => (
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
                      size="responsive"
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
          {locationsQueryError && (
            <div className="text-sm text-destructive">{locationsQueryError}</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Company</Label>
            <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
              {companyLabel || "Unknown company"}
            </div>
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
          <Button onClick={handleCreateLocation} disabled={locationManagerSaving || !locationCompanyId}>
            {locationManagerSaving ? "Creating…" : "Create Location"}
          </Button>
        </div>
      </Card>
    </>
  )

  const renderLocationSettingsSection = () => (
    <>
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

  const renderCompanySection = () => {
    const activeCompany = companies.find((company) => company.id === locationCompanyId)

    return (
      <>
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Company Profile</h2>
              <p className="text-sm text-muted-foreground">
                Update details for your current company.
              </p>
            </div>
          </div>

          {companiesLoading ? (
            <div className="text-sm text-muted-foreground">Loading company…</div>
          ) : !activeCompany ? (
            <div className="text-sm text-muted-foreground">
              No company found for the current location.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={activeCompany.name}
                    onChange={(e) => updateCompanyField(activeCompany.id, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={activeCompany.slug}
                    onChange={(e) => updateCompanyField(activeCompany.id, "slug", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>ID: {activeCompany.id}</span>
                <Button
                  size="responsive"
                  onClick={() => handleSaveCompanyRow(activeCompany)}
                  disabled={companySavingId === activeCompany.id}
                >
                  {companySavingId === activeCompany.id ? "Saving…" : "Save Company"}
                </Button>
              </div>
            </div>
          )}

          {companiesQueryError && (
            <div className="text-sm text-destructive">
              {companiesQueryError}
            </div>
          )}
        </Card>
      </>
    )
  }

  const renderProfileSection = () => (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">User Settings</h2>
            <p className="text-sm text-muted-foreground">Update your account details.</p>
          </div>
        </div>

        <div className="space-y-4">
          <AvatarUploader />

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-name">Display Name</Label>
            <Input
              id="user-name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!user}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">New Password</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!user}
              placeholder="Leave blank to keep current password"
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
          {userSaving ? "Saving…" : "Save Profile"}
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Interface Preferences</h2>
            <p className="text-sm text-muted-foreground">
              Customize the appearance and layout of the app.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-mode">Color Mode</Label>
            <Select
              value={theme}
              onValueChange={(value) => {
                if (value === "light" || value === "dark" || value === "system") {
                  setTheme(value)
                }
              }}
            >
              <SelectTrigger id="theme-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ui-handedness">Handedness</Label>
            <Select
              value={uiHandedness}
              onValueChange={(value) => {
                const next = value === "left" ? "left" : "right"
                setUiHandedness(next)
                setStoredUiHandedness(next)
              }}
            >
              <SelectTrigger id="ui-handedness" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right-handed</SelectItem>
                <SelectItem value="left">Left-handed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

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
              <Button variant="outline" size="responsive" onClick={() => refetchCompanies()}>
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
                        size="responsive"
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

            {companiesQueryError && (
              <div className="text-sm text-destructive">
                {companiesQueryError}
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  )

  const renderTeamSection = () => (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Team</h2>
            <p className="text-sm text-muted-foreground">
              Approve access and manage roles for signed-up users.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
          Team members sign up with their email and password. New accounts start in{" "}
          <span className="font-semibold">pending</span> status and need approval below.
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Existing Users</h3>
            <Button variant="outline" size="responsive" onClick={() => refetchUsers()}>
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
                        {row.email ?? "No email"} • Role: {row.role ?? "member"}
                      </div>
                    </div>
                  </div>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                          value={(row.role ?? "pending") as string}
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
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>ID: {String(rowId)}</span>
                      <Button
                        size="responsive"
                        onClick={() => handleSaveUserRow(row)}
                        disabled={usersSavingId === rowId}
                      >
                        {usersSavingId === rowId ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-sm">
            {(usersError ?? usersQueryError) && (
              <span className="text-destructive">{usersError ?? usersQueryError}</span>
            )}
            {!usersError && !usersQueryError && usersSuccess && (
              <span className="text-emerald-600">{usersSuccess}</span>
            )}
          </div>
        </div>
      </Card>
    </>
  )

  const renderDisplaysSection = () => <DisplayManager section="all" />

  const renderSection = (value: SettingsSection) => {
    switch (value) {
      case "company":
        return renderCompanySection()
      case "profile":
        return renderProfileSection()
      case "users":
        return renderTeamSection()
      case "displays":
        return renderDisplaysSection()
      case "locations":
        return renderLocationManagerSection()
      case "location":
        return renderLocationSettingsSection()
      default:
        return renderLocationSettingsSection()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <AppHeader title={pageTitle} onMenuClick={onMenuClick} />
      )}

      <PageContainer className="py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {section ? (
            renderSection(resolvedSection)
          ) : (
            <Tabs defaultValue="location">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="users">Team</TabsTrigger>
                <TabsTrigger value="displays">Displays</TabsTrigger>
              </TabsList>

              <TabsContent value="location" className="space-y-6 mt-6">
                {renderLocationSettingsSection()}
              </TabsContent>

              <TabsContent value="company" className="space-y-6 mt-6">
                {renderCompanySection()}
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-6">
                {renderTeamSection()}
              </TabsContent>

              <TabsContent value="displays" className="space-y-6 mt-6">
                {renderDisplaysSection()}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
