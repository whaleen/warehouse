import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2 } from 'lucide-react';
import type { InventoryType, InventoryItem } from '@/types/inventory';
import supabase from '@/lib/supabase';

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
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

export function CSVUpload({ open, onOpenChange, onUploadComplete }: CSVUploadProps) {
  const [inventoryType, setInventoryType] = useState<InventoryType>('ASIS');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      // Parse and preview first 5 rows
      Papa.parse(selectedFile, {
        header: true,
        preview: 5,
        complete: (results) => {
          setPreview(results.data as CSVRow[]);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
        }
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Parse the entire CSV file
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as CSVRow[];

          // Transform CSV rows to inventory items
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

          // Insert into database
          const { error: insertError } = await supabase
            .from('inventory_items')
            .insert(inventoryItems);

          if (insertError) {
            setError(`Failed to upload: ${insertError.message}`);
          } else {
            // Reset form
            setFile(null);
            setPreview([]);
            onUploadComplete();
            onOpenChange(false);
          }

          setUploading(false);
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
          setUploading(false);
        }
      });
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Inventory CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inventory Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="inventory-type">Inventory Type</Label>
            <Select value={inventoryType} onValueChange={(value) => setInventoryType(value as InventoryType)}>
              <SelectTrigger id="inventory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASIS">ASIS (As-Is Returns)</SelectItem>
                <SelectItem value="BackHaul">Back Haul</SelectItem>
                <SelectItem value="Salvage">Salvage</SelectItem>
                <SelectItem value="Staged">Staged (Routes)</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="FG">FG (Finished Goods)</SelectItem>
                <SelectItem value="LocalStock">Local Stock</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {inventoryType === 'Staged'
                ? 'Truck IDs will be used as route names (sub-inventory)'
                : 'All items will be tagged as ' + inventoryType}
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <p className="text-xs text-gray-500">
              Expected columns: Date, Truck_Id, Stop, CSO, Consumer_Customer_Name, Model, Qty, Serial, Product_Type, Status
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 5 rows)</Label>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">CSO</th>
                      <th className="px-2 py-1 text-left">Model</th>
                      <th className="px-2 py-1 text-left">Serial</th>
                      <th className="px-2 py-1 text-left">Product Type</th>
                      <th className="px-2 py-1 text-left">Truck ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
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

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
