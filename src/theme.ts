/**
 * Theme helper for the git-statusline TUI plugin.
 * Returns reactive closures that re-read from `theme.current` on each call,
 * allowing SolidJS to auto-track theme changes without explicit subscriptions.
 */
import type { TuiTheme, TuiThemeCurrent } from "@opencode-ai/plugin/tui"

/**
 * Returns a getter function for a specific theme color key.
 * Call the returned getter inside JSX to ensure reactivity — each read of
 * `theme.current[key]` is tracked by SolidJS's reactive system.
 *
 * @param theme - The TuiTheme object from the plugin API context
 * @param key   - A key of TuiThemeCurrent (e.g. "success", "borderSubtle")
 * @returns A zero-arg function returning the current RGBA value for that key
 */
export const useThemeColor = (theme: TuiTheme, key: keyof TuiThemeCurrent) =>
  () => theme.current[key]
