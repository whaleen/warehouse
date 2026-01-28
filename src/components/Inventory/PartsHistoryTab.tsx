import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown, RotateCcw, Truck, DollarSign } from 'lucide-react';
import { useTrackedParts, usePartsHistory } from '@/hooks/queries/useParts';
import type { InventoryCountWithProduct } from '@/types/inventory';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getReasonBadge(reason: string | null | undefined) {
  switch (reason) {
    case 'usage':
      return <Badge variant="secondary"><TrendingDown className="h-3 w-3 mr-1" />Usage</Badge>;
    case 'return':
      return <Badge variant="outline"><RotateCcw className="h-3 w-3 mr-1" />Return</Badge>;
    case 'restock':
      return <Badge className="bg-green-600 hover:bg-green-700"><Truck className="h-3 w-3 mr-1" />Restock</Badge>;
    default:
      return <Badge variant="outline">—</Badge>;
  }
}

export function PartsHistoryTab() {
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<number>(30);

  const { data: trackedParts } = useTrackedParts();
  const { data: history, isLoading: loading } = usePartsHistory(
    selectedProductId === 'all' ? undefined : selectedProductId,
    timeRange
  );

  const summary = useMemo(() => {
    let usageUnits = 0;
    let returnUnits = 0;
    let restockUnits = 0;
    let usageCost = 0;
    const pricedProducts = new Set<string>();
    const usageProducts = new Set<string>();

    (history ?? []).forEach(row => {
      const prev = row.previous_qty ?? 0;
      const qty = row.qty ?? 0;
      const reason = row.count_reason;

      if (reason === 'usage') {
        const units = Math.max(0, prev - qty);
        usageUnits += units;
        usageProducts.add(row.product_id);
        const price = toNumber(row.products?.price) ?? toNumber(row.products?.msrp);
        if (price !== null) {
          pricedProducts.add(row.product_id);
          usageCost += units * price;
        }
      } else if (reason === 'return') {
        returnUnits += Math.max(0, qty - prev);
      } else if (reason === 'restock') {
        restockUnits += Math.max(0, qty - prev);
      }
    });

    const priceCoverage =
      usageProducts.size === 0
        ? '0/0'
        : `${pricedProducts.size}/${usageProducts.size}`;

    return { usageUnits, returnUnits, restockUnits, usageCost, priceCoverage };
  }, [history]);

  const formatter = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2
      }),
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={timeRange.toString()} onValueChange={v => setTimeRange(parseInt(v))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select a part" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tracked Parts</SelectItem>
            {(trackedParts ?? []).map(part => (
              <SelectItem key={part.product_id} value={part.product_id}>
                {part.products?.model ?? 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4" />
            Usage
          </div>
          <p className="text-2xl font-bold">{formatter.format(summary.usageUnits)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RotateCcw className="h-4 w-4" />
            Returns
          </div>
          <p className="text-2xl font-bold">{formatter.format(summary.returnUnits)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" />
            Restocks
          </div>
          <p className="text-2xl font-bold">{formatter.format(summary.restockUnits)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Est. Usage Cost
          </div>
          <p className="text-2xl font-bold">{currencyFormatter.format(summary.usageCost)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Price coverage: {summary.priceCoverage}
          </p>
        </Card>
      </div>

      {/* Snapshots Table */}
      {!history || history.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No snapshots recorded for the selected filters.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Use "Snapshot All" or update part counts to record history.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Part</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(row => {
                const delta = row.delta ?? 0;
                const price = toNumber(row.products?.price) ?? toNumber(row.products?.msrp);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {row.products?.model ?? 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.qty}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : ''}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getReasonBadge(row.count_reason)}
                    </TableCell>
                    <TableCell className="text-right">
                      {price !== null ? currencyFormatter.format(price) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
