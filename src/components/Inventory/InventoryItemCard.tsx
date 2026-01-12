import { useEffect, useState } from 'react';
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

export function InventoryItemCard({
  item,
  onClick,
  onModelClick,
  leading,
  showImage = false,
  imageUrl,
  imageAlt,
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
  const routeDisplay = routeValue ?? item.route_id;
  const resolvedImage = imageUrl ?? item.products?.image_url ?? null;

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
          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {resolvedImage ? (
              <img
                src={resolvedImage}
                alt={imageAlt ?? item.model}
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
              <span className="font-semibold text-foreground">{productTypeLabel}</span>
              {showInventoryTypeBadge && (
                <Badge variant="secondary">{item.inventory_type}</Badge>
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
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <CopyField label="CSO" value={item.cso} copyValue={item.cso} />
              <CopyField
                label="Serial"
                value={item.serial ?? '-'}
                copyValue={item.serial ?? ''}
              />
              <CopyField
                label="Model"
                value={item.model}
                copyValue={item.model}
                onValueClick={onModelClick}
              />
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
}
