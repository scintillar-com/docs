"use client"

import { Link as LinkIcon } from "lucide-react"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
}

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
}

function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const

  return function Heading({ children, id, ...props }: HeadingProps) {
    const headingId = id || slugify(typeof children === "string" ? children : "")
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
          aria-label={`Link to ${typeof children === "string" ? children : "section"}`}
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
