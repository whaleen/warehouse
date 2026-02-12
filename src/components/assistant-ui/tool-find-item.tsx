"use client";

import { memo } from "react";
import { MapPinIcon, PackageIcon, TagIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import { BucketPill } from "@/components/ui/bucket-pill";
import { CsoValue } from "@/components/ui/cso-value";
import {
  ToolFallbackRoot,
  ToolFallbackTrigger,
  ToolFallbackContent,
  ToolFallbackArgs,
  ToolFallbackError,
} from "./tool-fallback";

type FindItemResult = {
  found: boolean;
  items?: Array<{
    id?: string;
    serial?: string;
    cso?: string;
    model?: string;
    product_type?: string;
    sub_inventory?: string;
    inventory_type?: string;
    inventory_bucket?: string;
    status?: string;
    product_description?: string;
    raw_lat?: number;
    raw_lng?: number;
    last_scanned_at?: string;
    scanned_by?: string;
  }>;
  count?: number;
  message?: string;
  error?: string;
};

function ToolFindItemResult({
  result,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
}) {
  if (result === undefined) return null;

  const data = result as FindItemResult;

  // Handle not found case
  if (!data.found) {
    return (
      <div
        data-slot="tool-find-item-result"
        className={cn(
          "aui-tool-find-item-result border-t border-dashed px-4 pt-2",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircleIcon className="h-4 w-4" />
          <span>{data.message || "No items found"}</span>
        </div>
      </div>
    );
  }

  // Handle error case
  if (data.error) {
    return (
      <div
        data-slot="tool-find-item-result"
        className={cn(
          "aui-tool-find-item-result border-t border-dashed px-4 pt-2",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2 text-destructive">
          <XCircleIcon className="h-4 w-4" />
          <span>Error: {data.error}</span>
        </div>
      </div>
    );
  }

  // Handle found case with items
  if (!data.items || data.items.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="tool-find-item-result"
      className={cn(
        "aui-tool-find-item-result border-t border-dashed px-4 pt-2",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 mb-3 text-sm">
        <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="font-semibold">
          Found {data.count || data.items.length} {data.count === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-3">
        {data.items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm"
          >
            {/* Identifiers */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {item.serial && (
                <div className="flex items-center gap-2">
                  <TagIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Serial</div>
                    <div className="font-mono font-medium truncate">{item.serial}</div>
                  </div>
                </div>
              )}
              {item.cso && (
                <div className="flex items-center gap-2">
                  <TagIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">CSO</div>
                    <div className="font-mono font-medium truncate">
                      <CsoValue value={item.cso} />
                    </div>
                  </div>
                </div>
              )}
              {item.model && (
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Model</div>
                    <div className="font-medium truncate">{item.model}</div>
                  </div>
                </div>
              )}
              {item.product_description && (
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Description</div>
                    <div className="truncate">{item.product_description}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Type */}
            <div className="flex flex-wrap gap-2 text-xs">
              {(item as { inventory_bucket?: string | null }).inventory_bucket || item.inventory_type ? (
                <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1">
                  <span className="text-muted-foreground">Type:</span>
                  <BucketPill bucket={(item as { inventory_bucket?: string | null }).inventory_bucket || item.inventory_type} />
                </div>
              ) : null}
              {item.product_type && item.product_type !== 'Unknown' && (
                <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="font-medium">{item.product_type}</span>
                </div>
              )}
              {item.status && (
                <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{item.status}</span>
                </div>
              )}
              {item.sub_inventory && (
                <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1">
                  <span className="text-muted-foreground">Sub:</span>
                  <span className="font-medium">{item.sub_inventory}</span>
                </div>
              )}
            </div>

            {/* Location & Scan Info */}
            {(item.raw_lat !== undefined || item.last_scanned_at) && (
              <div className="pt-2 border-t space-y-1.5">
                {item.raw_lat !== undefined && item.raw_lng !== undefined && (
                  <div className="flex items-start gap-2">
                    <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">GPS Location</div>
                      <div className="font-mono text-xs">
                        {item.raw_lat.toFixed(6)}, {item.raw_lng.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}
                {item.last_scanned_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Last scanned:</span>
                    <span>{new Date(item.last_scanned_at).toLocaleString()}</span>
                    {item.scanned_by && <span>by {item.scanned_by}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ToolFindItemImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  return (
    <ToolFallbackRoot
      className={cn(isCancelled && "border-muted-foreground/30 bg-muted/30")}
    >
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        <ToolFallbackArgs
          argsText={argsText}
          className={cn(isCancelled && "opacity-60")}
        />
        {!isCancelled && <ToolFindItemResult result={result} />}
      </ToolFallbackContent>
    </ToolFallbackRoot>
  );
};

export const ToolFindItem = memo(
  ToolFindItemImpl,
) as unknown as ToolCallMessagePartComponent;

ToolFindItem.displayName = "ToolFindItem";
