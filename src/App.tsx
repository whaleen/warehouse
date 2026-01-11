import { LoadManagementView } from "@/components/Inventory/LoadManagementView";
import { CreateLoadView } from "@/components/Inventory/CreateLoadView";
import { CreateSessionView } from "@/components/Session/CreateSessionView";
import { BottomNav } from "@/components/Navigation/BottomNav";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/context/AuthContext";
import { LoginCard } from "@/components/Auth/LoginCard";
import { useEffect, useState } from "react";
import { ProductEnrichment } from "./components/Products/ProductEnrichment";
import { InventoryView } from "./components/Inventory/InventoryView";
import { DashboardView } from "./components/Dashboard/DashboardView";
import { SettingsView } from "./components/Settings/SettingsView";

function App() {
  const { user, loading } = useAuth();

  // Read initial view from URL
  const getInitialView = () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'inventory' || view === 'products' || view === 'settings' || view === 'loads' || view === 'create-load' || view === 'create-session') {
      return view;
    }
    return 'dashboard';
  };

  const [currentView, setCurrentView] = useState<
    "dashboard" | "inventory" | "products" | "settings" | "loads" | "create-load" | "create-session"
  >(getInitialView);

  // Update URL when view changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentView === 'dashboard') {
      params.delete('view');
      // Clear filters when going to dashboard
      params.delete('type');
    } else {
      params.set('view', currentView);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [currentView]);

  const handleSettingsClick = () => {
    setCurrentView("settings");
  };

  if (loading) return null;
  if (!user) return <LoginCard />;

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background pb-16">
        {currentView === "dashboard" && (
          <DashboardView
            onSettingsClick={handleSettingsClick}
            onViewChange={setCurrentView}
          />
        )}
        {currentView === "inventory" && (
          <InventoryView
            onSettingsClick={handleSettingsClick}
            onViewChange={setCurrentView}
          />
        )}
        {currentView === "products" && (
          <ProductEnrichment onSettingsClick={handleSettingsClick} />
        )}
        {currentView === "loads" && (
          <LoadManagementView
            onSettingsClick={handleSettingsClick}
            onViewChange={setCurrentView}
          />
        )}
        {currentView === "create-load" && (
          <CreateLoadView
            onSettingsClick={handleSettingsClick}
            onViewChange={setCurrentView}
          />
        )}
        {currentView === "create-session" && (
          <CreateSessionView
            onSettingsClick={handleSettingsClick}
            onViewChange={setCurrentView}
          />
        )}
        {currentView === "settings" && (
          <SettingsView onSettingsClick={handleSettingsClick} />
        )}
        <BottomNav
          // @ts-expect-error: "create-load" is not defined in BottomNav type but used in currentView 
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
