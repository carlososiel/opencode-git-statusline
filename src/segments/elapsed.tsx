/**
 * Elapsed segment for the git-statusline TUI footer.
 * Shows wall-clock time since the first message of the current session,
 * updated every second via the nowMs signal.
 *
 *   < 1 hour → "12m 34s"
 *   ≥ 1 hour → "1h 02m"
 *   No messages / home route → "--m --s"
 *
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Message } from "@opencode-ai/sdk/v2"
import { formatDuration } from "../format.js"

export type ElapsedSegmentProps = {
  api: TuiPluginApi
  /** Reactive getter returning current sessionID or undefined on home route */
  sessionID: () => string | undefined
  /** Reactive getter returning current timestamp in ms (1s tick signal) */
  nowMs: () => number
}

function getFirstMessageMs(messages: ReadonlyArray<Message>): number | undefined {
  // Messages may be in any order; find the earliest created timestamp
  let earliest: number | undefined
  for (const msg of messages) {
    const t = msg.time.created
    if (earliest === undefined || t < earliest) {
      earliest = t
    }
  }
  return earliest
}

function ElapsedInner(props: ElapsedSegmentProps): JSX.Element {
  const elapsedText = createMemo(() => {
    const sid = props.sessionID()
    if (!sid) return "--m --s"
    const messages = props.api.state.session.messages(sid)
    const firstMs = getFirstMessageMs(messages)
    if (firstMs === undefined) return "--m --s"
    const elapsed = props.nowMs() - firstMs
    return formatDuration(elapsed)
  })

  return (
    <text>{elapsedText()}</text>
  )
}

export function ElapsedSegment(props: ElapsedSegmentProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<text>--m --s</text>}>
      <ElapsedInner {...props} />
    </ErrorBoundary>
  )
}
