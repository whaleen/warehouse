import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Plus } from 'lucide-react';
import supabase from '@/lib/supabase';

interface ProductData {
  model: string;
  product_type: string;
  brand?: string;
  description?: string;
  weight?: number;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
}

export function ProductEnrichment() {
  const [modelNumber, setModelNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lookup model in database
  const handleLookup = async () => {
    if (!modelNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: lookupError } = await supabase
        .from('products')
        .select('*')
        .eq('model', modelNumber.trim())
        .single();

      if (lookupError) {
        if (lookupError.code === 'PGRST116') {
          // Not found - show form to add
          setProductData({
            model: modelNumber.trim(),
            product_type: '',
            brand: 'GE'
          });
          setError('Model not found in database. Fill in details below to add it.');
        } else {
          setError(`Database error: ${lookupError.message}`);
        }
      } else {
        setProductData(data);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Save product to database
  const handleSave = async () => {
    if (!productData || !productData.product_type) {
      setError('Product type is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: saveError } = await supabase
        .from('products')
        .upsert({
          model: productData.model,
          product_type: productData.product_type,
          brand: productData.brand || 'GE',
          description: productData.description || null,
          weight: productData.weight || null,
          dimensions: productData.dimensions || null
        }, {
          onConflict: 'model'
        });

      if (saveError) {
        setError(`Failed to save: ${saveError.message}`);
      } else {
        setError(null);
        alert('Product saved successfully!');
        setModelNumber('');
        setProductData(null);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Database</h2>
        <p className="text-gray-600">Look up or add appliance model information</p>
      </div>

      {/* Lookup Form */}
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model-number">Model Number</Label>
          <div className="flex gap-2">
            <Input
              id="model-number"
              type="text"
              placeholder="e.g., GTD58EBSVWS"
              value={modelNumber}
              onChange={(e) => setModelNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLookup();
                }
              }}
              disabled={loading}
            />
            <Button onClick={handleLookup} disabled={loading || !modelNumber.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant={error.includes('not found') ? 'default' : 'destructive'}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Product Details Form */}
      {productData && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {productData.brand ? `${productData.brand} ` : ''}
            {productData.model}
          </h3>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="product-type">Product Type *</Label>
              <Input
                id="product-type"
                type="text"
                placeholder="e.g., WASHER, REFRIGERATOR, DISHWASHER"
                value={productData.product_type}
                onChange={(e) =>
                  setProductData({ ...productData, product_type: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                type="text"
                placeholder="e.g., GE, Whirlpool, Samsung"
                value={productData.brand || ''}
                onChange={(e) =>
                  setProductData({ ...productData, brand: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                placeholder="e.g., Front Load Washer, 5.0 cu ft"
                value={productData.description || ''}
                onChange={(e) =>
                  setProductData({ ...productData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="200"
                  value={productData.weight || ''}
                  onChange={(e) =>
                    setProductData({
                      ...productData,
                      weight: e.target.value ? parseFloat(e.target.value) : undefined
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="width">Width (in)</Label>
                <Input
                  id="width"
                  type="number"
                  placeholder="27"
                  value={productData.dimensions?.width || ''}
                  onChange={(e) =>
                    setProductData({
                      ...productData,
                      dimensions: {
                        ...productData.dimensions,
                        width: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (in)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="39"
                  value={productData.dimensions?.height || ''}
                  onChange={(e) =>
                    setProductData({
                      ...productData,
                      dimensions: {
                        ...productData.dimensions,
                        height: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth">Depth (in)</Label>
                <Input
                  id="depth"
                  type="number"
                  placeholder="32"
                  value={productData.dimensions?.depth || ''}
                  onChange={(e) =>
                    setProductData({
                      ...productData,
                      dimensions: {
                        ...productData.dimensions,
                        depth: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setProductData(null);
                setModelNumber('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !productData.product_type}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Save Product
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Add Common Models */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Common Product Types</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'WASHER',
            'DRYER',
            'REFRIGERATOR',
            'DISHWASHER',
            'RANGE',
            'OVEN',
            'MICROWAVE',
            'COOKTOP'
          ].map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              onClick={() => {
                if (productData) {
                  setProductData({ ...productData, product_type: type });
                }
              }}
            >
              {type}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
