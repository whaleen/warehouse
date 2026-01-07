import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Package, User, Hash, Calendar, CheckCircle } from "lucide-react";
import { DeliveryProgressBar } from "./DeliveryProgressBar";
import type { Delivery } from "@/types/deliveries";

interface DeliveryCardProps {
  delivery: Delivery;
  onScannedChange: (id: string, scanned: boolean) => void;
  onStatusUpdate: (id: string, field: 'scanned' | 'marked_for_truck' | 'staged', value: boolean) => void;
}

export function DeliveryCard({ delivery, onScannedChange, onStatusUpdate }: DeliveryCardProps) {
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

  const getLastFourCSO = (cso: string) => {
    return cso.slice(-4);
  };

  const getProductTypeColor = (type: string) => {
    const colors = {
      "WASHER": "bg-blue-50 text-blue-700 border-blue-200",
      "REFRIGERATOR": "bg-cyan-50 text-cyan-700 border-cyan-200",
      "MICROWAVE OVEN": "bg-orange-50 text-orange-700 border-orange-200",
      "GAS RANGE": "bg-red-50 text-red-700 border-red-200",
      "ELECTRIC RANGE": "bg-purple-50 text-purple-700 border-purple-200",
      "ELECTRIC DRYER": "bg-pink-50 text-pink-700 border-pink-200",
      "DISHWASHER": "bg-teal-50 text-teal-700 border-teal-200",
      "DISHWASHER BI": "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return colors[type as keyof typeof colors] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  return (
    <Card className={`mb-3 transition-all duration-200 relative overflow-hidden ${delivery.scanned ? 'ring-2 ring-green-500 bg-green-50' : 'hover:shadow-md'}`}>
      {/* Large CSO Background */}
      <div className="absolute top-0 left-0 pointer-events-none select-none z-0">
        <div className="text-8xl font-black text-gray-100 leading-none pt-2 pl-2 opacity-50">
          {getLastFourCSO(delivery.cso)}
        </div>
      </div>

      <CardContent className="p-4 relative z-10">
        {/* Progress Bar */}
        <DeliveryProgressBar 
          delivery={delivery}
          onStatusUpdate={onStatusUpdate}
        />
        
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={delivery.scanned}
              onCheckedChange={(checked) => 
                onScannedChange(delivery.id!, checked as boolean)
              }
              className="mt-1 relative z-20"
            />
            {delivery.scanned && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            {/* Truck abbreviation badge moved here */}
            {delivery.trucks?.abbreviated_name && (
              <Badge 
                variant="outline" 
                className="text-white font-bold text-xs border-0"
                style={{ 
                  backgroundColor: delivery.trucks.color || '#3B82F6',
                  color: 'white'
                }}
              >
                {delivery.trucks.abbreviated_name}
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end space-y-1">
            <Badge className={getStatusColor(delivery.status)}>
              {delivery.status}
            </Badge>
            <Badge variant="outline" className={getProductTypeColor(delivery.products?.product_type || delivery.product_type)}>
              {delivery.products?.product_type || delivery.product_type}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-sm truncate">
              {delivery.customers?.customer_name || delivery.consumer_customer_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{delivery.date}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Truck 
                className="h-3 w-3" 
                style={{ color: delivery.trucks?.color || '#6B7280' }}
              />
              <span style={{ color: delivery.trucks?.color || '#6B7280' }}>
                {delivery.trucks?.truck_id || delivery.truck_id}
              </span>
              {delivery.trucks?.abbreviated_name && (
                <Badge 
                  variant="outline" 
                  className="text-white font-bold text-xs border-0 ml-1"
                  style={{ 
                    backgroundColor: delivery.trucks.color || '#3B82F6',
                    color: 'white'
                  }}
                >
                  {delivery.trucks.abbreviated_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <MapPin className="h-3 w-3" />
              <span>Stop {delivery.stop}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Package className="h-3 w-3" />
              <span>Qty: {delivery.qty}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                <Hash className="h-3 w-3 text-gray-400" />
                <span className="text-gray-500">CSO:</span>
                <span className="font-mono">{delivery.cso}</span>
              </div>
              {delivery.serial && (
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">S/N:</span>
                  <span className="font-mono text-gray-700">{delivery.serial}</span>
                </div>
              )}
            </div>
            {(delivery.products?.model || delivery.model) && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">Model:</span>
                <span className="ml-1 font-mono text-gray-700">{delivery.products?.model || delivery.model}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}