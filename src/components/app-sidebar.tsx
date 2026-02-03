import { useEffect, useMemo, useState, type ComponentProps } from "react"
import type { ComponentType } from "react"
import {
  Building2,
  Bot,
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  Map,
  MapPin,
  Monitor,
  Package,
  ScanBarcode,
  Settings2,
  TruckIcon,
  Users,
} from "lucide-react"

import type { AppView } from "@/lib/routes"
import { LocationSwitcher } from "@/components/Navigation/LocationSwitcher"
import { NotificationBell } from "@/components/Navigation/NotificationBell"
import { NavUser } from "@/components/nav-user"
import { getActiveCompanyId, getActiveLocationId } from "@/lib/tenant"
import { useCompanies, useLocations } from "@/hooks/queries/useSettings"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  currentView: AppView
  onViewChange: (view: AppView, options?: { params?: URLSearchParams; sessionId?: string | null; replace?: boolean }) => void
}

interface NavItem {
  label: string
  icon: ComponentType<{ className?: string }>
  view: AppView
  applyParams?: (params: URLSearchParams) => void
  isActive: (currentView: AppView, params: URLSearchParams) => boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const clearPartsParams = (params: URLSearchParams) => {
  params.delete("type")
  params.delete("partsTab")
  params.delete("partsStatus")
}

const baseNavSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        view: "dashboard",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "dashboard",
      },
      {
        label: "Agent",
        icon: Bot,
        view: "agent",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "agent",
      },
      {
        label: "Activity Log",
        icon: History,
        view: "activity",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "activity",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Inventory",
        icon: ClipboardList,
        view: "inventory",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "inventory",
      },
      {
        label: "ASIS Loads",
        icon: TruckIcon,
        view: "loads",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "loads",
      },
      {
        label: "Warehouse Map",
        icon: Map,
        view: "map",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "map",
      },
      {
        label: "Scanning Sessions",
        icon: ScanBarcode,
        view: "sessions",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "sessions",
      },
    ],
  },
  {
    title: "Parts",
    items: [
      {
        label: "Parts",
        icon: Package,
        view: "parts",
        applyParams: (params) => {
          params.delete("tab")
          params.delete("status")
        },
        isActive: (currentView) => currentView === "parts",
      },
    ],
  },
  {
    title: "Data",
    items: [
      {
        label: "Products",
        icon: Database,
        view: "products",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "products",
      },
    ],
  },
]

export function AppSidebar({ currentView, onViewChange, ...props }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const [search, setSearch] = useState(() => window.location.search)
  const [companyLabel, setCompanyLabel] = useState("Company")
  const [locationLabel, setLocationLabel] = useState("Location")
  const [activeLocationKey, setActiveLocationKey] = useState(() => getActiveLocationId())
  const [activeCompanyId, setActiveCompanyId] = useState(() => getActiveCompanyId())
  const locationsQuery = useLocations()
  const companiesQuery = useCompanies()

  useEffect(() => {
    const handleChange = () => setSearch(window.location.search)
    window.addEventListener("app:locationchange", handleChange)
    window.addEventListener("popstate", handleChange)
    return () => {
      window.removeEventListener("app:locationchange", handleChange)
      window.removeEventListener("popstate", handleChange)
    }
  }, [])

  useEffect(() => {
    const handleChange = () => {
      setActiveLocationKey(getActiveLocationId())
      setActiveCompanyId(getActiveCompanyId())
    }
    window.addEventListener("app:locationchange", handleChange)
    window.addEventListener("popstate", handleChange)
    return () => {
      window.removeEventListener("app:locationchange", handleChange)
      window.removeEventListener("popstate", handleChange)
    }
  }, [])

  useEffect(() => {
    const locations = locationsQuery.data ?? []
    const companies = companiesQuery.data ?? []
    const resolvedLocation = activeLocationKey
      ? locations.find((row) => row.id === activeLocationKey || row.slug === activeLocationKey) ||
        locations.find((row) => row.company_id === activeLocationKey) ||
        null
      : null
    const resolvedCompanyId = activeCompanyId ?? resolvedLocation?.company_id ?? null
    const resolvedCompany = resolvedCompanyId
      ? companies.find((row) => row.id === resolvedCompanyId) || null
      : null

    setLocationLabel(resolvedLocation?.name || "Location")
    setCompanyLabel(resolvedCompany?.name || "Company")
  }, [activeLocationKey, activeCompanyId, locationsQuery.data, companiesQuery.data])

  const params = useMemo(() => new URLSearchParams(search), [search])
  const navSections = useMemo<NavSection[]>(
    () => [
      ...baseNavSections,
      {
        title: companyLabel,
        items: [
          {
            label: "Profile",
            icon: Building2,
            view: "settings-company",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-company",
          },
          {
            label: "Locations",
            icon: MapPin,
            view: "settings-locations",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-locations",
          },
        ],
      },
      {
        title: locationLabel,
        items: [
          {
            label: "Settings",
            icon: Settings2,
            view: "settings-location",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-location",
          },
          {
            label: "Team",
            icon: Users,
            view: "settings-users",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-users",
          },
          {
            label: "Displays",
            icon: Monitor,
            view: "settings-displays",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-displays",
          },
          {
            label: "GE Sync",
            icon: Database,
            view: "settings-gesync",
            applyParams: clearPartsParams,
            isActive: (currentView) => currentView === "settings-gesync",
          },
        ],
      },
    ],
    [companyLabel, locationLabel]
  )

  const handleNavigate = (item: NavItem) => {
    const nextParams = new URLSearchParams(window.location.search)
    item.applyParams?.(nextParams)
    onViewChange(item.view, { params: nextParams })
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleManageLocations = () => {
    const nextParams = new URLSearchParams(window.location.search)
    clearPartsParams(nextParams)
    onViewChange("settings-locations", { params: nextParams })
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleOpenProfile = () => {
    const nextParams = new URLSearchParams(window.location.search)
    clearPartsParams(nextParams)
    onViewChange("settings-profile", { params: nextParams })
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LocationSwitcher onManageLocations={handleManageLocations} />
        <div className="lg:hidden px-2 pt-2">
          <NotificationBell />
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.isActive(currentView, params)
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      size="responsive"
                      onClick={() => handleNavigate(item)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser onSettingsClick={handleOpenProfile} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
