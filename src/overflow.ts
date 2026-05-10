/**
 * Overflow collapse algorithm for the git-statusline TUI footer.
 * Drops segments right-to-left by priority when the terminal is too narrow.
 *
 * Drop order (highest priority number dropped first):
 *   elapsed (4) → cost (3) → tokens (2) → model (1) → branch (never dropped)
 *
 * Min-widths (chars):
 *   branch: 8 | model: 6 | tokens: 11 | cost: 7 | elapsed: 7 | separator: 3
 */

const SEPARATOR = " │ "
const SEPARATOR_LEN = SEPARATOR.length // 3

/** The priority for the drop algorithm. Higher number → dropped first. */
export type DropPriority = 1 | 2 | 3 | 4

export type SegmentRender = {
  id: "branch" | "model" | "tokens" | "cost" | "elapsed"
  /** Full display text for this segment */
  text: string
  /** Minimum display text when budget is tight (used for truncation, not yet implemented in s1) */
  minText: string
  /** Whether this segment can be dropped when the line is too wide */
  droppable: boolean
  /** Drop priority — higher number is dropped first (only relevant when droppable: true) */
  priority?: DropPriority
}

/** Min-width per segment (chars). Segment must fit at least this many chars to avoid dropping. */
const MIN_WIDTH: Record<SegmentRender["id"], number> = {
  branch:  8,
  model:   6,
  tokens: 11,
  cost:    7,
  elapsed: 7,
}

/**
 * Collapse segments to fit within `width` characters.
 * Returns the joined string to render in the footer.
 *
 * Algorithm:
 * 1. Try full render. If it fits → return as-is.
 * 2. Drop loop: remove the highest-priority droppable segment until it fits.
 * 3. If only branch remains and still overflows → truncate branch to minText.
 * 4. Separators are only inserted between surviving segments.
 */
export function collapseSegments(parts: SegmentRender[], width: number): string {
  // Work on a mutable copy — never mutate the input
  let surviving = [...parts]

  const joinedWidth = (segs: SegmentRender[]): number => {
    if (segs.length === 0) return 0
    return (
      segs.reduce((acc, s) => acc + s.text.length, 0) +
      (segs.length - 1) * SEPARATOR_LEN
    )
  }

  // Step 1: Check if full render fits
  if (joinedWidth(surviving) <= width) {
    return surviving.map((s) => s.text).join(SEPARATOR)
  }

  // Step 2: Drop loop — drop highest-priority droppable segments first
  while (joinedWidth(surviving) > width) {
    const droppable = surviving.filter((s) => s.droppable)
    if (droppable.length === 0) break

    // Find max priority among droppable segments
    const maxPriority = Math.max(...droppable.map((s) => s.priority ?? 0))
    const idx = surviving.findIndex((s) => s.droppable && s.priority === maxPriority)
    if (idx === -1) break
    surviving.splice(idx, 1)
  }

  // Step 3: If still overflowing with only branch (or last segment), truncate to minText
  if (joinedWidth(surviving) > width && surviving.length > 0) {
    surviving = surviving.map((s) => ({
      ...s,
      text: s.minText.length <= width ? s.minText : s.minText.slice(0, Math.max(width, 1)),
    }))
  }

  // Step 4: Render with separators only between surviving segments
  return surviving.map((s) => s.text).join(SEPARATOR)
}
