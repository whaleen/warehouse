import * as React from "react";

import { cn } from "@/lib/utils";

type BucketPillVariant = "badge" | "marker" | "drawer";

export interface BucketPillProps {
  bucket?: string | null;
  label?: string;
  variant?: BucketPillVariant;
  className?: string;
  children?: React.ReactNode;
  as?: "span" | "div";
}

const variantClasses: Record<BucketPillVariant, string> = {
  badge: "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
  marker: "h-5 rounded-md border-2 border-white shadow-lg text-[9px] font-semibold tracking-tight px-2 flex items-center text-slate-900",
  drawer: "flex items-center gap-2 px-2 py-1 rounded-sm border shadow-sm min-w-0 text-sm",
};

export function BucketPill({
  bucket,
  label,
  variant = "badge",
  className,
  children,
  as = "span",
}: BucketPillProps) {
  if (!bucket) return null;

  const backgroundImage =
    bucket === "FG"
      ? "repeating-linear-gradient(45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px), repeating-linear-gradient(-45deg, rgba(100,116,139,0.4) 0, rgba(100,116,139,0.4) 0.7px, transparent 0.7px, transparent 3px)"
      : bucket === "ASIS"
        ? "radial-gradient(circle, rgba(100,116,139,0.4) 0.8px, transparent 0.8px)"
        : undefined;

  const backgroundSize = bucket === "ASIS" ? "4px 4px" : undefined;
  const displayLabel = label ?? bucket;

  const Comp = as;

  return (
    <Comp
      className={cn(variantClasses[variant], className)}
      style={{
        backgroundColor: "rgba(255,255,255,0.9)",
        backgroundImage,
        backgroundSize,
      }}
    >
      {children ?? displayLabel}
    </Comp>
  );
}
