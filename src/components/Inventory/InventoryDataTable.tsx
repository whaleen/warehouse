import { useMemo, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, Eye, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BucketPill } from '@/components/ui/bucket-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem } from '@/types/inventory';

interface InventoryDataTableProps {
  items: InventoryItem[];
  onViewItem?: (itemId: string) => void;
}

export function InventoryDataTable({ items, onViewItem }: InventoryDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => {
    return [
      {
        id: 'image',
        header: () => null,
        cell: ({ row }) => {
          const imageUrl = row.original.products?.image_url;
          return (
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={row.original.products?.model ?? row.original.model}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'model',
        accessorFn: (row) => row.products?.model ?? row.model,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Model
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const model = row.original.products?.model ?? row.original.model;
          return (
            <div className="font-mono font-medium">{model || '—'}</div>
          );
        },
      },
      {
        id: 'brand',
        accessorFn: (row) => row.products?.brand ?? '',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Brand
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.products?.brand ?? '—',
      },
      {
        id: 'type',
        accessorFn: (row) => row.products?.product_type ?? row.product_type,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.products?.product_type ?? row.original.product_type ?? '—',
      },
      {
        id: 'inventory',
        accessorFn: (row) => row.inventory_type,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Inventory
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const bucket = row.original.inventory_bucket || row.original.inventory_type;
          if (!bucket) return '—';
          return (
            <BucketPill bucket={bucket} />
          );
        },
      },
      {
        id: 'serial',
        accessorFn: (row) => row.serial ?? '',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Serial
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.serial ?? '—',
      },
      {
        id: 'qty',
        accessorFn: (row) => row.qty ?? 0,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Qty
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.qty ?? 0,
      },
      {
        id: 'status',
        accessorFn: (row) => row.ge_availability_status ?? row.status ?? '',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="responsive"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.ge_availability_status ?? row.original.status ?? '—',
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.id;
          return (
            <Button
              type="button"
              size="responsive"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => id && onViewItem?.(id)}
              disabled={!id || !onViewItem}
            >
              <Eye className="mr-1 h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">View</span>
            </Button>
          );
        },
      },
    ];
  }, [onViewItem]);

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border border-border/60 bg-background">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="whitespace-nowrap">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                No items to display.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
