import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import type { InventoryType, InventoryItem } from '@/types/inventory';
import type { ScanningSession } from '@/types/session';
import supabase from '@/lib/supabase';
import { generateSessionId, saveSession, setActiveSession } from '@/lib/sessionManager';
import { AppHeader } from '@/components/Navigation/AppHeader';

interface CreateSessionViewProps {
  onSettingsClick: () => void;
  onViewChange: (view: 'dashboard' | 'inventory' | 'products' | 'settings' | 'loads' | 'create-load' | 'create-session') => void;
}

interface CSVRow {
  Date: string;
  Truck_Id: string;
  Stop: string;
  CSO: string;
  Consumer_Customer_Name: string;
  Model: string;
  Qty: string;
  Serial: string;
  Product_Type: string;
  Status: string;
}

function generateSessionName(inventoryType: InventoryType, subInventory?: string): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (inventoryType === 'Staged' && subInventory && subInventory !== 'all') {
    return `Route ${subInventory} - ${date} ${time}`;
  }

  const typeNames: Record<InventoryType, string> = {
    'ASIS': 'ASIS',
    'BackHaul': 'BackHaul',
    'Staged': 'Staged',
    'Inbound': 'Inbound',
    'FG': 'FG',
    'LocalStock': 'LocalStock',
    'Parts': 'Parts',
    'WillCall': 'WillCall'
  };

  return `${typeNames[inventoryType]} - ${date} ${time}`;
}

export function CreateSessionView({ onSettingsClick, onViewChange }: CreateSessionViewProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'upload'>('existing');
  const [sessionName, setSessionName] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType>('FG');
  const [subInventory, setSubInventory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [subInventories, setSubInventories] = useState<string[]>([]);

  // CSV Upload state
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);

  // Fetch available sub-inventories when inventory type changes
  useEffect(() => {
    const fetchSubInventories = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('sub_inventory')
        .eq('inventory_type', inventoryType)
        .not('sub_inventory', 'is', null);

      if (data) {
        const unique = [...new Set(data.map(d => d.sub_inventory))].filter(Boolean) as string[];
        setSubInventories(unique);
      }
    };

    fetchSubInventories();
  }, [inventoryType]);

  // Auto-generate session name when inventory type or sub-inventory changes
  useEffect(() => {
    if (activeTab === 'existing') {
      const name = generateSessionName(inventoryType, subInventory !== 'all' ? subInventory : undefined);
      setSessionName(name);
    }
  }, [inventoryType, subInventory, activeTab]);

  // Preview count
  useEffect(() => {
    if (activeTab !== 'existing') return;

    const fetchPreview = async () => {
      let query = supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { count } = await query;
      setPreviewCount(count || 0);
    };

    fetchPreview();
  }, [inventoryType, subInventory, activeTab]);

  const handleSessionCreated = (session: ScanningSession) => {
    saveSession(session);
    setActiveSession(session.id);
    onViewChange('inventory');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      Papa.parse(selectedFile, {
        header: true,
        preview: 5,
        complete: (results) => {
          setCsvPreview(results.data as CSVRow[]);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
        }
      });
    }
  };

  const handleUploadAndCreateSession = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as CSVRow[];

          const inventoryItems: InventoryItem[] = rows.map(row => ({
            date: row.Date || undefined,
            route_id: row.Truck_Id || undefined,
            stop: parseInt(row.Stop) || undefined,
            cso: row.CSO,
            consumer_customer_name: row.Consumer_Customer_Name || undefined,
            model: row.Model,
            qty: parseInt(row.Qty) || 1,
            serial: row.Serial || undefined,
            product_type: row.Product_Type,
            status: row.Status || undefined,
            inventory_type: inventoryType,
            sub_inventory: inventoryType === 'Staged' ? row.Truck_Id : undefined,
            is_scanned: false
          }));

          const { error: insertError } = await supabase
            .from('inventory_items')
            .insert(inventoryItems);

          if (insertError) {
            setError(`Failed to upload: ${insertError.message}`);
            setLoading(false);
            return;
          }

          const name = generateSessionName(inventoryType);

          const session: ScanningSession = {
            id: generateSessionId(),
            name: name,
            inventoryType,
            createdAt: new Date().toISOString(),
            items: inventoryItems,
            scannedItemIds: []
          };

          handleSessionCreated(session);
          setLoading(false);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
          setLoading(false);
        }
      });
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('inventory_type', inventoryType);

      if (subInventory !== 'all') {
        query = query.eq('sub_inventory', subInventory);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(`Failed to fetch items: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('No items found for this inventory type');
        setLoading(false);
        return;
      }

      const session: ScanningSession = {
        id: generateSessionId(),
        name: sessionName,
        inventoryType,
        subInventory: subInventory !== 'all' ? subInventory : undefined,
        createdAt: new Date().toISOString(),
        items: data as InventoryItem[],
        scannedItemIds: []
      };

      handleSessionCreated(session);
    } catch (err) {
      setError(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Start Scanning Session"
        onSettingsClick={onSettingsClick}
        actions={
          <Button variant="ghost" size="icon" onClick={() => onViewChange('inventory')}>
            <ArrowLeft />
          </Button>
        }
      />

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'upload')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">From Existing</TabsTrigger>
            <TabsTrigger value="upload">Upload New</TabsTrigger>
          </TabsList>

          {/* From Existing Tab */}
          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                type="text"
                placeholder="e.g., Sanity Check - FG"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-type">Inventory Type</Label>
              <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
                <SelectTrigger id="inventory-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                  <SelectItem value="BackHaul">Back Haul</SelectItem>
                  <SelectItem value="Staged">Staged (Routes)</SelectItem>
                  <SelectItem value="Inbound">Inbound</SelectItem>
                  <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                  <SelectItem value="LocalStock">Local Stock</SelectItem>
                  <SelectItem value="Parts">Parts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {subInventories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="sub-inventory">Filter by Route/Location (Optional)</Label>
                <Select value={subInventory} onValueChange={setSubInventory}>
                  <SelectTrigger id="sub-inventory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    {subInventories.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{previewCount} items</span> will be included in this session
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onViewChange('inventory')} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading || previewCount === 0}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Start Scanning'
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Upload New Tab */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="upload-inventory-type">Inventory Type</Label>
              <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
                <SelectTrigger id="upload-inventory-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                  <SelectItem value="BackHaul">Back Haul</SelectItem>
                  <SelectItem value="Staged">Staged (Routes)</SelectItem>
                  <SelectItem value="Inbound">Inbound</SelectItem>
                  <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                  <SelectItem value="LocalStock">Local Stock</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {inventoryType === 'Staged'
                  ? 'Truck IDs will be used as route names (sub-inventory)'
                  : 'All items will be tagged as ' + inventoryType}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: Date, Truck_Id, Stop, CSO, Consumer_Customer_Name, Model, Qty, Serial, Product_Type, Status
              </p>
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (first 5 rows)</Label>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left">CSO</th>
                        <th className="px-2 py-1 text-left">Model</th>
                        <th className="px-2 py-1 text-left">Serial</th>
                        <th className="px-2 py-1 text-left">Product Type</th>
                        <th className="px-2 py-1 text-left">Truck ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">{row.CSO}</td>
                          <td className="px-2 py-1">{row.Model}</td>
                          <td className="px-2 py-1">{row.Serial || '-'}</td>
                          <td className="px-2 py-1">{row.Product_Type}</td>
                          <td className="px-2 py-1">{row.Truck_Id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onViewChange('inventory')} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleUploadAndCreateSession} disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Start Scanning
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
