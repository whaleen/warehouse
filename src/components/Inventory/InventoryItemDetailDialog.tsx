import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';
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
  const [item, setItem] =
  useState<InventoryItem | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && itemId) {
      fetchItemDetails();
    }
  }, [open, itemId]);

  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products:product_fk (
            id,
            model,
            product_type,
            brand,
            description,
            dimensions,
            image_url,
            product_url,
            price,
            msrp,
            color
          )
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (err) {
      console.error(err);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value?: number) =>
    typeof value === 'number'
      ? `$${value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—';

  return (
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

{/* Inventory Details */}
<Card className="p-4 space-y-3">
              <h3 className="font-semibold">Inventory Details</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
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

                <div>
                  <span className="text-muted-foreground">
                    Serial:
                  </span>{' '}
                  <span className="font-mono">
                    {item.serial ?? '-'}
                  </span>
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
                      {new Date(
                        item.created_at,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Product Information */}
            {item.products && (
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">Product Information</h3>

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
                    <div>
                      <span className="text-muted-foreground">
                        Model:
                      </span>{' '}
                      <span className="font-mono font-medium">
                        {item.products.model}
                      </span>
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
                          size="sm"
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
  );
}
