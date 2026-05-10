/**
 * Theme helper for the git-statusline TUI plugin.
 * Returns reactive closures that re-read from `theme.current` on each call,
 * allowing SolidJS to auto-track theme changes without explicit subscriptions.
 */
import { untrack } from "solid-js"
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
/**
 * IMPORTANT: theme.current is a reactive SolidJS store in opentui. Reading it
 * without untrack() creates a subscription to ALL theme changes — including
 * thinkingOpacity which is animated during AI processing (many updates/sec).
 * This would cause every theme read inside a createMemo or JSX to re-run on
 * each animation frame, causing a synchronous reactive cascade and call stack
 * overflow after a few seconds.
 *
 * Fix: always read theme.current[key] inside untrack(). Colors won't reactively
 * update when the theme changes mid-session, but that's acceptable — theme
 * changes during a session are extremely rare.
 */
export const useThemeColor = (theme: TuiTheme, key: ThemeColorKey): (() => RGBA) =>
  () => untrack(() => theme.current[key] as RGBA)
