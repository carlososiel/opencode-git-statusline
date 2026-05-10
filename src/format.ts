/**
 * Pure formatting utilities for the git-statusline TUI plugin.
 * No Solid or runtime dependencies — safe for isolated unit testing via `node -e`.
 */

/**
 * Format a token count with smart unit suffixes.
 * Boundary: < 1000 → integer string; >= 1000 < 1M → "X.Xk"; >= 1M → "X.XM"
 *
 * Examples: 950 → "950", 1000 → "1.0k", 1_000_000 → "1.0M"
 */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/**
 * Format a cost value in USD with magnitude-based decimal precision.
 * Boundary: < 0.01 → 4 decimal places; >= 0.01 → 2 decimal places.
 *
 * Examples: 0.0042 → "$0.0042", 0.01 → "$0.01", 1.234 → "$1.23"
 */
export function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * Uses Math.floor for both minutes and hours — predictable "elapsed since" semantics.
 * Documented decision: 59.9s shows "0m 59s", not "1m 00s".
 *
 * - Negative or non-finite input → "--m --s"
 * - < 1 hour → "Nm SSs"  (e.g. "12m 34s")
 * - >= 1 hour → "Nh MMm" (e.g. "1h 02m")
 *
 * Examples: 754000ms → "12m 34s", 3720000ms → "1h 02m", -1 → "--m --s"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "--m --s"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  if (h >= 1) {
    const m = Math.floor((totalSec - h * 3600) / 60)
    return `${h}h ${String(m).padStart(2, "0")}m`
  }
  const m = Math.floor(totalSec / 60)
  const s = totalSec - m * 60
  return `${m}m ${String(s).padStart(2, "0")}s`
}

/**
 * Format a model ID to its short form by stripping the provider prefix.
 * Extracts the substring after the last "/" slash.
 *
 * Examples: "anthropic/claude-opus-4-7" → "claude-opus-4-7", undefined → "--"
 */
export function formatModel(id: string | undefined): string {
  if (!id) return "--"
  const slash = id.lastIndexOf("/")
  return slash >= 0 ? id.slice(slash + 1) : id
}
