"use client"

import { isValidElement, type ReactNode } from "react"
import { Link as LinkIcon } from "lucide-react"
// Shared with the search index, so a result's #anchor matches the heading.
import { slugify } from "../../content/markdown"

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
}

/**
 * The plain text of a heading's children: `## Using \`run()\`` renders as
 * `["Using ", <code>run()</code>]`, whose text is "Using run()". Only
 * string children used to count, so such headings got no anchor at all.
 */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const

  return function Heading({ children, id, ...props }: HeadingProps) {
    const text = textOf(children)
    const headingId = id || slugify(text)
    if (!headingId) return <Tag {...props}>{children}</Tag>

    return (
      <Tag id={headingId} className="group relative scroll-mt-20" {...props}>
        {children}
        <a
          href={`#${headingId}`}
          onClick={(e) => {
            e.preventDefault()
            history.replaceState(null, "", `#${headingId}`)
            document.getElementById(headingId)?.scrollIntoView({ behavior: "smooth", block: "start" })
            // Copy link to clipboard
            navigator.clipboard?.writeText(window.location.href)
          }}
          className="inline-flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          aria-label={`Link to ${text || "section"}`}
        >
          <LinkIcon className="size-4" />
        </a>
      </Tag>
    )
  }
}

export const mdxHeadings = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
}
