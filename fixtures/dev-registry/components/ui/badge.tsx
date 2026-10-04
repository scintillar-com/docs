import type { ReactNode } from "react"

type Variant = "default" | "secondary" | "outline"

const variantClass: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children?: ReactNode
  variant?: Variant
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
