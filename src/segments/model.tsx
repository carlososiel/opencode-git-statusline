/**
 * Model segment for the git-statusline TUI footer.
 * Shows the active model in short form (substring after the last "/").
 * Reactively updates when the user changes the model via the model picker.
 *
 * Undefined or empty model → shows "--".
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 *
 * Props redesign (PR #6 reactive-loop fix):
 * - Accepts `configVersion` signal + `getModel` getter instead of `api` directly.
 * - `configVersion` is incremented by event handlers in the plugin scope.
 * - `getModel` reads api.state.config.model via untrack from the parent Footer.
 * This avoids a direct reactive subscription to the opencode config store,
 * which was one of the contributors to the reactive cascade crash.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import { formatModel } from "../format.js"

export type ModelSegmentProps = {
  /** Reactive version counter — increments when config/model changes */
  configVersion: () => number
  /** Getter that reads api.state.config.model via untrack in the parent */
  getModel: () => string | undefined
}

function ModelInner(props: ModelSegmentProps): JSX.Element {
  const label = createMemo(() => {
    props.configVersion() // reactive dependency: re-run when config changes
    return formatModel(props.getModel())
  })

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
