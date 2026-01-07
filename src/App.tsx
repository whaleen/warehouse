import { useState } from "react";
import { DeliveriesView } from "@/components/DeliveryViewer/DeliveriesView";
import { TruckProfileView } from "@/components/TruckProfile/TruckProfileView";
import { InventoryView } from "@/components/Inventory/InventoryView";
import { ProductEnrichment } from "@/components/Products/ProductEnrichment";
import { BottomNav } from "@/components/Navigation/BottomNav";

function App() {
  const [currentView, setCurrentView] = useState<'deliveries' | 'trucks' | 'inventory' | 'products'>('inventory');

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {currentView === 'deliveries' && <DeliveriesView />}
      {currentView === 'trucks' && <TruckProfileView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'products' && <ProductEnrichment />}
      <BottomNav currentView={currentView} onViewChange={setCurrentView} />
    </div>
  );
}

export default App
