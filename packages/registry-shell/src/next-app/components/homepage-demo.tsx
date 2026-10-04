"use client"

import { Button } from "@shell/components/shell-ui/button"
import { Badge } from "@shell/components/shell-ui/badge"
import { Input } from "@shell/components/shell-ui/input"
import { Checkbox } from "@shell/components/shell-ui/checkbox"
import { Label } from "@shell/components/shell-ui/label"
import { Skeleton } from "@shell/components/shell-ui/skeleton"
import { Separator } from "@shell/components/shell-ui/separator"
import { Toggle } from "@shell/components/shell-ui/toggle"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@shell/components/shell-ui/card"
import {
  Bold,
  Italic,
  Underline,
  Star,
  Heart,
  Zap,
  Check,
} from "lucide-react"

function DemoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm w-56 shrink-0">
      {children}
    </div>
  )
}

const leftColumn = [
  <DemoCard key="buttons">
    <p className="text-xs font-medium text-muted-foreground mb-2">Buttons</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm">Primary</Button>
      <Button size="sm" variant="outline">Outline</Button>
      <Button size="sm" variant="ghost">Ghost</Button>
    </div>
  </DemoCard>,

  <DemoCard key="badges">
    <p className="text-xs font-medium text-muted-foreground mb-2">Badges</p>
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  </DemoCard>,

  <DemoCard key="input">
    <p className="text-xs font-medium text-muted-foreground mb-2">Input</p>
    <Input placeholder="Type something..." className="h-8 text-xs" />
  </DemoCard>,

  <DemoCard key="skeleton">
    <p className="text-xs font-medium text-muted-foreground mb-2">Skeleton</p>
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  </DemoCard>,

  <DemoCard key="card">
    <Card className="border-0 shadow-none p-0 gap-2">
      <CardHeader className="p-0">
        <CardTitle className="text-sm">Card Title</CardTitle>
        <CardDescription className="text-xs">A sample card</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-xs text-muted-foreground">Card content goes here.</p>
      </CardContent>
    </Card>
  </DemoCard>,
]

const rightColumn = [
  <DemoCard key="checkbox">
    <p className="text-xs font-medium text-muted-foreground mb-2">Checkbox</p>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id="h-1" defaultChecked />
        <Label htmlFor="h-1" className="text-xs">Completed</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="h-2" />
        <Label htmlFor="h-2" className="text-xs">In progress</Label>
      </div>
    </div>
  </DemoCard>,

  <DemoCard key="toggle">
    <p className="text-xs font-medium text-muted-foreground mb-2">Toggle</p>
    <div className="flex gap-1">
      <Toggle size="sm" aria-label="Bold"><Bold className="size-3.5" /></Toggle>
      <Toggle size="sm" aria-label="Italic"><Italic className="size-3.5" /></Toggle>
      <Toggle size="sm" aria-label="Underline"><Underline className="size-3.5" /></Toggle>
    </div>
  </DemoCard>,

  <DemoCard key="separator">
    <p className="text-xs font-medium text-muted-foreground mb-2">Separator</p>
    <div className="space-y-2">
      <p className="text-xs">Above</p>
      <Separator />
      <p className="text-xs">Below</p>
    </div>
  </DemoCard>,

  <DemoCard key="icons">
    <p className="text-xs font-medium text-muted-foreground mb-2">Icons</p>
    <div className="flex gap-3">
      <Star className="size-5 text-amber-500" />
      <Heart className="size-5 text-red-500" />
      <Zap className="size-5 text-blue-500" />
      <Check className="size-5 text-green-500" />
    </div>
  </DemoCard>,

  <DemoCard key="buttons2">
    <p className="text-xs font-medium text-muted-foreground mb-2">Sizes</p>
    <div className="flex items-center gap-2">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">MD</Button>
    </div>
  </DemoCard>,
]

export function HomepageDemo() {
  // Duplicate items for seamless infinite scroll
  const left = [...leftColumn, ...leftColumn]
  const right = [...rightColumn, ...rightColumn]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 hidden md:flex">
      {/* Left column — scrolling up */}
      <div
        className="scroll-up absolute left-[8%] top-0 flex flex-col gap-4 -rotate-12"
        style={{ animation: "scroll-up 30s linear infinite" }}
      >
        {left.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>

      {/* Right column — scrolling down */}
      <div
        className="scroll-down absolute right-[8%] top-0 flex flex-col gap-4 rotate-12"
        style={{ animation: "scroll-down 25s linear infinite" }}
      >
        {right.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>

      <style jsx>{`
        @keyframes scroll-up {
          0% { transform: rotate(-12deg) translateY(0); }
          100% { transform: rotate(-12deg) translateY(-50%); }
        }
        @keyframes scroll-down {
          0% { transform: rotate(12deg) translateY(-50%); }
          100% { transform: rotate(12deg) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scroll-up, .scroll-down { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
