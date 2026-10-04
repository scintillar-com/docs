import * as React from "react"

import { cn } from "@shell/lib/utils"

/** A styled container card with rounded corners, border, and shadow. */
function Card({
  /** Additional CSS classes to apply to the card. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

/** Header section of a Card, typically containing a title and description. */
function CardHeader({
  /** Additional CSS classes to apply to the card header. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

/** Title element within a CardHeader. */
function CardTitle({
  /** Additional CSS classes to apply to the card title. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

/** Description text within a CardHeader, rendered in muted style. */
function CardDescription({
  /** Additional CSS classes to apply to the card description. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/** Action area positioned at the top-right of a CardHeader. */
function CardAction({
  /** Additional CSS classes to apply to the card action. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

/** Main content area of a Card. */
function CardContent({
  /** Additional CSS classes to apply to the card content. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

/** Footer section of a Card, typically used for actions or metadata. */
function CardFooter({
  /** Additional CSS classes to apply to the card footer. */
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
