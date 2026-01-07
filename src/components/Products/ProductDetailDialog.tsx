import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Package, Ruler, Weight } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Product } from '@/types/inventory';

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelNumber: string;
}

export function ProductDetailDialog({
  open,
  onOpenChange,
  modelNumber,
}: ProductDetailDialogProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && modelNumber) {
      fetchProduct();
    }
  }, [open, modelNumber]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('model', modelNumber)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } else {
        setProduct(data);
      }
    } catch (err) {
      console.error('Error:', err);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !product ? (
          <div className="py-12 text-center text-muted-foreground">
            Product not found in catalog
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Header */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                {product.brand && (
                  <Badge variant="secondary" className="font-semibold">
                    {product.brand}
                  </Badge>
                )}
                <Badge>{product.product_type}</Badge>
              </div>
              <h3 className="mb-1 text-2xl font-bold text-foreground">
                {product.model}
              </h3>
              {product.description && (
                <p className="text-muted-foreground">
                  {product.description}
                </p>
              )}
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Dimensions */}
              {product.dimensions &&
                Object.keys(product.dimensions).length > 0 && (
                  <Card className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Ruler className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold text-foreground">
                        Dimensions
                      </h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      {product.dimensions.width && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Width:
                          </span>
                          <span className="font-mono font-medium">
                            {product.dimensions.width}"
                          </span>
                        </div>
                      )}
                      {product.dimensions.height && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Height:
                          </span>
                          <span className="font-mono font-medium">
                            {product.dimensions.height}"
                          </span>
                        </div>
                      )}
                      {product.dimensions.depth && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Depth:
                          </span>
                          <span className="font-mono font-medium">
                            {product.dimensions.depth}"
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

              {/* Weight */}
              {product.weight && (
                <Card className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Weight className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      Weight
                    </h4>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {product.weight}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      lbs
                    </span>
                  </div>
                </Card>
              )}
            </div>

            {/* Additional Info */}
            <Card className="bg-muted p-4">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-semibold text-foreground">
                  Product Information
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    Model Number:
                  </span>
                  <div className="font-mono font-semibold text-foreground">
                    {product.model}
                  </div>
                </div>
                {product.brand && (
                  <div>
                    <span className="text-muted-foreground">
                      Brand:
                    </span>
                    <div className="font-semibold text-foreground">
                      {product.brand}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="font-semibold text-foreground">
                    {product.product_type}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
