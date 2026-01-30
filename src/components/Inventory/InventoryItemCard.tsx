import { memo, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, Product } from '@/types/inventory';

interface InventoryItemCardProps<T extends InventoryItem = InventoryItem> {
  item: T & { products?: Product | null };
  onClick?: () => void;
  onModelClick?: () => void;
  leading?: React.ReactNode;
  showImage?: boolean;
  imageUrl?: string | null;
  imageAlt?: string;
  imageSize?: "sm" | "md" | "lg" | "xl";
  showInventoryTypeBadge?: boolean;
  showScannedBadge?: boolean;
  showRouteBadge?: boolean;
  routeValue?: string | null;
  routeLabel?: string;
  showProductMeta?: boolean;
  showCustomer?: boolean;
  showCopyFields?: boolean;
  variant?: 'default' | 'pending' | 'scanned';
  selected?: boolean;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

async function copyToClipboard(text: string) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const disabled = !value;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    const success = await copyToClipboard(value);
    if (success) setCopied(true);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function CopyField({
  label,
  value,
  copyValue,
  onValueClick,
}: {
  label: string;
  value: string;
  copyValue: string;
  onValueClick?: () => void;
}) {
  const displayValue = value || '-';
  const isInteractive = Boolean(onValueClick);

  const handleValueClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onValueClick?.();
  };

  return (
    <div className="rounded-md border border-border/40 bg-muted/30 px-2 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        {isInteractive ? (
          <button
            type="button"
            className="flex items-center gap-1 font-mono text-xs text-primary hover:underline break-all"
            onClick={handleValueClick}
          >
            {displayValue}
            <ExternalLink className="h-3 w-3" />
          </button>
        ) : (
          <div className={cn('font-mono text-xs break-all', displayValue === '-' ? 'text-muted-foreground' : 'text-foreground')}>
            {displayValue}
          </div>
        )}
      </div>
      <CopyIconButton value={copyValue} label={label} />
    </div>
  );
}

export const InventoryItemCard = memo(function InventoryItemCard({
  item,
  onClick,
  onModelClick,
  leading,
  showImage = false,
  imageUrl,
  imageAlt,
  imageSize = "sm",
  showInventoryTypeBadge = true,
  showScannedBadge = false,
  showRouteBadge = true,
  routeValue,
  routeLabel = 'Route',
  showProductMeta = true,
  showCustomer = false,
  showCopyFields = true,
  variant = 'default',
  selected = false,
  badges,
  actions,
  className
}: InventoryItemCardProps) {
  const productTypeLabel = item.products?.product_type ?? item.product_type;
  const normalizedType = (productTypeLabel ?? '').toLowerCase().trim();
  const primaryTitle =
    item.model ??
    item.products?.model ??
    item.ge_model ??
    (normalizedType && normalizedType !== 'unknown' ? productTypeLabel : undefined) ??
    'Unknown';
  const subtitle =
    normalizedType && normalizedType !== 'unknown' && productTypeLabel !== primaryTitle
      ? productTypeLabel
      : null;
  const routeDisplay = routeValue ?? item.route_id;
  const resolvedImage = imageUrl ?? item.products?.image_url ?? null;
  const availabilityStatus = item.ge_availability_status ?? item.status;
  const isGeOrphaned = Boolean(item.ge_orphaned);
  const imageSizeClass =
    imageSize === "xl"
      ? "h-32 w-32"
      : imageSize === "lg"
      ? "h-24 w-24"
      : imageSize === "md"
      ? "h-16 w-16"
      : "h-12 w-12";

  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-accent/30',
        variant === 'scanned' && 'border-emerald-500/20 bg-emerald-500/10',
        variant === 'pending' && 'border-border/60',
        selected && 'border-primary/50 bg-primary/5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {leading && <div className="mt-1">{leading}</div>}
        {showImage && (
          <div
            className={cn(
              "rounded bg-muted flex items-center justify-center overflow-hidden shrink-0",
              imageSizeClass
            )}
          >
            {resolvedImage ? (
              <img
                src={resolvedImage}
                alt={imageAlt ?? primaryTitle}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="min-w-0">
                <span className="block font-semibold text-foreground">{primaryTitle}</span>
                {subtitle && (
                  <span className="block text-xs text-muted-foreground">{subtitle}</span>
                )}
              </div>
              {showInventoryTypeBadge && (
                <Badge variant="secondary">{item.inventory_type}</Badge>
              )}
              {availabilityStatus && (
                <Badge variant="outline">{availabilityStatus}</Badge>
              )}
              {isGeOrphaned && (
                <Badge variant="destructive">Not in GE</Badge>
              )}
              {showScannedBadge && item.is_scanned && (
                <Badge variant="outline">Scanned</Badge>
              )}
              {showRouteBadge && routeDisplay && (
                <Badge variant="outline">{routeLabel} {routeDisplay}</Badge>
              )}
              {badges}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>

          {showProductMeta && item.products?.brand && (
            <Badge variant="outline">{item.products.brand}</Badge>
          )}
          {showProductMeta && item.products?.description && (
            <p className="text-sm text-muted-foreground">
              {item.products.description}
            </p>
          )}

          {showCopyFields && (
            <div className={variant === 'pending' || variant === 'scanned' ? 'grid gap-2 text-xs grid-cols-2' : 'grid gap-2 text-xs sm:grid-cols-3'}>
              <CopyField
                label="Model"
                value={item.model}
                copyValue={item.model}
                onValueClick={onModelClick}
              />
              <CopyField
                label="Serial"
                value={item.serial ?? '-'}
                copyValue={item.serial ?? ''}
              />
              {variant !== 'pending' && variant !== 'scanned' && (
                <CopyField
                  label="CSO"
                  value={
                    item.cso &&
                    !['ASIS', 'FG', 'STA', 'LOCALSTOCK', 'BACKHAUL', 'STAGED', 'INBOUND', 'WILLCALL']
                      .includes(item.cso.toUpperCase())
                      ? item.cso
                      : ''
                  }
                  copyValue={item.cso ?? ''}
                />
              )}
            </div>
          )}

          {showCustomer && item.consumer_customer_name && (
            <div className="text-xs text-muted-foreground">
              {item.consumer_customer_name}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});
