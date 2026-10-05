import { describe, expect, it } from "vitest"
import {
  INTERACTIVE_SELECTOR,
  isInteractiveTarget,
  shouldHandleCanvasKey,
  shouldZoomOnWheel,
} from "./preview-canvas-input"

/**
 * Minimal stand-in for a DOM element: a tag, attributes and a parent, with a
 * `closest()` that understands the selector forms INTERACTIVE_SELECTOR uses
 * (`tag`, `[attr]`, `[attr=value]`, `[attr]:not([attr='value'])`).
 */
interface FakeNode {
  tag: string
  attrs: Record<string, string>
  parent: FakeNode | null
  closest(selector: string): FakeNode | null
}

function matchesSimple(node: FakeNode, sel: string): boolean {
  const not = /^(.*):not\((.*)\)$/.exec(sel)
  if (not) return matchesSimple(node, not[1]) && !matchesSimple(node, not[2])
  const attr = /^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]$/.exec(sel)
  if (attr) {
    const value = node.attrs[attr[1]]
    if (value === undefined) return false
    return attr[2] === undefined || value === attr[2]
  }
  return node.tag === sel
}

function el(
  tag: string,
  attrs: Record<string, string> = {},
  parent: FakeNode | null = null,
): FakeNode {
  const node: FakeNode = {
    tag,
    attrs,
    parent,
    closest(selector) {
      const parts = selector.split(",").map((s) => s.trim())
      for (let n: FakeNode | null = node; n; n = n.parent) {
        if (parts.some((p) => matchesSimple(n!, p))) return n
      }
      return null
    },
  }
  return node
}

describe("shouldZoomOnWheel", () => {
  const container = el("div")
  const canvas = el("canvas", {}, container)
  const moveHandle = el("div", {}, container)
  const surfaces = [container, canvas, moveHandle]
  const inComponent = el("div", { "data-slot": "scroll-area-viewport" }, container)

  const wheel = (target: unknown, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({
    ctrlKey: false,
    metaKey: false,
    ...mods,
    target,
  })

  it("zooms over the empty canvas, the move handle and the container", () => {
    expect(shouldZoomOnWheel(wheel(canvas), surfaces)).toBe(true)
    expect(shouldZoomOnWheel(wheel(moveHandle), surfaces)).toBe(true)
    expect(shouldZoomOnWheel(wheel(container), surfaces)).toBe(true)
  })

  it("leaves a plain wheel inside the component alone so it scrolls", () => {
    expect(shouldZoomOnWheel(wheel(inComponent), surfaces)).toBe(false)
  })

  it("zooms anywhere with Ctrl (and trackpad pinch) or Cmd", () => {
    expect(shouldZoomOnWheel(wheel(inComponent, { ctrlKey: true }), surfaces)).toBe(true)
    expect(shouldZoomOnWheel(wheel(inComponent, { metaKey: true }), surfaces)).toBe(true)
  })

  it("ignores missing surfaces and a null target", () => {
    expect(shouldZoomOnWheel(wheel(null), [null, null])).toBe(false)
    expect(shouldZoomOnWheel(wheel(inComponent), [null, canvas])).toBe(false)
  })
})

describe("shouldHandleCanvasKey", () => {
  const container = el("div", { tabindex: "0" })
  const key = (target: unknown, defaultPrevented = false) => ({ target, defaultPrevented })

  it("handles keys on the canvas itself and on plain content", () => {
    expect(shouldHandleCanvasKey(key(container))).toBe(true)
    expect(shouldHandleCanvasKey(key(el("p", {}, container)))).toBe(true)
  })

  it("skips keys a child already handled", () => {
    expect(shouldHandleCanvasKey(key(container, true))).toBe(false)
  })

  it("skips arrows on a slider thumb", () => {
    const slider = el("span", { "data-slot": "slider" }, container)
    const thumb = el("span", { role: "slider", tabindex: "0" }, slider)
    expect(shouldHandleCanvasKey(key(thumb))).toBe(false)
  })

  it.each([
    ["input"],
    ["textarea"],
    ["select"],
    ["button"],
  ])("skips keys from a <%s>", (tag) => {
    expect(shouldHandleCanvasKey(key(el(tag, {}, container)))).toBe(false)
  })

  it.each([
    "slider", "tab", "tablist", "menuitem", "menuitemcheckbox", "menuitemradio",
    "option", "listbox", "radiogroup", "radio", "combobox", "switch",
    "checkbox", "spinbutton", "grid", "gridcell", "tree", "treeitem",
  ])("skips keys from inside role=%s", (role) => {
    const widget = el("div", { role }, container)
    const inner = el("span", {}, widget)
    expect(shouldHandleCanvasKey(key(inner))).toBe(false)
  })

  it("skips keys inside contenteditable, but not contenteditable=false", () => {
    const editor = el("div", { contenteditable: "true" }, container)
    expect(shouldHandleCanvasKey(key(el("p", {}, editor)))).toBe(false)
    expect(shouldHandleCanvasKey(key(el("div", { contenteditable: "false" }, container)))).toBe(true)
  })

  it("handles keys when the target has no closest() (e.g. a text node)", () => {
    expect(shouldHandleCanvasKey(key({}))).toBe(true)
    expect(isInteractiveTarget(null)).toBe(false)
  })

  it("lists every required interactive role", () => {
    for (const role of ["slider", "tab", "menuitem", "option", "combobox", "treeitem"]) {
      expect(INTERACTIVE_SELECTOR).toContain(`[role=${role}]`)
    }
  })
})
