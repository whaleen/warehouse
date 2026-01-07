import { CheckCircle, Package, Truck, MapPin } from "lucide-react";
import type { Delivery } from "@/types/deliveries";

interface DeliveryProgressBarProps {
  delivery: Delivery;
  onStatusUpdate: (id: string, field: 'scanned' | 'marked_for_truck' | 'staged', value: boolean) => void;
}

export function DeliveryProgressBar({ delivery, onStatusUpdate }: DeliveryProgressBarProps) {
  const stages = [
    {
      key: 'scanned' as const,
      label: 'Scanned',
      subtitle: 'CSO Chalked',
      icon: Package,
      completed: delivery.scanned,
      color: '#10B981' // green
    },
    {
      key: 'marked_for_truck' as const,
      label: 'Marked',
      subtitle: 'Truck Chalked',
      icon: Truck,
      completed: delivery.marked_for_truck,
      color: delivery.trucks?.color || '#3B82F6' // truck color or blue
    },
    {
      key: 'staged' as const,
      label: 'Staged',
      subtitle: 'Ready for Delivery',
      icon: MapPin,
      completed: delivery.staged,
      color: '#8B5CF6' // purple
    }
  ];

  const getCurrentStage = () => {
    if (delivery.staged) return 3;
    if (delivery.marked_for_truck) return 2;
    if (delivery.scanned) return 1;
    return 0;
  };

  const currentStage = getCurrentStage();

  const handleStageClick = (stage: typeof stages[0]) => {
    // Toggle the specific stage
    onStatusUpdate(delivery.id!, stage.key, !stage.completed);
  };

  return (
    <div className="mb-3">
      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-2">
        {stages.map((stage, index) => {
          const isActive = index < currentStage;
          const isCurrent = index === currentStage && !stage.completed;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex-1 flex items-center">
              {/* Stage Circle */}
              <button
                onClick={() => handleStageClick(stage)}
                className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  stage.completed
                    ? 'bg-opacity-100 border-opacity-100 text-white'
                    : isCurrent
                    ? 'bg-opacity-20 border-opacity-60 text-opacity-80'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                } hover:scale-105`}
                style={{
                  backgroundColor: stage.completed ? stage.color : isCurrent ? `${stage.color}20` : undefined,
                  borderColor: stage.completed || isCurrent ? stage.color : undefined,
                  color: stage.completed ? 'white' : isCurrent ? stage.color : undefined
                }}
              >
                {stage.completed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </button>

              {/* Progress Line */}
              {index < stages.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-gray-200">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{
                      width: index < currentStage - 1 ? '100%' : '0%',
                      backgroundColor: index < currentStage - 1 ? stages[index].color : '#E5E7EB'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Labels */}
      <div className="flex items-center justify-between text-xs">
        {stages.map((stage, index) => {
          const isActive = stage.completed;
          const isCurrent = index === currentStage && !stage.completed;

          return (
            <div key={`${stage.key}-label`} className="flex-1 text-center">
              <div 
                className={`font-medium ${
                  isActive ? 'text-gray-900' : isCurrent ? 'text-gray-700' : 'text-gray-400'
                }`}
                style={{ color: isActive || isCurrent ? stage.color : undefined }}
              >
                {stage.label}
              </div>
              <div className="text-gray-500 text-xs">
                {stage.subtitle}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}