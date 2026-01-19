import { useEffect, useState } from "react"
import { ChevronsUpDown, Settings2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import supabase from "@/lib/supabase"
import { getActiveLocationId, setActiveLocationContext } from "@/lib/tenant"

type LocationOption = {
  id: string
  company_id: string
  name: string
  slug: string
  companies?: {
    name?: string | null
    slug?: string | null
  } | null
}

interface LocationSwitcherProps {
  onManageLocations?: () => void
}

export function LocationSwitcher({ onManageLocations }: LocationSwitcherProps) {
  const tenantLogoUrl = "/blue-jacket.png"
  const { isMobile } = useSidebar()
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [activeLocation, setActiveLocation] = useState<LocationOption | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadLocations = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("locations")
        .select("id, company_id, name, slug, companies:company_id (name, slug)")
        .order("created_at", { ascending: true })

      if (cancelled) return

      if (error) {
        setLocations([])
        setActiveLocation(null)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as LocationOption[]
      setLocations(rows)

      const activeKey = getActiveLocationId()
      const resolved =
        rows.find((row) => row.id === activeKey || row.slug === activeKey) ||
        rows.find((row) => row.company_id === activeKey) ||
        rows[0]

      if (resolved) {
        setActiveLocation(resolved)
        if (activeKey !== resolved.id) {
          setActiveLocationContext(resolved.id, resolved.company_id)
        }
      } else {
        setActiveLocation(null)
      }

      setLoading(false)
    }

    loadLocations()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSelect = (location: LocationOption) => {
    setActiveLocationContext(location.id, location.company_id)
    setActiveLocation(location)
    if (location.id !== activeLocation?.id) {
      window.location.reload()
    }
  }

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="bg-sidebar-primary/10 flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Loading locations…</span>
              <span className="truncate text-xs text-muted-foreground">Please wait</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeLocation) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="bg-sidebar-primary/10 flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">No locations</span>
              <span className="truncate text-xs text-muted-foreground">Add one in settings</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const subtitle = activeLocation.companies?.name
    ? `${activeLocation.companies.name} • ${activeLocation.slug}`
    : activeLocation.slug

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary/10 flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeLocation.name}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Locations
            </DropdownMenuLabel>
            {locations.map((location) => {
              const label = location.companies?.name
                ? `${location.name} • ${location.companies.name}`
                : location.name
              return (
                <DropdownMenuItem
                  key={location.id}
                  onClick={() => handleSelect(location)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border overflow-hidden bg-background">
                    <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">{location.slug}</span>
                  </div>
                </DropdownMenuItem>
              )
            })}
            {onManageLocations && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={onManageLocations}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Settings2 className="size-3.5" />
                  </div>
                  <div className="text-muted-foreground font-medium">Manage locations</div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
