/**
 * Cost segment for the git-statusline TUI footer.
 * Shows aggregated cost of all assistant messages in the current session:
 *   $0.0042  (< $0.01 → 4 decimal places)
 *   $1.23    (≥ $0.01 → 2 decimal places)
 *
 * No session / home route → shows "$--".
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Message } from "@opencode-ai/sdk/v2"
import { formatCost } from "../format.js"

export type CostSegmentProps = {
  api: TuiPluginApi
  /** Reactive getter returning current sessionID or undefined on home route */
  sessionID: () => string | undefined
}

function aggregateCost(messages: ReadonlyArray<Message>): number {
  let total = 0
  for (const msg of messages) {
    if (msg.role === "assistant") {
      total += msg.cost
    }
  }
  return total
}

function CostInner(props: CostSegmentProps): JSX.Element {
  const costText = createMemo(() => {
    const sid = props.sessionID()
    if (!sid) return "$--"
    const messages = props.api.state.session.messages(sid)
    const total = aggregateCost(messages)
    return formatCost(total)
  })

  return (
    <text>{costText()}</text>
  )
}

export function CostSegment(props: CostSegmentProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<text>$--</text>}>
      <CostInner {...props} />
    </ErrorBoundary>
  )
}
