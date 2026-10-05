/**
 * Input rules for `PreviewCanvas`: when a wheel or key event drives the
 * canvas camera, and when it belongs to the previewed component.
 *
 * Kept free of React and of the DOM globals so the rules can be unit-tested
 * in Node with plain objects standing in for elements.
 */

/** The part of `Element` the rules need. */
export interface ClosestTarget {
  closest(selector: string): unknown
}

/**
 * Elements that handle keys themselves: form fields, buttons, editable text
 * and the ARIA widgets whose keyboard model uses arrows / Home / End / +/-.
 * A key event coming from inside one of them is never a canvas shortcut.
 */
export const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[contenteditable]:not([contenteditable='false'])",
  "[role=slider]",
  "[role=tab]",
  "[role=tablist]",
  "[role=menuitem]",
  "[role=menuitemcheckbox]",
  "[role=menuitemradio]",
  "[role=option]",
  "[role=listbox]",
  "[role=radiogroup]",
  "[role=radio]",
  "[role=combobox]",
  "[role=switch]",
  "[role=checkbox]",
  "[role=spinbutton]",
  "[role=grid]",
  "[role=gridcell]",
  "[role=tree]",
  "[role=treeitem]",
].join(", ")

function hasClosest(target: unknown): target is ClosestTarget {
  return (
    typeof target === "object" &&
    target !== null &&
    typeof (target as { closest?: unknown }).closest === "function"
  )
}

/** True when `target` is, or sits inside, an element that owns its keys. */
export function isInteractiveTarget(target: unknown): boolean {
  if (!hasClosest(target)) return false
  return target.closest(INTERACTIVE_SELECTOR) != null
}

/**
 * Whether a wheel event zooms the canvas.
 *
 * - Ctrl / Cmd + wheel always zooms. Browsers also report trackpad pinch as
 *   a wheel event with `ctrlKey` set, so pinch zooms too.
 * - A plain wheel zooms only over the canvas's own surfaces (dot grid, move
 *   handle, container), never over the rendered component, so scroll areas,
 *   lists and `overflow-auto` boxes inside a preview scroll natively.
 */
export function shouldZoomOnWheel(
  event: { ctrlKey: boolean; metaKey: boolean; target: unknown },
  canvasSurfaces: ReadonlyArray<unknown>,
): boolean {
  if (event.ctrlKey || event.metaKey) return true
  return event.target != null && canvasSurfaces.includes(event.target)
}

/**
 * Whether a keydown on the canvas should run a canvas shortcut (arrow pan,
 * `+` / `-` zoom, `0` recenter). Skipped when something already handled the
 * key, or when focus is inside an interactive element of the component (an
 * arrow on a slider moves the slider, not the camera).
 */
export function shouldHandleCanvasKey(event: {
  defaultPrevented: boolean
  target: unknown
}): boolean {
  if (event.defaultPrevented) return false
  return !isInteractiveTarget(event.target)
}
