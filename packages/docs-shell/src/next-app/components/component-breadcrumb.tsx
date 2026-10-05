"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@shell/components/shell-ui/breadcrumb"

export function ComponentBreadcrumb({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const titleRef = useRef<HTMLDivElement>(null)
  const [scrolledPast, setScrolledPast] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById("header-breadcrumb")) // eslint-disable-line react-hooks/set-state-in-effect -- mount detection for portal target
  }, [])

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrolledPast(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: "-56px 0px 0px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={titleRef}>{children}</div>
      {target && createPortal(
        <span className={`inline-flex items-center transition-opacity duration-200 ${scrolledPast ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm max-md:text-xs font-medium">
              {name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </span>,
        target
      )}
    </>
  )
}
