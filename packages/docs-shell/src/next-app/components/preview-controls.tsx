"use client"

import type { ControlEntry } from "@shell/hooks/use-controls"
import { Label } from "@shell/components/shell-ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shell/components/shell-ui/select"
import { Input } from "@shell/components/shell-ui/input"

export function PreviewControls({ entries }: { entries: ControlEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.name} className="space-y-1">
          <Label className="text-xs text-muted-foreground capitalize">
            {entry.name}
          </Label>
          <ControlInput entry={entry} />
        </div>
      ))}
    </div>
  )
}

function ControlInput({ entry }: { entry: ControlEntry }) {
  const { def, value, onChange } = entry

  switch (def.type) {
    case "select":
      return (
        <Select value={value as string} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.options.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case "boolean":
      return (
        <button
          onClick={() => onChange(!value)}
          className={`flex h-8 w-full items-center justify-between rounded-md border px-2 text-xs cursor-pointer transition-colors ${
            value
              ? "border-primary bg-primary/5 text-foreground"
              : "border-input text-muted-foreground"
          }`}
        >
          <span>{value ? "true" : "false"}</span>
          <div
            className={`h-4 w-7 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
          >
            <div
              className={`h-4 w-4 rounded-full bg-background border shadow-sm transition-transform ${value ? "translate-x-3" : "translate-x-0"}`}
            />
          </div>
        </button>
      )

    case "text":
      return (
        <Input
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      )

    case "number":
      return (
        <Input
          type="number"
          value={value as number}
          min={def.min}
          max={def.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-xs"
        />
      )
  }
}
