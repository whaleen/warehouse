import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import type { Truck } from "@/types/deliveries";

interface TruckEditDialogProps {
  truck: Truck | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (truck: Truck) => Promise<void>;
  existingAbbreviations: string[];
}

export function TruckEditDialog({ 
  truck, 
  isOpen, 
  onClose, 
  onSave, 
  existingAbbreviations 
}: TruckEditDialogProps) {
  const [formData, setFormData] = useState<Truck>({
    truck_id: '',
    abbreviated_name: '',
    color: '#3B82F6',
    driver_name: '',
    capacity: 50,
    active: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (truck) {
      setFormData({
        ...truck,
        abbreviated_name: truck.abbreviated_name || '',
        color: truck.color || '#3B82F6',
        driver_name: truck.driver_name || '',
        capacity: truck.capacity || 50
      });
    }
    setError(null);
  }, [truck]);

  const validateForm = (): string | null => {
    if (!formData.abbreviated_name?.trim()) {
      return "Abbreviated name is required";
    }
    
    if (formData.abbreviated_name.length > 5) {
      return "Abbreviated name must be 5 characters or less";
    }

    // Check for conflicts with other trucks (excluding current truck)
    const isConflict = existingAbbreviations.some(abbrev => 
      abbrev.toLowerCase() === formData.abbreviated_name?.toLowerCase() && 
      abbrev !== truck?.abbreviated_name
    );
    
    if (isConflict) {
      return "This abbreviated name is already in use by another truck";
    }

    if (formData.capacity && formData.capacity < 1) {
      return "Capacity must be at least 1";
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        ...formData,
        abbreviated_name: formData.abbreviated_name?.trim().toUpperCase()
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save truck');
    } finally {
      setSaving(false);
    }
  };

  const generateSuggestedAbbreviation = () => {
    if (!truck?.truck_id) return '';
    
    const truckId = truck.truck_id;
    
    // Try different strategies
    const strategies = [
      // First letter + numbers
      () => truckId.charAt(0) + truckId.replace(/\D/g, ''),
      // First 2 letters + last 2 characters
      () => truckId.substring(0, 2) + truckId.slice(-2),
      // First letter + last number + index
      () => truckId.charAt(0) + truckId.replace(/\D/g, '').slice(-1),
      // Custom patterns
      () => {
        if (truckId.startsWith('GRAN')) return 'G' + truckId.replace(/\D/g, '');
        if (truckId.startsWith('CAP')) return 'C' + truckId.replace(/\D/g, '');
        if (truckId.startsWith('RRT')) return 'R' + truckId.replace(/\D/g, '');
        return truckId.substring(0, 3);
      }
    ];

    for (const strategy of strategies) {
      const suggestion = strategy().toUpperCase();
      if (suggestion && !existingAbbreviations.includes(suggestion)) {
        return suggestion;
      }
    }

    // If all strategies fail, try adding numbers
    for (let i = 1; i <= 99; i++) {
      const suggestion = (truckId.charAt(0) + i).toUpperCase();
      if (!existingAbbreviations.includes(suggestion)) {
        return suggestion;
      }
    }

    return '';
  };

  const handleSuggest = () => {
    const suggestion = generateSuggestedAbbreviation();
    if (suggestion) {
      setFormData(prev => ({ ...prev, abbreviated_name: suggestion }));
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {truck ? `Edit ${truck.truck_id}` : 'New Truck'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="truck_id">Truck ID</Label>
            <Input
              id="truck_id"
              value={formData.truck_id}
              onChange={(e) => setFormData(prev => ({ ...prev, truck_id: e.target.value }))}
              disabled={!!truck} // Can't edit existing truck ID
              placeholder="e.g., GRAN08"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="abbreviated_name">Abbreviated Name *</Label>
            <div className="flex space-x-2">
              <Input
                id="abbreviated_name"
                value={formData.abbreviated_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, abbreviated_name: e.target.value }))}
                placeholder="e.g., G8"
                maxLength={5}
                className="uppercase"
                style={{ textTransform: 'uppercase' }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSuggest}
                disabled={!truck?.truck_id}
                className="flex-shrink-0"
              >
                Suggest
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Maximum 5 characters. Used for mobile display.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Truck Color</Label>
            <div className="flex space-x-3 items-center">
              <input
                id="color"
                type="color"
                value={formData.color || '#3B82F6'}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <Input
                  value={formData.color || '#3B82F6'}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <div className="flex space-x-1">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Color will be used for truck identification throughout the app.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver_name">Driver Name</Label>
            <Input
              id="driver_name"
              value={formData.driver_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
              placeholder="Driver name (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={formData.capacity || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
              placeholder="Max items"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked as boolean }))}
            />
            <Label htmlFor="active">Active truck</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}