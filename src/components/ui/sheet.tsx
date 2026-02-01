"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const SheetContext = React.createContext<{
  onOpenChange?: (open: boolean) => void
}>({})

function Sheet({ onOpenChange, ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return (
    <SheetContext.Provider value={{ onOpenChange }}>
      <SheetPrimitive.Root data-slot="sheet" onOpenChange={onOpenChange} {...props} />
    </SheetContext.Provider>
  )
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showClose = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showClose?: boolean
}) {
  const { onOpenChange } = React.useContext(SheetContext);
  const [dragOffset, setDragOffset] = React.useState(0);
  const touchStartRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);

  const dragThreshold = 10;
  const snapThreshold = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (side !== "bottom") return;
    touchStartRef.current = e.targetTouches[0].clientY;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null || side !== "bottom") return;

    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - touchStartRef.current;

    if (!isDraggingRef.current && Math.abs(diff) < dragThreshold) {
      return;
    }

    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
    }

    const offset = Math.max(0, diff);
    setDragOffset(offset);

    if (offset > 0) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || side !== "bottom") return;

    if (!isDraggingRef.current) {
      touchStartRef.current = null;
      setDragOffset(0);
      return;
    }

    if (dragOffset > snapThreshold && onOpenChange) {
      onOpenChange(false);
    }

    setDragOffset(0);
    touchStartRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <SheetPortal>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed inset-0 z-50"
        style={{ pointerEvents: 'none' }}
      >
        <SheetOverlay style={{ pointerEvents: 'auto' }} />
        <SheetPrimitive.Content
          data-slot="sheet-content"
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            side === "right" &&
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
            side === "left" &&
              "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
            side === "top" &&
              "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
            side === "bottom" &&
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
            className
          )}
          style={{
            pointerEvents: 'auto',
            transform: `translateY(${dragOffset}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 300ms ease-out',
          }}
          {...props}
        >
          {children}
          {showClose && (
            <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </div>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
