import * as React from "react"

import { cn } from "@/lib/utils"

type WarehouseLogoProps = React.SVGProps<SVGSVGElement> & {
  title?: string
}

export function WarehouseLogo({ className, title, ...props }: WarehouseLogoProps) {
  const titleId = React.useId()
  const hasTitle = Boolean(title)

  return (
    <svg
      viewBox="0 0 500 500"
      className={cn("text-foreground", className)}
      role={hasTitle ? "img" : "presentation"}
      aria-hidden={hasTitle ? undefined : true}
      aria-labelledby={hasTitle ? titleId : undefined}
      focusable="false"
      {...props}
    >
      {hasTitle ? <title id={titleId}>{title}</title> : null}
      <path
        id="w"
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={16}
        d="M 150 140 L 210 360 L 250 200 L 290 360 L 350 140"
      />
      <path
        id="box"
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={16}
        d="M 80 80 L 420 80 L 420 420 L 80 420 L 80 80 Z"
      />
    </svg>
  )
}
