import { useEffect, useMemo, useState } from "react"
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
import { getActiveLocationId, setActiveLocationContext } from "@/lib/tenant"
import { useLocations } from "@/hooks/queries/useSettings"
import type { LocationRecord } from "@/lib/settingsManager"

type LocationOption = LocationRecord

interface LocationSwitcherProps {
  onManageLocations?: () => void
}

export function LocationSwitcher({ onManageLocations }: LocationSwitcherProps) {
  const tenantLogoUrl = "/blue-jacket.png"
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile
  const [activeKey, setActiveKey] = useState(() => getActiveLocationId())
  const locationsQuery = useLocations()
  const locations = (locationsQuery.data ?? []) as LocationOption[]
  const loading = locationsQuery.isLoading
  const activeLocation = useMemo(() => {
    if (!activeKey) return null
    return (
      locations.find((row) => row.id === activeKey || row.slug === activeKey) ||
      locations.find((row) => row.company_id === activeKey) ||
      null
    )
  }, [locations, activeKey])

  useEffect(() => {
    const handleChange = () => setActiveKey(getActiveLocationId())
    window.addEventListener("app:locationchange", handleChange)
    window.addEventListener("popstate", handleChange)
    return () => {
      window.removeEventListener("app:locationchange", handleChange)
      window.removeEventListener("popstate", handleChange)
    }
  }, [])

  useEffect(() => {
    if (!activeLocation || !activeKey) return
    if (activeKey !== activeLocation.id) {
      setActiveLocationContext(activeLocation.id, activeLocation.company_id)
      setActiveKey(activeLocation.id)
    }
  }, [activeLocation, activeKey])

  const handleSelect = (location: LocationOption) => {
    setActiveLocationContext(location.id, location.company_id)
    setActiveKey(location.id)
    if (location.id !== activeLocation?.id) {
      window.location.reload()
    }
  }

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled className={isCollapsed ? "justify-center" : undefined}>
            <div className="bg-sidebar-primary/10 flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Loading locations…</span>
                <span className="truncate text-xs text-muted-foreground">Please wait</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeLocation) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled className={isCollapsed ? "justify-center" : undefined}>
            <div className="bg-sidebar-primary/10 flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={tenantLogoUrl} alt="Tenant logo" className="h-full w-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">No locations</span>
                <span className="truncate text-xs text-muted-foreground">Add one in settings</span>
              </div>
            )}
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
              {!isCollapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{activeLocation.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              )}
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
