import { useEffect, useMemo, useState, type ComponentProps } from "react"
import type { ComponentType } from "react"
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  MapPin,
  Monitor,
  Package,
  ScanBarcode,
  TruckIcon,
  Users,
} from "lucide-react"

import type { AppView } from "@/lib/routes"
import { LocationSwitcher } from "@/components/Navigation/LocationSwitcher"
import { NavUser } from "@/components/nav-user"
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

const navSections: NavSection[] = [
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
        label: "Loads",
        icon: TruckIcon,
        view: "loads",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "loads" || currentView === "create-load",
      },
      {
        label: "Scanning Sessions",
        icon: ScanBarcode,
        view: "create-session",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "create-session",
      },
    ],
  },
  {
    title: "Parts",
    items: [
      {
        label: "Parts Inventory",
        icon: Package,
        view: "parts",
        applyParams: (params) => {
          params.delete("tab")
          params.delete("status")
        },
        isActive: (currentView, params) =>
          currentView === "parts" &&
          (params.get("tab") ?? "inventory") === "inventory" &&
          params.get("status") !== "reorder",
      },
      {
        label: "Parts History",
        icon: History,
        view: "parts",
        applyParams: (params) => {
          params.set("tab", "history")
          params.delete("status")
        },
        isActive: (currentView, params) =>
          currentView === "parts" &&
          params.get("tab") === "history",
      },
      {
        label: "Reorder Alerts",
        icon: AlertTriangle,
        view: "parts",
        applyParams: (params) => {
          params.delete("tab")
          params.set("status", "reorder")
        },
        isActive: (currentView, params) =>
          currentView === "parts" &&
          params.get("status") === "reorder",
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
  {
    title: "Settings",
    items: [
      {
        label: "Locations",
        icon: MapPin,
        view: "settings-locations",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-locations",
      },
      {
        label: "Company",
        icon: Building2,
        view: "settings-company",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-company",
      },
      {
        label: "Users",
        icon: Users,
        view: "settings-users",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-users",
      },
      {
        label: "Display Setup",
        icon: Monitor,
        view: "settings-displays-setup",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-displays-setup",
      },
      {
        label: "Display List",
        icon: Monitor,
        view: "settings-displays-list",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-displays-list",
      },
      {
        label: "Display Settings",
        icon: Monitor,
        view: "settings-displays-settings",
        applyParams: clearPartsParams,
        isActive: (currentView) => currentView === "settings-displays-settings",
      },
    ],
  },
]

export function AppSidebar({ currentView, onViewChange, ...props }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const [search, setSearch] = useState(() => window.location.search)

  useEffect(() => {
    const handleChange = () => setSearch(window.location.search)
    window.addEventListener("app:locationchange", handleChange)
    window.addEventListener("popstate", handleChange)
    return () => {
      window.removeEventListener("app:locationchange", handleChange)
      window.removeEventListener("popstate", handleChange)
    }
  }, [])

  const params = useMemo(() => new URLSearchParams(search), [search])

  const handleNavigate = (item: NavItem) => {
    const nextParams = new URLSearchParams(window.location.search)
    item.applyParams?.(nextParams)
    onViewChange(item.view, { params: nextParams })
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleOpenSettings = () => {
    const nextParams = new URLSearchParams(window.location.search)
    clearPartsParams(nextParams)
    onViewChange("settings-locations", { params: nextParams })
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LocationSwitcher onManageLocations={handleOpenSettings} />
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
        <NavUser onSettingsClick={handleOpenSettings} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
