import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { useInventoryItemDetail } from '@/hooks/queries/useInventory';
import { decodeHTMLEntities } from '@/lib/htmlUtils';

// interface InventoryItemWithProduct extends InventoryItem {
//   products: {
//     id: string;
//     model: string;
//     product_type: string;
//     brand?: string;
//     description?: string;
//     dimensions?: {
//       width?: number;
//       height?: number;
//       depth?: number;
//     };
//     image_url?: string;
//     product_url?: string;
//     price?: number;
//     msrp?: number;
//     color?: string;
//   } | null;
// }

interface InventoryItemDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
}

export function InventoryItemDetailDialog({
  open,
  onOpenChange,
  itemId,
}: InventoryItemDetailDialogProps) {
  const { data: item, isLoading: loading } = useInventoryItemDetail(itemId, open);

  const formatMoney = (value?: number) =>
    typeof value === 'number'
      ? `$${value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—';

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const copyToClipboard = async (text?: string | null) => {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall back below
    }
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
  };

  const CopyButton = ({
    value,
    label,
  }: {
    value?: string | null;
    label: string;
  }) => {
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
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inventory Item Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : item ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-base">
                {item.products?.product_type ?? item.product_type}
              </Badge>

              <Badge>{item.inventory_type}</Badge>

              {item.sub_inventory && (
                <Badge variant="outline">
                  {item.sub_inventory}
                </Badge>
              )}

              {item.is_scanned && (
                <Badge variant="outline">Scanned</Badge>
              )}

              {item.products?.color && (
                <Badge variant="outline">
                  Color: {item.products.color}
                </Badge>
              )}
            </div>

            {/* Our Stock */}
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">Our Stock</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {item.cso && (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-muted-foreground">CSO:</span>{' '}
                      <span className="font-mono">
                        {item.cso.length > 4 ? (
                          <>
                            {item.cso.slice(0, -4)}
                            <span className="font-bold underline decoration-dotted underline-offset-2">
                              {item.cso.slice(-4)}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold underline decoration-dotted underline-offset-2">
                            {item.cso}
                          </span>
                        )}
                      </span>
                    </div>
                    <CopyButton value={item.cso} label="CSO" />
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-muted-foreground">
                      Serial:
                    </span>{' '}
                    <span className="font-mono">
                      {item.serial ?? '-'}
                    </span>
                  </div>
                  {item.serial && <CopyButton value={item.serial} label="Serial" />}
                </div>

                {item.route_id && (
                  <div>
                    <span className="text-muted-foreground">
                      Route:
                    </span>{' '}
                    <span className="font-mono">
                      {item.route_id}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground">
                    Quantity:
                  </span>{' '}
                  <span className="font-medium">
                    {item.qty ?? 1}
                  </span>
                </div>

                {item.created_at && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">
                      Added:
                    </span>{' '}
                    <span className="font-medium">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Model Data */}
            {item.products ? (
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">Model Data</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Image */}
                  {item.products.image_url && (
                    <div className="md:col-span-1">
                      <img
                        src={item.products.image_url}
                        alt={item.products.model}
                        className="w-full rounded-md object-contain"
                      />
                    </div>
                  )}

                  {/* Details */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-muted-foreground">
                          Model:
                        </span>{' '}
                        <span className="font-mono font-medium">
                          {item.products.model}
                        </span>
                      </div>
                      <CopyButton value={item.products.model} label="Model" />
                    </div>

                    {item.products.brand && (
                      <div>
                        <span className="text-muted-foreground">
                          Brand:
                        </span>{' '}
                        <span className="font-medium">
                          {item.products.brand}
                        </span>
                      </div>
                    )}

                    {item.products.description && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">
                          Description:
                        </span>{' '}
                        <span className="font-medium">
                          {decodeHTMLEntities(
                            item.products.description,
                          )}
                        </span>
                      </div>
                    )}

                    {item.products.dimensions && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">
                          Dimensions:
                        </span>{' '}
                        <span className="font-medium">
                          {[
                            item.products.dimensions.width &&
                              `${item.products.dimensions.width}" W`,
                            item.products.dimensions.height &&
                              `${item.products.dimensions.height}" H`,
                            item.products.dimensions.depth &&
                              `${item.products.dimensions.depth}" D`,
                          ]
                            .filter(Boolean)
                            .join(' × ')}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-muted-foreground">
                        Price:
                      </span>{' '}
                      <span className="font-medium">
                        {formatMoney(item.products.price)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        MSRP:
                      </span>{' '}
                      <span className="font-medium">
                        {formatMoney(item.products.msrp)}
                      </span>
                    </div>

                    {item.products.product_url && (
                      <div className="col-span-2 pt-2">
                        <Button
                          variant="outline"
                          size="responsive"
                          asChild
                        >
                          <a
                            href={item.products.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            View Product Page
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">Model Data</h3>
                <p className="text-sm text-muted-foreground">
                  No product record found for this model yet.
                </p>
              </Card>
            )}

            {(item.ge_availability_status || item.ge_availability_message) && (
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">GE Availability</h3>
                {item.ge_availability_status && (
                  <p className="text-sm text-muted-foreground">
                    Status: {item.ge_availability_status}
                  </p>
                )}
                {item.ge_availability_message && (
                  <p className="text-sm text-muted-foreground">
                    Message: {item.ge_availability_message}
                  </p>
                )}
              </Card>
            )}

            {item.ge_orphaned && (
              <Card className="p-4 space-y-2 border-destructive/40">
                <h3 className="font-semibold text-destructive">GE Orphaned</h3>
                <p className="text-sm text-muted-foreground">
                  This serial was not found in the latest GE snapshot.
                </p>
              </Card>
            )}

            {/* Notes */}
            {item.notes && (
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">Notes</h3>
                <p className="text-sm text-muted-foreground">
                  {item.notes}
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Item not found
          </div>
        )}
        </DialogContent>
      </Dialog>

    </>
  );
}
