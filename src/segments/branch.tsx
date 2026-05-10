/**
 * Branch segment for the git-statusline TUI footer.
 * Shows the current git branch name with state indicators:
 *   * — dirty working tree
 *   ↑N — ahead of upstream by N commits
 *   ↓N — behind upstream by N commits
 *
 * Icon color:
 *   theme.success — clean state
 *   theme.warning — dirty or ahead/behind
 *   theme.error   — git error (timeout, not installed, etc.)
 *
 * Non-git directory → shows "--" without indicators.
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 *
 * Props change (PR #6 reactive-loop fix):
 * - `vcsBranch` is now a getter `() => string | undefined` instead of a plain
 *   string prop. The parent (Footer) reads api.state.vcs?.branch via untrack()
 *   and passes a getter, so this component does not directly subscribe to the
 *   opencode VCS store.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import type { TuiTheme } from "@opencode-ai/plugin/tui"
import type { GitState } from "../git.js"
import { useThemeColor } from "../theme.js"

export type BranchSegmentProps = {
  theme: TuiTheme
  /** Reactive getter returning the current GitState */
  gitStatus: () => GitState
  /**
   * Getter for the vcs branch from api.state (fallback when git poll has error).
   * Passed as a getter from Footer to avoid a direct reactive subscription to
   * the opencode VCS store. Read via untrack in the parent.
   */
  vcsBranch: () => string | undefined
}

/** Build the display string for the branch segment from a GitState. */
function buildBranchText(state: GitState, vcsBranch: string | undefined): string {
  if (state.error === "not-a-repo" || (!state.branch && !vcsBranch)) {
    return "--"
  }
  const branch = state.branch ?? vcsBranch ?? "--"
  let suffix = ""
  if (!state.error) {
    if (state.dirty) suffix += "*"
    if (state.ahead > 0) suffix += `↑${state.ahead}`
    if (state.behind > 0) suffix += `↓${state.behind}`
  }
  return `${branch}${suffix}`
}

/** Choose foreground color based on GitState. */
function stateColor(state: GitState, theme: TuiTheme): RGBA {
  if (state.error && state.error !== "not-a-repo") {
    return useThemeColor(theme, "error")()
  }
  if (state.dirty || state.ahead > 0 || state.behind > 0) {
    return useThemeColor(theme, "warning")()
  }
  return useThemeColor(theme, "success")()
}

function BranchInner(props: BranchSegmentProps): JSX.Element {
  const text = createMemo(() => buildBranchText(props.gitStatus(), props.vcsBranch()))
  const color = createMemo<RGBA>(() => stateColor(props.gitStatus(), props.theme))

  return (
    <text fg={color()}>{text()}</text>
  )
}

export function BranchSegment(props: BranchSegmentProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<text>--</text>}>
      <BranchInner {...props} />
    </ErrorBoundary>
  )
}
