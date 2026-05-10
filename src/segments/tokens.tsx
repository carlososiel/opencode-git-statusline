/**
 * Tokens segment for the git-statusline TUI footer.
 * Shows aggregated input/output token counts for the current session:
 *   ↑12.3k ↓4.5k
 *
 * Glyph labels (↑ ↓) use theme.textMuted; numeric values use theme.text.
 * No session / home route → shows "↑-- ↓--".
 * Wrapped in <ErrorBoundary> so a crash never breaks the whole footer.
 *
 * Props redesign (PR #6 reactive-loop fix):
 * - Accepts `messages` getter (already gated by messageVersion) instead of
 *   reading api.state.session.messages(sid) independently.
 * - This eliminates a direct reactive subscription to the opencode message store,
 *   which was one of the causes of the "Maximum call stack size exceeded" crash.
 */
import { createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { TuiTheme } from "@opencode-ai/plugin/tui"
import type { Message } from "@opencode-ai/sdk/v2"
import type { RGBA } from "@opentui/core"
import { formatTokens } from "../format.js"
import { useThemeColor } from "../theme.js"

export type TokensSegmentProps = {
  theme: TuiTheme
  /** Reactive getter returning current sessionID or undefined on home route */
  sessionID: () => string | undefined
  /**
   * Reactive getter returning current messages array.
   * Provided by Footer — already gated by messageVersion signal.
   * Returns [] when sessionID is undefined (home route).
   */
  messages: () => ReadonlyArray<Message>
}

type TokenTotals = {
  input: number
  output: number
}

/** Sentinel value to indicate "no session / use fallback". */
const NO_SESSION: TokenTotals = { input: -1, output: -1 }

function aggregateTokens(messages: ReadonlyArray<Message>): TokenTotals {
  let input = 0
  let output = 0
  for (const msg of messages) {
    if (msg.role === "assistant") {
      input += msg.tokens.input
      output += msg.tokens.output
    }
  }
  return { input, output }
}

/**
 * `@opentui/solid` SpanProps lacks `fg` in its TypeScript declaration, but
 * the opentui runtime reconciler correctly applies any property it finds
 * (including `fg`) on the underlying TextNodeRenderable instance.
 * We declare the prop extension here to bridge the type gap.
 */
type SpanWithFg = JSX.IntrinsicElements["span"] & { fg?: RGBA }

function TokensInner(props: TokensSegmentProps): JSX.Element {
  const mutedColor = () => useThemeColor(props.theme, "textMuted")()
  const textColor = () => useThemeColor(props.theme, "text")()

  const totals = createMemo<TokenTotals>(() => {
    const sid = props.sessionID()
    if (!sid) return NO_SESSION
    return aggregateTokens(props.messages())
  })

  const inputStr = createMemo(() =>
    totals().input < 0 ? "--" : formatTokens(totals().input)
  )
  const outputStr = createMemo(() =>
    totals().output < 0 ? "--" : formatTokens(totals().output)
  )

  const S = "span" as unknown as (props: SpanWithFg) => JSX.Element

  return (
    <text>
      <S fg={mutedColor()}>↑</S>
      <S fg={textColor()}>{inputStr()}</S>
      <S fg={mutedColor()}> ↓</S>
      <S fg={textColor()}>{outputStr()}</S>
    </text>
  )
}

export function TokensSegment(props: TokensSegmentProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<text>↑-- ↓--</text>}>
      <TokensInner {...props} />
    </ErrorBoundary>
  )
}
