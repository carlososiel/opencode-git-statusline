/**
 * Theme helper for the git-statusline TUI plugin.
 * Returns reactive closures that re-read from `theme.current` on each call,
 * allowing SolidJS to auto-track theme changes without explicit subscriptions.
 */
import type { TuiTheme, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { RGBA } from "@opentui/core"

/**
 * Keys of TuiThemeCurrent whose value is RGBA (i.e., color keys only).
 * Excludes numeric fields like `thinkingOpacity`.
 */
export type ThemeColorKey = {
  [K in keyof TuiThemeCurrent]: TuiThemeCurrent[K] extends RGBA ? K : never
}[keyof TuiThemeCurrent]

/**
 * Returns a getter function for a specific theme color key.
 * Call the returned getter inside JSX to ensure reactivity — each read of
 * `theme.current[key]` is tracked by SolidJS's reactive system.
 *
 * Restricted to RGBA keys only (excludes `thinkingOpacity: number`).
 *
 * @param theme - The TuiTheme object from the plugin API context
 * @param key   - A color key of TuiThemeCurrent (must be RGBA-typed)
 * @returns A zero-arg function returning the current RGBA value for that key
 */
export const useThemeColor = (theme: TuiTheme, key: ThemeColorKey): (() => RGBA) =>
  () => theme.current[key] as RGBA
