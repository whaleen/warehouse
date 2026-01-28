import { LoadManagementView } from "@/components/Inventory/LoadManagementView";
import { CreateSessionView } from "@/components/Session/CreateSessionView";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";
import { ProductEnrichment } from "./components/Products/ProductEnrichment";
import { InventoryView } from "./components/Inventory/InventoryView";
import { PartsView } from "./components/Parts/PartsView";
import { DashboardView } from "./components/Dashboard/DashboardView";
import { SettingsView } from "./components/Settings/SettingsView";
import { AppSidebar } from "./components/app-sidebar";
import { getPathForView, parseRoute, isPublicRoute, isMarketingRoute, type AppView } from "@/lib/routes";
import { FloorDisplayView } from "@/components/FloorDisplay/FloorDisplayView";
import { LandingPage } from "@/components/Marketing/LandingPage";
import { PricingPage } from "@/components/Marketing/PricingPage";
import { FeaturesPage } from "@/components/Marketing/FeaturesPage";
import { LoginView } from "@/components/Auth/LoginView";
import { ResetPasswordView } from "@/components/Auth/ResetPasswordView";
import { UpdatePasswordView } from "@/components/Auth/UpdatePasswordView";
import { SignupPage } from "@/components/Marketing/SignupPage";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActivityLogView } from "@/components/Activity/ActivityLogView";
import { useUiHandedness } from "@/hooks/useUiHandedness";
import { useIsMobile } from "@/hooks/use-mobile";
import { PendingAccess } from "@/components/Auth/PendingAccess";
import { MapView } from "@/components/Map/MapView";

function App() {
  const { user, loading, logout } = useAuth();
  const uiHandedness = useUiHandedness();
  const isMobile = useIsMobile();
  const isPending = user?.role === "pending";

  const getRouteFromLocation = useCallback(() => {
    const route = parseRoute(window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    const legacyView = params.get('view');
    if (
      route.view === 'dashboard' &&
      legacyView &&
      [
        'inventory',
        'parts',
        'products',
        'settings',
        'settings-locations',
        'settings-location',
        'settings-company',
        'settings-users',
        'settings-displays',
        'settings-displays-setup',
        'settings-displays-list',
        'settings-displays-settings',
        'settings-profile',
        'loads',
        'activity',
        'create-session',
      ].includes(legacyView)
    ) {
      const mappedView = legacyView === 'settings'
        ? 'settings-location'
        : legacyView === 'settings-displays'
        ? 'settings-displays'
        : legacyView === 'settings-displays-setup' ||
          legacyView === 'settings-displays-list' ||
          legacyView === 'settings-displays-settings'
        ? 'settings-displays'
        : legacyView;
      return { view: mappedView as AppView, sessionId: null };
    }
    return route;
  }, []);

  const initialRoute = getRouteFromLocation();

  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [sessionId, setSessionId] = useState<string | null>(initialRoute.sessionId ?? null);
  const [displayId, setDisplayId] = useState<string | null>(initialRoute.displayId ?? null);

  const navigate = useCallback((view: AppView, options?: { params?: URLSearchParams; sessionId?: string | null; displayId?: string | null; replace?: boolean }) => {
    const params = options?.params ?? new URLSearchParams(window.location.search);
    const nextSessionId = options?.sessionId ?? null;
    const nextDisplayId = options?.displayId ?? null;
    params.delete('view');
    if (view === 'dashboard') {
      params.delete('type');
      params.delete('partsTab');
      params.delete('partsStatus');
    }
    const path = getPathForView(view, nextSessionId ?? undefined, nextDisplayId ?? undefined);
    const query = params.toString();
    const nextUrl = query ? `${path}?${query}` : path;
    if (options?.replace) {
      window.history.replaceState({}, '', nextUrl);
    } else {
      window.history.pushState({}, '', nextUrl);
    }
    window.dispatchEvent(new Event('app:locationchange'));
    setCurrentView(view);
    setSessionId(nextSessionId);
    setDisplayId(nextDisplayId);
  }, []);

  const handleViewChange = (view: AppView) => {
    navigate(view);
  };

  const handleSessionChange = (nextSessionId: string | null) => {
    navigate('create-session', { sessionId: nextSessionId });
  };

  useEffect(() => {
    const syncRoute = () => {
      const route = getRouteFromLocation();
      setCurrentView(route.view);
      setSessionId(route.sessionId ?? null);
      setDisplayId(route.displayId ?? null);
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('app:locationchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('app:locationchange', syncRoute);
    };
  }, [getRouteFromLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) {
      const route = getRouteFromLocation();
      navigate(route.view, { params, sessionId: route.sessionId ?? null, replace: true });
    }
  }, [getRouteFromLocation, navigate]);

  const pathname = window.location.pathname;

  // Handle public routes BEFORE auth loading check
  // These pages don't need auth state to render
  if (isPublicRoute(pathname)) {
    // Marketing routes
    if (isMarketingRoute(pathname)) {
      // If auth finished loading and user is logged in, redirect to app
      if (!loading && user) {
        if (isPending) {
          return (
            <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
              <PendingAccess email={user.email} onLogout={logout} />
            </ThemeProvider>
          );
        }
        navigate('dashboard', { replace: true });
        return null;
      }
      // Show marketing pages (even while auth is loading)
      const normalizedPath = pathname.replace(/\/+$/, '');
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          {normalizedPath.startsWith('/pricing') ? (
            <PricingPage />
          ) : normalizedPath.startsWith('/features') ? (
            <FeaturesPage />
          ) : normalizedPath.startsWith('/signup') ? (
            <SignupPage />
          ) : (
            <LandingPage />
          )}
        </ThemeProvider>
      );
    }

    // Login route
    if (pathname.startsWith('/login')) {
      // If auth finished loading and user is logged in, redirect to app
      if (!loading && user) {
        if (isPending) {
          return (
            <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
              <PendingAccess email={user.email} onLogout={logout} />
            </ThemeProvider>
          );
        }
        navigate('dashboard', { replace: true });
        return null;
      }
      // Show login page (even while auth is loading)
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <LoginView />
        </ThemeProvider>
      );
    }

    // Reset password route
    if (pathname.startsWith('/reset-password')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <ResetPasswordView />
        </ThemeProvider>
      );
    }

    // Update password route (handles both recovery link and OTP)
    if (pathname.startsWith('/update-password')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <UpdatePasswordView />
        </ThemeProvider>
      );
    }

    // Floor display route - ONLY for /display paths
    if (pathname.startsWith('/display')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-display">
          <FloorDisplayView displayId={displayId} />
        </ThemeProvider>
      );
    }

    // Fallback for any other public route - show landing page
    return (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
        <LandingPage />
      </ThemeProvider>
    );
  }

  // Protected routes: wait for auth to load
  if (loading) return null;

  // Redirect to login if not authenticated
  if (!user) {
    navigate('login', { replace: true });
    return null;
  }

  if (isPending) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
        <PendingAccess email={user.email} onLogout={logout} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SidebarProvider
        className={isMobile && uiHandedness === "right" ? "flex-row-reverse" : undefined}
      >
        <AppSidebar
          currentView={currentView}
          onViewChange={navigate}
          side={isMobile && uiHandedness === "right" ? "right" : "left"}
        />
        <SidebarInset className="bg-muted/40">
          <div className="flex min-h-screen flex-col min-w-0">
            {currentView === "dashboard" && (
              <DashboardView
                onViewChange={handleViewChange}
              />
            )}
            {currentView === "inventory" && (
              <InventoryView />
            )}
            {currentView === "parts" && (
              <PartsView />
            )}
            {currentView === "products" && (
              <ProductEnrichment
              />
            )}
            {currentView === "loads" && (
              <LoadManagementView
              />
            )}
            {currentView === "activity" && (
              <ActivityLogView />
            )}
            {currentView === "map" && (
              <MapView />
            )}
            {currentView === "create-session" && (
              <CreateSessionView
                onViewChange={handleViewChange}
                sessionId={sessionId}
                onSessionChange={handleSessionChange}
              />
            )}
            {currentView === "settings-locations" && (
              <SettingsView section="locations" />
            )}
            {currentView === "settings-location" && (
              <SettingsView section="location" />
            )}
            {currentView === "settings-company" && (
              <SettingsView section="company" />
            )}
            {currentView === "settings-users" && (
              <SettingsView section="users" />
            )}
            {currentView === "settings-profile" && (
              <SettingsView section="profile" />
            )}
            {currentView === "settings-displays" && (
              <SettingsView section="displays" />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
