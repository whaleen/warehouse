import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, Truck, MapPin } from "lucide-react";
import type { Delivery } from "@/types/deliveries";

interface DeliveryCardCompactProps {
  delivery: Delivery;
  onStatusUpdate: (id: string, field: 'scanned' | 'marked_for_truck' | 'staged', value: boolean) => void;
}

export function DeliveryCardCompact({ delivery, onStatusUpdate }: DeliveryCardCompactProps) {
  const getLastFourCSO = (cso: string) => {
    return cso.slice(-4);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "picked":
        return "bg-green-100 text-green-800 border-green-200";
      case "delivered":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getCurrentStage = () => {
    if (delivery.staged) return 3;
    if (delivery.marked_for_truck) return 2;
    if (delivery.scanned) return 1;
    return 0;
  };

  const stages = [
    {
      key: 'scanned' as const,
      icon: Package,
      completed: delivery.scanned,
      color: '#10B981'
    },
    {
      key: 'marked_for_truck' as const,
      icon: Truck,
      completed: delivery.marked_for_truck,
      color: delivery.trucks?.color || '#3B82F6'
    },
    {
      key: 'staged' as const,
      icon: MapPin,
      completed: delivery.staged,
      color: '#8B5CF6'
    }
  ];

  const currentStage = getCurrentStage();

  const handleStageClick = (stage: typeof stages[0]) => {
    onStatusUpdate(delivery.id!, stage.key, !stage.completed);
  };

  return (
    <Card className={`transition-all duration-200 relative overflow-hidden h-32 ${delivery.staged ? 'ring-2 ring-purple-400 bg-purple-50' : delivery.marked_for_truck ? 'ring-1 ring-blue-300 bg-blue-50' : delivery.scanned ? 'ring-1 ring-green-300 bg-green-50' : 'hover:shadow-md'}`}>
      {/* Large CSO Background */}
      <div className="absolute top-0 right-0 pointer-events-none select-none z-0">
        <div className="text-6xl font-black text-gray-100 leading-none pt-1 pr-2 opacity-40">
          {getLastFourCSO(delivery.cso)}
        </div>
      </div>

      <CardContent className="p-3 relative z-10 h-full flex flex-col justify-between">
        {/* Top Row: Customer & Status */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {delivery.customers?.customer_name || delivery.consumer_customer_name}
            </div>
            <div className="text-xs text-gray-600 flex items-center space-x-2">
              <span className="flex items-center space-x-1">
                <span style={{ color: delivery.trucks?.color || '#6B7280' }}>
                  {delivery.trucks?.truck_id || delivery.truck_id}
                </span>
                {delivery.trucks?.abbreviated_name && (
                  <Badge 
                    variant="outline" 
                    className="text-white font-bold text-xs border-0 px-1 py-0.5"
                    style={{ 
                      backgroundColor: delivery.trucks.color || '#3B82F6',
                      fontSize: '10px'
                    }}
                  >
                    {delivery.trucks.abbreviated_name}
                  </Badge>
                )}
              </span>
              <span>•</span>
              <span>Stop {delivery.stop}</span>
            </div>
          </div>
          <Badge className={`${getStatusColor(delivery.status)} text-xs`}>
            {delivery.status}
          </Badge>
        </div>

        {/* Middle: Product Info */}
        <div className="text-xs text-gray-600 mb-2">
          <div className="truncate">
            {delivery.products?.product_type || delivery.product_type}
            {delivery.qty > 1 && <span className="ml-1">×{delivery.qty}</span>}
          </div>
          {delivery.serial && (
            <div className="truncate text-gray-500">
              S/N: {delivery.serial}
            </div>
          )}
        </div>

        {/* Bottom: Progress Stages */}
        <div className="flex items-center justify-center space-x-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = stage.completed;
            const isCurrent = index === currentStage && !stage.completed;

            return (
              <button
                key={stage.key}
                onClick={() => handleStageClick(stage)}
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
                  isActive
                    ? 'border-opacity-100 text-white'
                    : isCurrent
                    ? 'border-opacity-60 text-opacity-80'
                    : 'border-gray-300 text-gray-400'
                } hover:scale-110`}
                style={{
                  backgroundColor: isActive ? stage.color : isCurrent ? `${stage.color}20` : undefined,
                  borderColor: isActive || isCurrent ? stage.color : undefined,
                  color: isActive ? 'white' : isCurrent ? stage.color : undefined
                }}
              >
                {isActive ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}