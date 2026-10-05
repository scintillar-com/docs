import { cn } from "@shell/lib/utils"

/** A placeholder shown when a section has no content. Displays an icon, title, and optional description. */
function EmptyState({
  /** Additional CSS classes. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 px-6 text-center",
        className
      )}
      {...props}
    />
  )
}

/** Icon container for the empty state. */
function EmptyStateIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-icon"
      className={cn(
        "mb-3 flex items-center justify-center rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-6",
        className
      )}
      {...props}
    />
  )
}

/** Title text for the empty state. */
function EmptyStateTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-state-title"
      className={cn("text-sm font-semibold text-foreground mb-1", className)}
      {...props}
    />
  )
}

/** Description text for the empty state. */
function EmptyStateDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn("text-sm text-muted-foreground max-w-sm", className)}
      {...props}
    />
  )
}

export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription }
