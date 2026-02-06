import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useState, lazy, Suspense, useTransition } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { MobileNav } from "./components/Navigation/MobileNav";
import { getPathForView, parseRoute, isPublicRoute, type AppView } from "@/lib/routes";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PendingAccess } from "@/components/Auth/PendingAccess";
import { PageTransition } from "@/components/ui/page-transition";
import { OverlayStack } from "@/components/Layout/OverlayStack";
import { ScannerOverlayProvider } from "@/context/ScannerOverlayContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import { SpeedInsights } from "@vercel/speed-insights/react";
// import { BreakpointIndicator } from "@/components/Dev/BreakpointIndicator";

// Lazy load heavy components for code splitting
const LoadManagementView = lazy(() => import("@/components/Inventory/LoadManagementView").then(m => ({ default: m.LoadManagementView })));
const SessionsView = lazy(() => import("@/components/Session/SessionsView").then(m => ({ default: m.SessionsView })));
const ProductEnrichment = lazy(() => import("./components/Products/ProductEnrichment").then(m => ({ default: m.ProductEnrichment })));
const InventoryView = lazy(() => import("./components/Inventory/InventoryView").then(m => ({ default: m.InventoryView })));
const PartsView = lazy(() => import("./components/Parts/PartsView").then(m => ({ default: m.PartsView })));
const DashboardView = lazy(() => import("./components/Dashboard/DashboardView").then(m => ({ default: m.DashboardView })));
const SettingsView = lazy(() => import("./components/Settings/SettingsView").then(m => ({ default: m.SettingsView })));
const GESyncView = lazy(() => import("./components/Settings/GESyncView").then(m => ({ default: m.GESyncView })));
const FloorDisplayView = lazy(() => import("@/components/FloorDisplay/FloorDisplayView").then(m => ({ default: m.FloorDisplayView })));
const LoginView = lazy(() => import("@/components/Auth/LoginView").then(m => ({ default: m.LoginView })));
const SignupView = lazy(() => import("@/components/Auth/SignupView").then(m => ({ default: m.SignupView })));
const ResetPasswordView = lazy(() => import("@/components/Auth/ResetPasswordView").then(m => ({ default: m.ResetPasswordView })));
const UpdatePasswordView = lazy(() => import("@/components/Auth/UpdatePasswordView").then(m => ({ default: m.UpdatePasswordView })));
const ActivityLogView = lazy(() => import("@/components/Activity/ActivityLogView").then(m => ({ default: m.ActivityLogView })));
const MapView = lazy(() => import("@/components/Map/MapView").then(m => ({ default: m.MapView })));
const AgentView = lazy(() => import("@/components/Agent/AgentView").then(m => ({ default: m.AgentView })));
const DataQualityDashboard = lazy(() => import("@/components/Dashboard/DataQualityDashboard").then(m => ({ default: m.DataQualityDashboard })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes (inventory changes slowly)
      gcTime: 1000 * 60 * 30,        // 30 minutes cache retention
      retry: 1,
      refetchOnWindowFocus: false,   // Warehouse kiosks stay open
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  const { user, loading, logout } = useAuth();
  const [, startTransition] = useTransition();
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
        'settings-gesync',
        'loads',
        'activity',
        'sessions',
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
        : legacyView === 'create-session'
        ? 'sessions'
        : legacyView;
      return { view: mappedView as AppView, sessionId: null };
    }
    return route;
  }, []);

  const initialRoute = getRouteFromLocation();

  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
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
    startTransition(() => {
      setCurrentView(view);
      setDisplayId(nextDisplayId);
    });
  }, []);

  const handleViewChange = (view: AppView) => {
    navigate(view);
  };


  useEffect(() => {
    const syncRoute = () => {
      const route = getRouteFromLocation();
      startTransition(() => {
        setCurrentView(route.view);
        setDisplayId(route.displayId ?? null);
      });
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('app:locationchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('app:locationchange', syncRoute);
    };
  }, [getRouteFromLocation, startTransition]);

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
          <Suspense fallback={null}>
            <PageTransition>
              <LoginView />
            </PageTransition>
          </Suspense>
        </ThemeProvider>
      );
    }

    // Reset password route
    if (pathname.startsWith('/reset-password')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <Suspense fallback={null}>
            <PageTransition>
              <ResetPasswordView />
            </PageTransition>
          </Suspense>
        </ThemeProvider>
      );
    }

    // Update password route (handles both recovery link and OTP)
    if (pathname.startsWith('/update-password')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <Suspense fallback={null}>
            <PageTransition>
              <UpdatePasswordView />
            </PageTransition>
          </Suspense>
        </ThemeProvider>
      );
    }

    // Signup route
    if (pathname.startsWith('/signup')) {
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
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-marketing">
          <Suspense fallback={null}>
            <PageTransition>
              <SignupView />
            </PageTransition>
          </Suspense>
        </ThemeProvider>
      );
    }

    // Floor display route - ONLY for /display paths
    if (pathname.startsWith('/display')) {
      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-display">
            <Suspense fallback={null}>
              <PageTransition>
                <FloorDisplayView displayId={displayId} />
              </PageTransition>
            </Suspense>
          </ThemeProvider>
        </QueryClientProvider>
      );
    }

    return null;
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
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <ScannerOverlayProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        {isMobile ? (
          <>
            <div className="bg-muted/40 flex min-h-screen flex-col min-w-0">
              <Suspense fallback={null}>
                <PageTransition className="flex-1 min-h-0">
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
                    {currentView === "agent" && (
                      <AgentView />
                    )}
                    {currentView === "data-quality" && (
                      <DataQualityDashboard />
                    )}
                    {currentView === "sessions" && (
                        <SessionsView
                          onViewChange={handleViewChange}
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
                    {currentView === "settings-gesync" && (
                      <GESyncView />
                    )}
                  </PageTransition>
                </Suspense>
            </div>
            <MobileNav currentView={currentView} onViewChange={navigate} />
            <OverlayStack />
          </>
        ) : (
          <SidebarProvider>
            <AppSidebar
              currentView={currentView}
              onViewChange={navigate}
              side="left"
            />
            <SidebarInset className="bg-muted/40">
              <div className="flex min-h-screen flex-col min-w-0">
                <Suspense fallback={null}>
                  <PageTransition className="flex-1 min-h-0">
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
                    {currentView === "agent" && (
                      <AgentView />
                    )}
                    {currentView === "data-quality" && (
                      <DataQualityDashboard />
                    )}
                    {currentView === "sessions" && (
                        <SessionsView
                          onViewChange={handleViewChange}
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
                    {currentView === "settings-gesync" && (
                      <GESyncView />
                    )}
                  </PageTransition>
                </Suspense>
              </div>
            </SidebarInset>
            <OverlayStack />
          </SidebarProvider>
        )}
          </ThemeProvider>
        </ScannerOverlayProvider>
      </RealtimeProvider>
      <SpeedInsights />

    </QueryClientProvider>
  );
}

export default App;
