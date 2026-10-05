import {
  BookOpen,
  Boxes,
  Code2,
  Cog,
  FileText,
  GraduationCap,
  Layers,
  LifeBuoy,
  Lightbulb,
  Rocket,
  Scale,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react"

/**
 * Icon names a docs section may declare (`sections[].icon` in the config).
 * Deliberately a small fixed set rather than all of lucide: the icons are
 * bundled into the client, and an open-ended lookup would pull the whole
 * icon package into the sidebar chunk.
 */
const ICONS = {
  BookOpen,
  Boxes,
  Code2,
  Cog,
  FileText,
  GraduationCap,
  Layers,
  LifeBuoy,
  Lightbulb,
  Rocket,
  Scale,
  ShieldCheck,
  Terminal,
  Wrench,
} as const

export type SectionIconName = keyof typeof ICONS

/** Resolve a configured icon name, falling back to `BookOpen` when unknown. */
export function sectionIcon(name: string): React.ComponentType<{ className?: string }> {
  return ICONS[name as SectionIconName] ?? BookOpen
}

/** The names accepted by `icon` in a section config — surfaced for docs/editor help. */
export const SECTION_ICON_NAMES = Object.keys(ICONS) as SectionIconName[]
