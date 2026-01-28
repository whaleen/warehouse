import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useState, lazy, Suspense, useTransition } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { getPathForView, parseRoute, isPublicRoute, isMarketingRoute, type AppView } from "@/lib/routes";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUiHandedness } from "@/hooks/useUiHandedness";
import { useIsMobile } from "@/hooks/use-mobile";
import { PendingAccess } from "@/components/Auth/PendingAccess";
import { PageTransition } from "@/components/ui/page-transition";

// Lazy load heavy components for code splitting
const LoadManagementView = lazy(() => import("@/components/Inventory/LoadManagementView").then(m => ({ default: m.LoadManagementView })));
const CreateSessionView = lazy(() => import("@/components/Session/CreateSessionView").then(m => ({ default: m.CreateSessionView })));
const ProductEnrichment = lazy(() => import("./components/Products/ProductEnrichment").then(m => ({ default: m.ProductEnrichment })));
const InventoryView = lazy(() => import("./components/Inventory/InventoryView").then(m => ({ default: m.InventoryView })));
const PartsView = lazy(() => import("./components/Parts/PartsView").then(m => ({ default: m.PartsView })));
const DashboardView = lazy(() => import("./components/Dashboard/DashboardView").then(m => ({ default: m.DashboardView })));
const SettingsView = lazy(() => import("./components/Settings/SettingsView").then(m => ({ default: m.SettingsView })));
const FloorDisplayView = lazy(() => import("@/components/FloorDisplay/FloorDisplayView").then(m => ({ default: m.FloorDisplayView })));
const LandingPage = lazy(() => import("@/components/Marketing/LandingPage").then(m => ({ default: m.LandingPage })));
const PricingPage = lazy(() => import("@/components/Marketing/PricingPage").then(m => ({ default: m.PricingPage })));
const FeaturesPage = lazy(() => import("@/components/Marketing/FeaturesPage").then(m => ({ default: m.FeaturesPage })));
const LoginView = lazy(() => import("@/components/Auth/LoginView").then(m => ({ default: m.LoginView })));
const ResetPasswordView = lazy(() => import("@/components/Auth/ResetPasswordView").then(m => ({ default: m.ResetPasswordView })));
const UpdatePasswordView = lazy(() => import("@/components/Auth/UpdatePasswordView").then(m => ({ default: m.UpdatePasswordView })));
const SignupPage = lazy(() => import("@/components/Marketing/SignupPage").then(m => ({ default: m.SignupPage })));
const ActivityLogView = lazy(() => import("@/components/Activity/ActivityLogView").then(m => ({ default: m.ActivityLogView })));
const MapView = lazy(() => import("@/components/Map/MapView").then(m => ({ default: m.MapView })));


function App() {
  const { user, loading, logout } = useAuth();
  const [, startTransition] = useTransition();
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
  }, [startTransition]);

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
    startTransition(() => {
      setCurrentView(view);
      setSessionId(nextSessionId);
      setDisplayId(nextDisplayId);
    });
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
      startTransition(() => {
        setCurrentView(route.view);
        setSessionId(route.sessionId ?? null);
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
          <Suspense fallback={null}>
            <PageTransition>
              {normalizedPath.startsWith('/pricing') ? (
                <PricingPage />
              ) : normalizedPath.startsWith('/features') ? (
                <FeaturesPage />
              ) : normalizedPath.startsWith('/signup') ? (
                <SignupPage />
              ) : (
                <LandingPage />
              )}
            </PageTransition>
          </Suspense>
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

    // Floor display route - ONLY for /display paths
    if (pathname.startsWith('/display')) {
      return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme-display">
          <Suspense fallback={null}>
            <PageTransition>
              <FloorDisplayView displayId={displayId} />
            </PageTransition>
          </Suspense>
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
            <Suspense fallback={null}>
              <PageTransition>
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
              </PageTransition>
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
