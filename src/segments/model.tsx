/**
 * Model segment for the git-statusline TUI footer.
 * Shows the active model in short form (substring after the last "/").
 * Reactively updates when the user changes the model via the model picker.
 *
 * Undefined or empty model → shows "--".
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { formatModel } from "../format.js"

export type ModelSegmentProps = {
  api: TuiPluginApi
}

function ModelInner(props: ModelSegmentProps): JSX.Element {
  const label = createMemo(() => formatModel(props.api.state.config.model))

  return (
    <text>{label()}</text>
  )
}

export function ModelSegment(props: ModelSegmentProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<text>--</text>}>
      <ModelInner {...props} />
    </ErrorBoundary>
  )
}
