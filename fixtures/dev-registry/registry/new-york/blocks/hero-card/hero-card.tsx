import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function HeroCard() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          Block
        </Badge>
        <CardTitle>Hero Card</CardTitle>
        <CardDescription>
          A block that composes Badge, Button, and Card. Exists only to
          verify the shell renders the blocks section and the block detail
          page correctly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button>Primary action</Button>
          <Button variant="outline">Secondary</Button>
        </div>
      </CardContent>
    </Card>
  )
}
