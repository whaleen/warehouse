import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LoadMetadata } from '@/types/inventory';
import { BucketPill } from '@/components/ui/bucket-pill';
import { CsoValue } from '@/components/ui/cso-value';

interface LoadInfoModalProps {
  load: LoadMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount?: number;
}

export function LoadInfoModal({ load, open, onOpenChange, itemCount }: LoadInfoModalProps) {
  if (!load) return null;

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {load.friendly_name || load.sub_inventory_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Load Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Load Number</div>
                <div className="font-medium">{load.sub_inventory_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Inventory Type</div>
                <BucketPill bucket={load.inventory_type} />
              </div>
              {itemCount !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground">Item Count</div>
                  <div className="font-medium">{itemCount}</div>
                </div>
              )}
              {load.category && (
                <div>
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="font-medium">{load.category}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{formatDate(load.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium">{load.status || '—'}</div>
              </div>
            </div>
          </div>

          {/* GE Data */}
          <div>
            <h3 className="text-sm font-semibold mb-2">GE Sync Data</h3>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">GE Inv Org</div>
                <div className="font-medium">{load.ge_inv_org || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GE Units</div>
                <div className="font-medium">{load.ge_units ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GE CSO</div>
                <div className="font-medium">
                  {load.ge_cso ? <CsoValue value={load.ge_cso} className="font-mono" /> : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GE CSO Status</div>
                <div className="font-medium">{load.ge_cso_status || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GE Source Status</div>
                <div className="font-medium">{load.ge_source_status || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GE Pricing</div>
                <div className="font-medium">{load.ge_pricing || '—'}</div>
              </div>
              {load.ge_submitted_date && (
                <div>
                  <div className="text-xs text-muted-foreground">GE Submitted</div>
                  <div className="font-medium">{formatDateTime(load.ge_submitted_date)}</div>
                </div>
              )}
              {load.ge_scanned_at && (
                <div>
                  <div className="text-xs text-muted-foreground">GE Scanned</div>
                  <div className="font-medium">{formatDateTime(load.ge_scanned_at)}</div>
                </div>
              )}
            </div>
            {load.ge_notes && (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">GE Notes</div>
                <div className="text-sm font-medium mt-1 break-words">{load.ge_notes}</div>
              </div>
            )}
          </div>

          {/* Local Notes */}
          {load.notes && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Local Notes</h3>
              <div className="text-sm">{load.notes}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
