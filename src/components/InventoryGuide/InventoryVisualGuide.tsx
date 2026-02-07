/**
 * Inventory Visual Guide
 *
 * Design reference showing the three-tier color system:
 * 1. ASIS Loads - Vibrant colors for floor identification
 * 2. Non-ASIS Types - Grayscale + icons
 * 3. UI States - Muted colors + icons
 */

import { Package, PackageOpen, TruckIcon, PackageCheck, Warehouse, ShoppingCart, AlertTriangle, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { useVisualGuideData } from '@/hooks/queries/useVisualGuideData';

interface InventoryVisualGuideProps {
  onMenuClick?: () => void;
}

// ASIS Load Colors - Vibrant, saturated colors for maximum floor visibility
const ASIS_LOAD_COLORS = [
  { name: 'Red', color: '#ef4444', hex: '#ef4444' },
  { name: 'Orange', color: '#f97316', hex: '#f97316' },
  { name: 'Yellow', color: '#eab308', hex: '#eab308' },
  { name: 'Lime', color: '#84cc16', hex: '#84cc16' },
  { name: 'Green', color: '#22c55e', hex: '#22c55e' },
  { name: 'Teal', color: '#14b8a6', hex: '#14b8a6' },
  { name: 'Cyan', color: '#06b6d4', hex: '#06b6d4' },
  { name: 'Blue', color: '#3b82f6', hex: '#3b82f6' },
  { name: 'Purple', color: '#a855f7', hex: '#a855f7' },
  { name: 'Pink', color: '#ec4899', hex: '#ec4899' },
  { name: 'Magenta', color: '#d946ef', hex: '#d946ef' },
  { name: 'Coral', color: '#fb7185', hex: '#fb7185' },
];

// ASIS Subcategory variations
const ASIS_SUBCATEGORIES = [
  {
    name: 'Regular',
    usesColor: true,
    description: 'Standard ASIS loads - get color assignments and friendly names',
    example: 'Red Load, Orange Load, Blue Load'
  },
  {
    name: 'Salvage',
    usesColor: false,
    description: 'Identified by digit codes (S1, S2, S3, S6, etc.) - no color assignment',
    example: 'S1, S2, S3, S6'
  },
  {
    name: 'Scrap',
    usesColor: false,
    description: 'Not mapped, no load name - just a count displayed where needed',
    example: '15 items in Scrap'
  },
];

// Non-ASIS Inventory Types - Grayscale + Icons
const NON_ASIS_TYPES = [
  {
    code: 'FG',
    name: 'Finished Goods',
    color: '#71717a', // gray-500
    icon: Package,
    description: 'New, ready-to-sell inventory',
  },
  {
    code: 'STA',
    name: 'Staged',
    color: '#52525b', // gray-600
    icon: PackageCheck,
    description: 'Items staged for deliveries',
  },
  {
    code: 'BH',
    name: 'BackHaul',
    color: '#3f3f46', // gray-700
    icon: TruckIcon,
    description: 'Return shipments',
  },
  {
    code: 'W/C',
    name: 'WillCall',
    color: '#a1a1aa', // gray-400
    icon: ShoppingCart,
    description: 'Customer pickup orders',
  },
  {
    code: 'INB',
    name: 'Inbound',
    color: '#27272a', // gray-800
    icon: Warehouse,
    description: 'Incoming inventory',
  },
];

// UI State Colors - Muted + Icons
const UI_STATES = [
  {
    name: 'Success',
    color: '#86efac', // green-300 (muted)
    darkColor: '#4ade80', // green-400
    icon: CheckCircle,
    description: 'Positive actions, completed tasks',
    usage: 'Toast notifications, success badges, completed states',
  },
  {
    name: 'Warning',
    color: '#fcd34d', // yellow-300 (muted)
    darkColor: '#fbbf24', // yellow-400
    icon: AlertTriangle,
    description: 'Caution, requires attention',
    usage: 'Validation warnings, missing prep, upcoming deadlines',
  },
  {
    name: 'Error',
    color: '#fca5a5', // red-300 (muted)
    darkColor: '#f87171', // red-400
    icon: AlertCircle,
    description: 'Errors, critical issues',
    usage: 'Form errors, failed operations, critical alerts',
  },
  {
    name: 'Info',
    color: '#93c5fd', // blue-300 (muted)
    darkColor: '#60a5fa', // blue-400
    icon: Info,
    description: 'Informational messages',
    usage: 'Helper text, tips, neutral notifications',
  },
];

export function InventoryVisualGuide({ onMenuClick }: InventoryVisualGuideProps) {
  const { data: guideData, isLoading, error } = useVisualGuideData();

  if (isLoading) {
    return (
      <div className="h-full min-h-0 bg-background flex flex-col">
        <AppHeader title="Inventory Visual Guide" onMenuClick={onMenuClick} />
        <PageContainer className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading visual guide data...</p>
          </div>
        </PageContainer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full min-h-0 bg-background flex flex-col">
        <AppHeader title="Inventory Visual Guide" onMenuClick={onMenuClick} />
        <PageContainer className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-destructive">Failed to load guide data</p>
          </div>
        </PageContainer>
      </div>
    );
  }

  const regularLoads = guideData?.regularLoads || [];
  const salvageLoads = guideData?.salvageLoads || [];
  const scrapCount = guideData?.scrapCount || 0;

  return (
    <div className="h-full min-h-0 bg-background flex flex-col">
      <AppHeader title="Inventory Visual Guide" onMenuClick={onMenuClick} />
      <PageContainer className="flex-1 overflow-auto">
        <div className="space-y-8 pb-8">
          {/* Introduction */}
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Three-Tier Color System</h2>
              <p className="text-sm text-muted-foreground">
                Our color system prioritizes warehouse floor operations while maintaining clear UI semantics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: '#ef4444' }} />
                  <h3 className="font-semibold">1. ASIS Loads</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Vibrant, saturated colors for maximum floor visibility. Uses full spectrum including red/green/yellow.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-gray-500" />
                  <h3 className="font-semibold">2. Non-ASIS Types</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Grayscale palette with unique icons. Stays neutral to avoid competing with ASIS load colors.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: '#86efac' }} />
                  <h3 className="font-semibold">3. UI States</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Muted red/yellow/green with icons. Distinguishable from vibrant ASIS colors while maintaining semantic meaning.
                </p>
              </div>
            </div>
          </Card>

          {/* ASIS Load Colors */}
          <Card className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold mb-1">ASIS Regular Load Colors</h2>
              <p className="text-sm text-muted-foreground">
                Vibrant colors for Regular ASIS loads only. Salvage uses digit codes (S1, S2...), Scrap uses counts. Maximum saturation for visibility across the floor.
              </p>
            </div>

            {/* Color Palette - Real Loads */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Your Active Regular Loads ({regularLoads.length} total)</h3>
              {regularLoads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No regular ASIS loads found. Create loads in Load Management.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {regularLoads.map((load) => (
                    <div key={load.sub_inventory_name} className="flex flex-col items-center gap-2 p-3 border rounded-lg">
                      <div
                        className="w-16 h-16 rounded-lg shadow-sm border border-border"
                        style={{ backgroundColor: load.primary_color || '#9ca3af' }}
                      />
                      <div className="text-center w-full">
                        <div className="text-sm font-medium truncate">{load.friendly_name || 'Unnamed'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{load.primary_color || 'No color'}</div>
                        <div className="text-xs text-muted-foreground">{load.item_count} items</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subcategory Breakdown */}
            <div>
              <h3 className="text-sm font-semibold mb-3">ASIS Category Breakdown</h3>
              <p className="text-xs text-muted-foreground mb-4">
                How Regular, Salvage, and Scrap are identified and tracked in the system
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ASIS_SUBCATEGORIES.map((subcat) => {
                  return (
                    <div key={subcat.name} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        {subcat.usesColor ? (
                          <div className="w-10 h-10 rounded" style={{ backgroundColor: ASIS_LOAD_COLORS[0].color }} />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                            {subcat.name === 'Salvage' ? 'S#' : '—'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm">ASIS - {subcat.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {subcat.usesColor ? 'Uses colors' : 'No color'}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">{subcat.description}</p>

                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium mb-1">Example:</div>
                        <div className="text-xs text-muted-foreground font-mono">{subcat.example}</div>
                      </div>

                      {/* Real Data Examples */}
                      {subcat.name === 'Regular' && regularLoads.length > 0 && (
                        <div className="flex gap-2 pt-2 flex-wrap">
                          {regularLoads.slice(0, 3).map((load) => (
                            <div key={load.sub_inventory_name} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-xs">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: load.primary_color || '#9ca3af' }} />
                              <span>{load.friendly_name || load.sub_inventory_name}</span>
                            </div>
                          ))}
                          {regularLoads.length > 3 && (
                            <span className="text-xs text-muted-foreground self-center">+{regularLoads.length - 3} more</span>
                          )}
                        </div>
                      )}

                      {subcat.name === 'Salvage' && (
                        <div className="space-y-2 pt-2">
                          {salvageLoads.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {salvageLoads.map((load) => (
                                <Badge key={load.sub_inventory_name} variant="outline" className="text-xs">
                                  {load.friendly_name || load.sub_inventory_name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No salvage loads currently</p>
                          )}
                        </div>
                      )}

                      {subcat.name === 'Scrap' && (
                        <div className="pt-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded text-sm">
                            <span className="text-muted-foreground">Scrap:</span>
                            <span className="font-semibold">{scrapCount} items</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Map Marker Examples */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Map Marker Styles</h3>
              <div className="flex flex-wrap gap-6">
                {/* Solid Circle */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full" style={{ backgroundColor: ASIS_LOAD_COLORS[0].color }} />
                  <span className="text-xs text-muted-foreground">Solid Circle</span>
                </div>

                {/* Square */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded" style={{ backgroundColor: ASIS_LOAD_COLORS[1].color }} />
                  <span className="text-xs text-muted-foreground">Square</span>
                </div>

                {/* With Label */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className="w-10 h-10 rounded" style={{ backgroundColor: ASIS_LOAD_COLORS[2].color }} />
                    <div className="absolute -bottom-1 -right-1 bg-background border rounded px-1 text-[10px] font-bold">
                      A1
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">With Label</span>
                </div>
              </div>
            </div>

            {/* Badge Examples */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Badge Styles</h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: ASIS_LOAD_COLORS[0].color }} />
                  <span className="text-sm font-medium">ASIS-001</span>
                  <span className="text-xs text-muted-foreground">Last 4: 0123</span>
                </div>

                <Badge style={{ backgroundColor: ASIS_LOAD_COLORS[3].color, color: 'white' }}>
                  Lime Load
                </Badge>

                <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg" style={{ borderColor: ASIS_LOAD_COLORS[4].color }}>
                  <PackageOpen className="w-4 h-4" style={{ color: ASIS_LOAD_COLORS[4].color }} />
                  <span className="text-sm font-medium">Green Load</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Non-ASIS Inventory Types */}
          <Card className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold mb-1">Non-ASIS Inventory Types</h2>
              <p className="text-sm text-muted-foreground">
                Grayscale palette with unique icons. Neutral colors that don't compete with ASIS load identification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NON_ASIS_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.code} className="border rounded-lg p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded" style={{ backgroundColor: type.color + '20' }}>
                        <Icon className="w-5 h-5" style={{ color: type.color }} />
                      </div>
                      <div>
                        <div className="font-semibold">{type.code}</div>
                        <div className="text-xs text-muted-foreground">{type.name}</div>
                      </div>
                    </div>

                    {/* Map Marker */}
                    <div>
                      <div className="text-xs font-medium mb-2">Map Marker:</div>
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: type.color }}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[10px] text-muted-foreground">With Icon</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: type.color }} />
                          <span className="text-[10px] text-muted-foreground">Solid</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge */}
                    <div>
                      <div className="text-xs font-medium mb-2">Badge:</div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md w-fit">
                        <Icon className="w-3.5 h-3.5" style={{ color: type.color }} />
                        <span className="text-sm font-medium">{type.code}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* UI State Colors */}
          <Card className="p-6 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold mb-1">UI State Colors</h2>
              <p className="text-sm text-muted-foreground">
                Muted semantic colors with icons. Distinguishable from vibrant ASIS colors while maintaining standard red/yellow/green meaning.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {UI_STATES.map((state) => {
                const Icon = state.icon;
                return (
                  <div key={state.name} className="border rounded-lg p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: state.color }} />
                        <div>
                          <div className="font-semibold">{state.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{state.color}</div>
                        </div>
                      </div>
                      <Icon className="w-6 h-6" style={{ color: state.darkColor }} />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <p className="text-sm">{state.description}</p>
                      <p className="text-xs text-muted-foreground"><strong>Usage:</strong> {state.usage}</p>
                    </div>

                    {/* Examples */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium">Examples:</div>

                      {/* Alert/Toast style */}
                      <div className="flex items-start gap-2 p-3 rounded-lg border" style={{
                        backgroundColor: state.color + '20',
                        borderColor: state.darkColor
                      }}>
                        <Icon className="w-4 h-4 mt-0.5" style={{ color: state.darkColor }} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{state.name} Message</div>
                          <div className="text-xs text-muted-foreground">This is an example {state.name.toLowerCase()} notification</div>
                        </div>
                      </div>

                      {/* Badge style */}
                      <div className="flex gap-2">
                        <Badge className="gap-1" style={{
                          backgroundColor: state.color,
                          color: state.darkColor,
                          borderColor: state.darkColor
                        }}>
                          <Icon className="w-3 h-3" />
                          {state.name}
                        </Badge>

                        <div className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{
                          backgroundColor: state.color + '40',
                          color: state.darkColor
                        }}>
                          <Icon className="w-3 h-3" />
                          <span>With icon</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* All Together Example */}
          <Card className="p-6 space-y-4">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold mb-1">Complete System Working Together</h2>
              <p className="text-sm text-muted-foreground">
                Example showing ASIS loads, non-ASIS types, and UI states all used in one interface without conflicts.
              </p>
            </div>

            {/* Mock Load Card */}
            <div className="border rounded-lg p-4 space-y-3" style={{ borderLeftWidth: '4px', borderLeftColor: ASIS_LOAD_COLORS[0].color }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: ASIS_LOAD_COLORS[0].color }} />
                  <div>
                    <div className="font-semibold">ASIS Load - Red</div>
                    <div className="text-xs text-muted-foreground">9SU-0123 • 60 items • Regular</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{
                  backgroundColor: UI_STATES[1].color + '40',
                  color: UI_STATES[1].darkColor
                }}>
                  <AlertTriangle className="w-3 h-3" />
                  <span>Needs Wrap</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {NON_ASIS_TYPES.slice(0, 3).map((type) => {
                  const Icon = type.icon;
                  return (
                    <div key={type.code} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-xs">
                      <Icon className="w-3 h-3" style={{ color: type.color }} />
                      <span>{type.code}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
              <strong>Note:</strong> The vibrant ASIS load color (red) clearly stands out from both the grayscale non-ASIS types and the muted warning state, eliminating visual confusion.
            </div>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
