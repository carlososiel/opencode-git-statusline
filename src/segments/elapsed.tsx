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
 *
 * Props redesign (PR #6 reactive-loop fix):
 * - Accepts `messages` getter (already gated by messageVersion) instead of
 *   reading api.state.session.messages(sid) independently.
 * - Eliminates a direct reactive subscription to the opencode message store.
 * - Previously combining messages + nowMs in a single createMemo subscribed to
 *   BOTH the opencode store AND the 1s timer, causing double-cascade on every tick.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { Message } from "@opencode-ai/sdk/v2"
import { formatDuration } from "../format.js"

export type ElapsedSegmentProps = {
  /** Reactive getter returning current sessionID or undefined on home route */
  sessionID: () => string | undefined
  /** Reactive getter returning current timestamp in ms (1s tick signal) */
  nowMs: () => number
  /**
   * Reactive getter returning current messages array.
   * Provided by Footer — already gated by messageVersion signal.
   * Returns [] when sessionID is undefined (home route).
   */
  messages: () => ReadonlyArray<Message>
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
  /**
   * firstMs: depends on messages (gated by messageVersion).
   * Separated from the nowMs dependency so a new message arrival doesn't
   * compound with the 1s tick in a single memo.
   */
  const firstMs = createMemo(() => {
    const sid = props.sessionID()
    if (!sid) return undefined
    return getFirstMessageMs(props.messages())
  })

  const elapsedText = createMemo(() => {
    if (firstMs() === undefined) return "--m --s"
    const elapsed = props.nowMs() - firstMs()!
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
