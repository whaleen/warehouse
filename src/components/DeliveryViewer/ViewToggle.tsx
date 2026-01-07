import { Button } from "@/components/ui/button";
import { List, Grid2X2, LayoutGrid } from "lucide-react";

export type ViewMode = 'list' | 'compact' | 'grid';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const views = [
    {
      mode: 'list' as ViewMode,
      icon: List,
      label: 'List',
      description: 'Detailed list view'
    },
    {
      mode: 'compact' as ViewMode,
      icon: Grid2X2,
      label: 'Compact',
      description: 'Compact cards'
    },
    {
      mode: 'grid' as ViewMode,
      icon: LayoutGrid,
      label: 'Grid',
      description: 'Grid layout'
    }
  ];

  return (
    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.mode;
        
        return (
          <Button
            key={view.mode}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange(view.mode)}
            className={`h-8 px-3 ${isActive ? 'shadow-sm' : 'hover:bg-background'}`}
            title={view.description}
          >
            <Icon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{view.label}</span>
          </Button>
        );
      })}
    </div>
  );
}