import { useState } from "react";
import { DashboardView } from "@/components/Dashboard/DashboardView";
import { DeliveriesView } from "@/components/DeliveryViewer/DeliveriesView";
import { TruckProfileView } from "@/components/TruckProfile/TruckProfileView";
import { InventoryView } from "@/components/Inventory/InventoryView";
import { ProductEnrichment } from "@/components/Products/ProductEnrichment";
import { BottomNav } from "@/components/Navigation/BottomNav";
import { ThemeProvider } from "@/components/theme-provider"

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'deliveries' | 'trucks' | 'inventory' | 'products'>('dashboard');

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background pb-16">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'deliveries' && <DeliveriesView />}
        {currentView === 'trucks' && <TruckProfileView />}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'products' && <ProductEnrichment />}
        <BottomNav currentView={currentView} onViewChange={setCurrentView} />
      </div>
    </ThemeProvider>
  );
}

export default App
