import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export function ProductDetailDialog({ open, onOpenChange, modelNumber }: ProductDetailDialogProps) {
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !product ? (
          <div className="py-12 text-center text-gray-500">
            Product not found in catalog
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {product.brand && (
                  <Badge variant="secondary" className="font-semibold">
                    {product.brand}
                  </Badge>
                )}
                <Badge>{product.product_type}</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {product.model}
              </h3>
              {product.description && (
                <p className="text-gray-600">{product.description}</p>
              )}
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dimensions */}
              {product.dimensions && (
                Object.keys(product.dimensions).length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Ruler className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Dimensions</h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      {product.dimensions.width && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Width:</span>
                          <span className="font-mono font-medium">{product.dimensions.width}"</span>
                        </div>
                      )}
                      {product.dimensions.height && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Height:</span>
                          <span className="font-mono font-medium">{product.dimensions.height}"</span>
                        </div>
                      )}
                      {product.dimensions.depth && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Depth:</span>
                          <span className="font-mono font-medium">{product.dimensions.depth}"</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              )}

              {/* Weight */}
              {product.weight && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Weight className="h-5 w-5 text-orange-600" />
                    <h4 className="font-semibold text-gray-900">Weight</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {product.weight}
                    <span className="text-sm text-gray-600 ml-1 font-normal">lbs</span>
                  </div>
                </Card>
              )}
            </div>

            {/* Additional Info */}
            <Card className="p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">Product Information</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Model Number:</span>
                  <div className="font-mono font-semibold text-gray-900">{product.model}</div>
                </div>
                {product.brand && (
                  <div>
                    <span className="text-gray-600">Brand:</span>
                    <div className="font-semibold text-gray-900">{product.brand}</div>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Type:</span>
                  <div className="font-semibold text-gray-900">{product.product_type}</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
