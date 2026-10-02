"use client"

import { useEffect, useState } from "react"
import { withBasePath } from "@shell/lib/base-path"
import { FileCode } from "lucide-react"
import { Badge } from "@shell/components/shell-ui/badge"
import { EmptyState, EmptyStateIcon, EmptyStateDescription } from "@shell/components/shell-ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shell/components/shell-ui/table"

interface PropDoc {
  name: string
  type: string
  required: boolean
  defaultValue: string | null
  description: string
}

interface ComponentDoc {
  displayName: string
  description: string
  props: PropDoc[]
}

export function PropsTable({ name }: { name: string }) {
  const [docs, setDocs] = useState<ComponentDoc[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(withBasePath(`/props/${name}.json`))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setDocs)
      .catch(() => setError(true))
  }, [name])

  const isEmpty = error || (docs && docs.length === 0) || (docs && docs.every((c) => c.props.length === 0))

  if (!docs && !error) return <p className="text-sm text-muted-foreground" role="status" aria-live="polite">Loading...</p>

  if (isEmpty) return (
    <EmptyState>
      <EmptyStateIcon><FileCode /></EmptyStateIcon>
      <EmptyStateDescription>No documented props for this component.</EmptyStateDescription>
    </EmptyState>
  )

  if (!docs) return null

  return (
    <div className="space-y-8">
      {docs.map((comp) => (
        <div key={comp.displayName}>
          {docs.length > 1 && (
            <h4
              id={`props-${comp.displayName.toLowerCase()}`}
              className="text-base font-semibold mb-1"
            >
              {comp.displayName}
            </h4>
          )}
          {comp.description && (
            <p className="text-sm text-muted-foreground mb-3">
              {comp.description}
            </p>
          )}
          {comp.props.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Prop</TableHead>
                    <TableHead className="w-48">Type</TableHead>
                    <TableHead className="w-24">Default</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comp.props.map((prop) => (
                    <TableRow key={prop.name}>
                      <TableCell>
                        <code className="text-xs font-mono">{prop.name}</code>
                        {prop.required && (
                          <Badge
                            variant="destructive"
                            className="ml-1.5 text-[10px] px-1 py-0"
                          >
                            required
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono text-muted-foreground">
                          {prop.type}
                        </code>
                      </TableCell>
                      <TableCell>
                        {prop.defaultValue ? (
                          <code className="text-xs font-mono">
                            {prop.defaultValue}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {prop.description || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No documented props.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
