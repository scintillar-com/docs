import type { ReactNode } from "react"

export function Card({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return <div className={`flex flex-col gap-1.5 p-6 ${className}`}>{children}</div>
}

export function CardTitle({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <h3 className={`text-lg font-semibold leading-none ${className}`}>{children}</h3>
  )
}

export function CardDescription({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>
}

export function CardContent({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>
}
