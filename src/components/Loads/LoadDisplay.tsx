/**
 * Unified Load Display Component
 *
 * Single source of truth for load visual representation across all views.
 * Uses styles from InventoryVisualGuide - vibrant ASIS colors, grayscale non-ASIS, muted UI states.
 */

import { Badge } from '@/components/ui/badge';
import { BucketPill } from '@/components/ui/bucket-pill';
import { Button } from '@/components/ui/button';
import { CsoValue } from '@/components/ui/cso-value';
import { Package, PackageCheck, TruckIcon, ShoppingCart, Warehouse, Edit, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import type { LoadMetadata } from '@/types/inventory';
import { cn } from '@/lib/utils';

interface LoadDisplayProps {
  load: LoadMetadata;
  variant?: 'card' | 'compact' | 'sidebar' | 'marker';
  showProgress?: boolean;
  showCSO?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onViewOnMap?: () => void;
  className?: string;
}

// Icons for non-ASIS inventory types (from visual guide)
const INVENTORY_TYPE_ICONS = {
  FG: Package,
  STA: PackageCheck,
  BackHaul: TruckIcon,
  WillCall: ShoppingCart,
  Inbound: Warehouse,
} as const;

// Grayscale colors for non-ASIS types (from visual guide)
const INVENTORY_TYPE_COLORS = {
  FG: '#71717a',      // gray-500
  STA: '#52525b',     // gray-600
  BackHaul: '#3f3f46', // gray-700
  WillCall: '#a1a1aa', // gray-400
  Inbound: '#27272a',  // gray-800
} as const;

export function LoadDisplay({
  load,
  variant = 'card',
  showProgress = true,
  showCSO = true,
  showActions = true,
  onEdit,
  onViewOnMap,
  className,
}: LoadDisplayProps) {
  const isASIS = load.inventory_type === 'ASIS';
  const isSalvage = load.category?.toLowerCase() === 'salvage';
  const loadColor = load.primary_color || '#9ca3af'; // Default gray if no color
  const displayName = load.friendly_name || load.sub_inventory_name;

  // Get GE status for display
  const geStatus = load.ge_source_status || load.ge_cso_status || '';
  const isSold = geStatus.toLowerCase().includes('sold');
  const isShipped = geStatus.toLowerCase().includes('shipped');
  const isPicked = geStatus.toLowerCase().includes('picked');

  // Determine what prep is required (salvage loads never require wrapping or tagging)
  const wrappingRequired = !isSalvage && (isShipped || isSold);
  const taggingRequired = !isSalvage && isSold;

  // Get scanning progress
  const scanningProgress = load.items_scanned_count && load.items_total_count
    ? Math.round((load.items_scanned_count / load.items_total_count) * 100)
    : 0;

  // Sanity check status
  const sanityRequested = load.sanity_check_requested && !load.sanity_check_completed_at;
  const sanityCompleted = load.sanity_check_requested && !!load.sanity_check_completed_at;

  // Get icon for non-ASIS types
  const TypeIcon = INVENTORY_TYPE_ICONS[load.inventory_type as keyof typeof INVENTORY_TYPE_ICONS];
  const typeColor = INVENTORY_TYPE_COLORS[load.inventory_type as keyof typeof INVENTORY_TYPE_COLORS];

  // Different layouts for different variants
  if (variant === 'marker') {
    // Minimal display for map marker popovers
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: isASIS ? loadColor : typeColor }}
          />
          <span className="font-medium text-sm">{displayName}</span>
        </div>
        {typeof load.ge_units === 'number' && (
          <div className="text-xs text-muted-foreground">
            {load.ge_units} {load.ge_units === 1 ? 'item' : 'items'}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    // Compact display for action items
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 p-3 rounded-lg border',
          className
        )}
        style={{
          borderLeftWidth: '4px',
          borderLeftColor: isASIS ? loadColor : typeColor,
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-5 h-5 rounded flex-shrink-0"
            style={{ backgroundColor: isASIS ? loadColor : typeColor }}
          >
            {!isASIS && TypeIcon && (
              <TypeIcon className="w-full h-full p-0.5 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate flex items-center gap-2">
              {displayName}
              {isSalvage && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-400">
                  Salvage
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {load.sub_inventory_name} • {load.ge_units || '0'} items
            </div>
          </div>
        </div>

        {showProgress && (
          <div className="flex items-center gap-1.5 flex-shrink-0 text-xs">
            {/* Wrapped status */}
            {wrappingRequired && (
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded",
                load.prep_wrapped
                  ? "text-green-700 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
              )}>
                {load.prep_wrapped ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span className="text-[10px] font-medium">W</span>
              </div>
            )}

            {/* Tagged status */}
            {taggingRequired && (
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded",
                load.prep_tagged
                  ? "text-green-700 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
              )}>
                {load.prep_tagged ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span className="text-[10px] font-medium">T</span>
              </div>
            )}

            {/* Scanning progress */}
            {load.items_total_count ? (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="text-[10px] font-medium">{scanningProgress}%</span>
              </div>
            ) : null}

            {/* Sanity check status */}
            {sanityCompleted ? (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-green-700 dark:text-green-400">
                <CheckCircle className="w-3 h-3" />
                <span className="text-[10px] font-medium">S</span>
              </div>
            ) : sanityRequested ? (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-medium">S</span>
              </div>
            ) : null}
          </div>
        )}

        {showActions && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="flex-shrink-0">
            <Edit className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'sidebar') {
    // Sidebar display for map
    return (
      <div
        className={cn('p-4 rounded-lg border space-y-3', className)}
        style={{
          borderLeftWidth: '4px',
          borderLeftColor: isASIS ? loadColor : typeColor,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded"
              style={{ backgroundColor: isASIS ? loadColor : typeColor }}
            >
              {!isASIS && TypeIcon && (
                <TypeIcon className="w-full h-full p-1 text-white" />
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">{displayName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <BucketPill bucket={load.inventory_type} />
                <span>• {load.ge_units || '0'} items</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isSalvage && (
            <Badge className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-400">
              Salvage
            </Badge>
          )}
          {showCSO && load.ge_cso && (
            <Badge variant="outline" className="text-xs">
              CSO: <CsoValue value={load.ge_cso} className="font-mono" />
            </Badge>
          )}
        </div>

        {showProgress && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Wrapped */}
              <div className="flex items-center gap-1">
                {load.prep_wrapped ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : wrappingRequired ? (
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                ) : (
                  <span className="w-3 h-3 text-gray-400">⊘</span>
                )}
                <span className="text-muted-foreground">Wrapped</span>
              </div>

              {/* Tagged */}
              <div className="flex items-center gap-1">
                {load.prep_tagged ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : taggingRequired ? (
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                ) : (
                  <span className="w-3 h-3 text-gray-400">⊘</span>
                )}
                <span className="text-muted-foreground">Tagged</span>
              </div>

              {/* Scanned */}
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {scanningProgress}% Scanned
                </span>
              </div>

              {/* Sanity Check */}
              <div className="flex items-center gap-1">
                {sanityCompleted ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : sanityRequested ? (
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                ) : (
                  <span className="w-3 h-3 text-gray-400">⊘</span>
                )}
                <span className="text-muted-foreground">Sanity</span>
              </div>
            </div>
          </div>
        )}

        {showActions && (onEdit || onViewOnMap) && (
          <div className="flex gap-2 pt-2 border-t">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
            {onViewOnMap && (
              <Button variant="outline" size="sm" onClick={onViewOnMap} className="flex-1">
                <MapPin className="w-3 h-3 mr-1" />
                View
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default: card variant - full detail
  return (
    <div
      className={cn('p-6 rounded-lg border space-y-4', className)}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isASIS ? loadColor : typeColor,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded"
            style={{ backgroundColor: isASIS ? loadColor : typeColor }}
          >
            {!isASIS && TypeIcon && (
              <TypeIcon className="w-full h-full p-1.5 text-white" />
            )}
          </div>
          <div>
            <div className="font-semibold">{displayName}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span>{load.sub_inventory_name}</span>
              <BucketPill bucket={load.inventory_type} />
              {isSalvage && <Badge variant="outline">Salvage</Badge>}
            </div>
          </div>
        </div>

        {showActions && onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Load
          </Button>
        )}
      </div>

      {/* GE Status & CSO */}
      <div className="flex flex-wrap gap-2">
        {isSalvage && (
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-400 border-amber-300 dark:border-amber-500/50">
            Salvage
          </Badge>
        )}
        {geStatus && (
          <Badge
            variant="secondary"
            className={cn(
              isPicked && 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
              isSold && !isPicked && 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
              isShipped && !isSold && 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
              !isPicked && !isSold && !isShipped && 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
            )}
          >
            {geStatus}
          </Badge>
        )}
        {showCSO && load.ge_cso && (
          <Badge variant="outline">CSO: <CsoValue value={load.ge_cso} className="font-mono" /></Badge>
        )}
        {load.ge_units && (
          <Badge variant="outline">{load.ge_units} items</Badge>
        )}
      </div>

      {/* Work Progress */}
      {showProgress && (
        <div className="space-y-3">
          <div className="text-sm font-medium">Work Progress</div>
          <div className="grid grid-cols-2 gap-3">
            {/* Wrapped */}
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              {load.prep_wrapped ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : wrappingRequired ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <span className="w-4 h-4 text-gray-400 flex items-center justify-center">⊘</span>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">Wrapped</div>
                <div className="text-xs text-muted-foreground">
                  {load.prep_wrapped ? 'Complete' : wrappingRequired ? 'Required' : 'Not required'}
                </div>
              </div>
            </div>

            {/* Tagged */}
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              {load.prep_tagged ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : taggingRequired ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <span className="w-4 h-4 text-gray-400 flex items-center justify-center">⊘</span>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">Tagged</div>
                <div className="text-xs text-muted-foreground">
                  {load.prep_tagged ? 'Complete' : taggingRequired ? 'Required' : 'Not required'}
                </div>
              </div>
            </div>

            {/* Scanned/Mapped */}
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">Scanned</div>
                <div className="text-xs text-muted-foreground">
                  {load.items_scanned_count || 0} / {load.items_total_count || load.ge_units || 0} ({scanningProgress}%)
                </div>
              </div>
            </div>

            {/* Sanity Check */}
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              {sanityCompleted ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : sanityRequested ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : (
                <span className="w-4 h-4 text-gray-400 flex items-center justify-center">⊘</span>
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">Sanity Check</div>
                <div className="text-xs text-muted-foreground">
                  {sanityCompleted
                    ? 'Complete'
                    : sanityRequested
                      ? 'Requested'
                      : 'Not requested'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {load.notes && (
        <div className="pt-3 border-t">
          <div className="text-sm font-medium mb-1">Notes</div>
          <div className="text-sm text-muted-foreground">{load.notes}</div>
        </div>
      )}
    </div>
  );
}
