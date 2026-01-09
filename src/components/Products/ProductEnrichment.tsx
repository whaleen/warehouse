import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Plus, ExternalLink } from 'lucide-react';
import supabase from '@/lib/supabase';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { decodeHTMLEntities } from '@/lib/htmlUtils';

interface ProductData {
  id?: string;
  model: string;
  product_type: string;
  brand?: string;
  description?: string;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  image_url?: string;
  product_url?: string;
  price?: number;
  msrp?: number;
  color?: string;
  capacity?: string;
  availability?: string;
  commercial_category?: string;
  product_category?: string;
  is_part?: boolean;
}

interface ProductEnrichmentProps {
  onSettingsClick: () => void;
}

export function ProductEnrichment({ onSettingsClick }: ProductEnrichmentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Live search effect with debouncing
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const { data, error: searchError } = await supabase
          .from('products')
          .select('*')
          .ilike('model', `%${searchTerm.trim()}%`)
          .limit(20)
          .order('model');

        if (searchError) {
          setError(`Search error: ${searchError.message}`);
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
      } catch (err) {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectProduct = (product: ProductData) => {
    setProductData(product);
    setEditMode(true);
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    setProductData({
      model: searchTerm.trim(),
      product_type: '',
      brand: 'GE'
    });
    setEditMode(true);
    setSearchResults([]);
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
          dimensions: productData.dimensions || null
        }, {
          onConflict: 'model'
        });

      if (saveError) {
        setError(`Failed to save: ${saveError.message}`);
      } else {
        setError(null);
        alert('Product saved successfully!');
        setSearchTerm('');
        setProductData(null);
        setEditMode(false);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Product Database" onSettingsClick={onSettingsClick} />
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <p className="text-muted-foreground">Look up or add appliance model information</p>

      {/* Search Form */}
      {!editMode && (
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-search">Search Model Number</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="model-search"
                type="text"
                placeholder="Start typing model number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && searchTerm.trim() && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Search Results */}
          {!loading && searchTerm.trim() && searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((product) => (
                  <Card
                    key={product.model}
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSelectProduct(product)}
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {product.image_url && (
                        <div className="flex-shrink-0 w-20 h-20">
                          <img
                            src={product.image_url}
                            alt={product.model}
                            className="w-full h-full object-contain rounded"
                          />
                        </div>
                      )}

                      {/* Product Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-mono font-semibold">{product.model}</div>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {decodeHTMLEntities(product.description)}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="flex-shrink-0">
                            {product.product_type}
                          </Badge>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {product.brand && (
                            <Badge variant="outline" className="text-xs">
                              {product.brand}
                            </Badge>
                          )}
                          {product.product_category && (
                            <Badge variant="outline" className="text-xs">
                              {product.product_category}
                            </Badge>
                          )}
                          {product.color && (
                            <Badge variant="outline" className="text-xs">
                              {product.color}
                            </Badge>
                          )}
                          {product.capacity && (
                            <Badge variant="outline" className="text-xs">
                              {product.capacity}
                            </Badge>
                          )}
                        </div>

                        {/* Pricing and Dimensions */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {product.price && (
                            <span className="font-medium">${product.price}</span>
                          )}
                          {product.dimensions?.width && product.dimensions?.height && product.dimensions?.depth && (
                            <span>
                              {product.dimensions.width}" × {product.dimensions.height}" × {product.dimensions.depth}"
                            </span>
                          )}
                          {product.availability && (
                            <span className="capitalize">{product.availability}</span>
                          )}
                        </div>

                        {/* External Link */}
                        {product.product_url && (
                          <div className="pt-1">
                            <a
                              href={product.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Product
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!loading && searchTerm.trim() && searchResults.length === 0 && (
            <div className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">No products found matching "{searchTerm}"</p>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Product
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Product Details Form */}
      {productData && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
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
                setEditMode(false);
                setSearchTerm('');
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

      </div>
    </div>
  );
}
