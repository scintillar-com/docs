"use client"

import { useState } from "react"

interface SelectControl {
  type: "select"
  options: string[]
  default: string
}

interface BooleanControl {
  type: "boolean"
  default: boolean
}

interface TextControl {
  type: "text"
  default: string
}

interface NumberControl {
  type: "number"
  default: number
  min?: number
  max?: number
}

type ControlDef = SelectControl | BooleanControl | TextControl | NumberControl

export type ControlDefs = Record<string, ControlDef>

type ControlValues<T extends ControlDefs> = {
  [K in keyof T]: T[K] extends SelectControl
    ? string
    : T[K] extends BooleanControl
      ? boolean
      : T[K] extends TextControl
        ? string
        : T[K] extends NumberControl
          ? number
          : never
}

export interface ControlEntry {
  name: string
  def: ControlDef
  value: unknown
  onChange: (value: unknown) => void
}

export function useControls<T extends ControlDefs>(defs: T) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const [key, def] of Object.entries(defs)) {
      initial[key] = def.default
    }
    return initial
  })

  const entries: ControlEntry[] = Object.entries(defs).map(([name, def]) => ({
    name,
    def,
    value: values[name],
    onChange: (value: unknown) =>
      setValues((prev) => ({ ...prev, [name]: value })),
  }))

  return {
    values: values as ControlValues<T>,
    entries,
  }
}
