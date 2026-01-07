import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Edit3, User, Hash, Package } from "lucide-react";
import type { Truck as TruckType } from "@/types/deliveries";

interface TruckCardProps {
  truck: TruckType;
  onEdit: (truck: TruckType) => void;
  deliveryCount?: number;
}

export function TruckCard({ truck, onEdit, deliveryCount = 0 }: TruckCardProps) {
  return (
    <Card className="mb-3 hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div 
              className="flex items-center justify-center w-10 h-10 rounded-lg"
              style={{ 
                backgroundColor: truck.color ? `${truck.color}20` : '#3B82F620',
                border: `2px solid ${truck.color || '#3B82F6'}`
              }}
            >
              <Truck 
                className="h-5 w-5" 
                style={{ color: truck.color || '#3B82F6' }}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg">{truck.truck_id}</h3>
                {truck.abbreviated_name && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs text-white border-0"
                    style={{ backgroundColor: truck.color || '#3B82F6' }}
                  >
                    {truck.abbreviated_name}
                  </Badge>
                )}
              </div>
              {truck.driver_name && (
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <User className="h-3 w-3" />
                  <span>{truck.driver_name}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-2">
            <Badge className={truck.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
              {truck.active ? "Active" : "Inactive"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(truck)}
              className="h-8"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Capacity:</span>
            <span className="font-medium">{truck.capacity || 'N/A'}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Deliveries:</span>
            <span className="font-medium">{deliveryCount}</span>
          </div>
        </div>

        {!truck.abbreviated_name && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ No abbreviated name set. Click Edit to add one.
          </div>
        )}
      </CardContent>
    </Card>
  );
}