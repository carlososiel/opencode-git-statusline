/**
 * Plugin entry for opencode-git-statusline.
 * Registers two TUI slots with a reactive statusline showing:
 *   branch | model | tokens | cost | elapsed
 *
 *   home_bottom    — home screen (no active session).
 *                    sessionID is always undefined; tokens/cost/elapsed show "--" placeholders.
 *   sidebar_footer — sidebar in any active session.
 *                    sessionID is provided directly via ctx.session_id from the slot context.
 *
 * Reactive graph:
 *   gitStatus  ← 4s poll + file.watcher.updated debounce
 *   nowMs      ← 1s setInterval
 *   sessionID  ← slot context prop (not derived from api.route.current)
 *
 * All timers cleaned up via api.lifecycle.onDispose.
 * Registers /subagents:toggle-sidebar command via api.command?.register (optional chaining).
 */
import { createSignal, createMemo, ErrorBoundary } from "solid-js"
import type { JSX } from "solid-js"
import type { TuiPlugin, TuiPluginModule, TuiPluginApi, TuiTheme } from "@opencode-ai/plugin/tui"
import type { RGBA } from "@opentui/core"

/**
 * `@opentui/solid` SpanProps lacks `fg` in its TypeScript declaration, but
 * the opentui runtime reconciler correctly applies any property it finds
 * (including `fg`) on the underlying TextNodeRenderable instance.
 * We use a cast to bridge the type gap cleanly.
 */
type SpanWithFg = JSX.IntrinsicElements["span"] & { fg?: RGBA }
const S = "span" as unknown as (props: SpanWithFg) => JSX.Element

import { readGitState, type GitState } from "./git.js"
import { collapseSegments, type SegmentRender } from "./overflow.js"
import { useThemeColor } from "./theme.js"
import { BranchSegment } from "./segments/branch.js"
import { ModelSegment } from "./segments/model.js"
import { TokensSegment } from "./segments/tokens.js"
import { CostSegment } from "./segments/cost.js"
import { ElapsedSegment } from "./segments/elapsed.js"
import { formatModel, formatTokens, formatCost, formatDuration } from "./format.js"
import type { Message } from "@opencode-ai/sdk/v2"

// ─── Footer component types ──────────────────────────────────────────────────

type FooterProps = {
  api: TuiPluginApi
  theme: TuiTheme
  gitStatus: () => GitState
  nowMs: () => number
  /**
   * Session ID passed directly from the slot context.
   * - sidebar_footer: always a non-empty string (ctx.session_id)
   * - home_bottom: undefined (no session)
   * When undefined, tokens/cost/elapsed segments display "--" placeholders.
   * Do NOT fall back to api.route.current — home_bottom must never show
   * session-derived data even if a session is active in another screen.
   */
  sessionID: string | undefined
}

// ─── Segment text builders (for overflow algorithm) ──────────────────────────

function buildBranchText(state: GitState, vcsBranch?: string): string {
  if (state.error === "not-a-repo" || (!state.branch && !vcsBranch)) return "--"
  const branch = state.branch ?? vcsBranch ?? "--"
  let suffix = ""
  if (!state.error) {
    if (state.dirty) suffix += "*"
    if (state.ahead > 0) suffix += `↑${state.ahead}`
    if (state.behind > 0) suffix += `↓${state.behind}`
  }
  return `${branch}${suffix}`
}

function buildTokensText(messages: ReadonlyArray<Message>): string {
  let input = 0, output = 0
  for (const msg of messages) {
    if (msg.role === "assistant") {
      input += msg.tokens.input
      output += msg.tokens.output
    }
  }
  return `↑${formatTokens(input)} ↓${formatTokens(output)}`
}

function buildCostText(messages: ReadonlyArray<Message>): string {
  let total = 0
  for (const msg of messages) {
    if (msg.role === "assistant") total += msg.cost
  }
  return formatCost(total)
}

function buildElapsedText(messages: ReadonlyArray<Message>, nowMs: number): string {
  let earliest: number | undefined
  for (const msg of messages) {
    const t = msg.time.created
    if (earliest === undefined || t < earliest) earliest = t
  }
  if (earliest === undefined) return "--m --s"
  return formatDuration(nowMs - earliest)
}

// ─── Footer composite component ───────────────────────────────────────────────

function Footer(props: FooterProps): JSX.Element {
  const separatorColor = createMemo(() => useThemeColor(props.theme, "borderSubtle")())

  // sessionID is provided directly from the slot context — never derived from route.
  // home_bottom passes undefined; sidebar_footer passes the actual session ID string.
  const sessionID = (): string | undefined => props.sessionID

  const messages = createMemo<ReadonlyArray<Message>>(() => {
    const sid = sessionID()
    if (!sid) return []
    return props.api.state.session.messages(sid)
  })

  // Build segment text strings for the overflow algorithm
  const branchText = createMemo(() =>
    buildBranchText(props.gitStatus(), props.api.state.vcs?.branch)
  )
  const modelText = createMemo(() =>
    formatModel(props.api.state.config.model)
  )
  const tokensText = createMemo(() => {
    const sid = sessionID()
    if (!sid) return "↑-- ↓--"
    return buildTokensText(messages())
  })
  const costText = createMemo(() => {
    const sid = sessionID()
    if (!sid) return "$--"
    return buildCostText(messages())
  })
  const elapsedText = createMemo(() => {
    const sid = sessionID()
    if (!sid) return "--m --s"
    return buildElapsedText(messages(), props.nowMs())
  })

  // Compute which segments survive after overflow collapse
  const termWidth = createMemo(() => props.api.renderer.width ?? 120)

  const segments = createMemo<SegmentRender[]>(() => [
    {
      id: "branch",
      text: branchText(),
      minText: branchText().slice(0, 8) || "--",
      droppable: false,
    },
    {
      id: "model",
      text: modelText(),
      minText: modelText().slice(0, 6) || "--",
      droppable: true,
      priority: 1,
    },
    {
      id: "tokens",
      text: tokensText(),
      minText: tokensText().slice(0, 11) || "↑-- ↓--",
      droppable: true,
      priority: 2,
    },
    {
      id: "cost",
      text: costText(),
      minText: costText().slice(0, 7) || "$--",
      droppable: true,
      priority: 3,
    },
    {
      id: "elapsed",
      text: elapsedText(),
      minText: elapsedText().slice(0, 7) || "--m --s",
      droppable: true,
      priority: 4,
    },
  ])

  // Determine surviving segment IDs after overflow
  const survivingIds = createMemo<Set<string>>(() => {
    const parts = segments()
    const width = termWidth()
    const joined = collapseSegments(parts, width)
    // Re-run the algorithm mentally: collapseSegments returns the final string.
    // We need to know which segments survived to render them with proper colors.
    // Replicate the drop logic to get surviving set.
    const surviving = [...parts]
    const joinedWidth = (segs: SegmentRender[]): number => {
      if (segs.length === 0) return 0
      return segs.reduce((acc, s) => acc + s.text.length, 0) + (segs.length - 1) * 3
    }
    while (joinedWidth(surviving) > width) {
      const droppable = surviving.filter((s) => s.droppable)
      if (droppable.length === 0) break
      const maxPriority = Math.max(...droppable.map((s) => s.priority ?? 0))
      const idx = surviving.findIndex((s) => s.droppable && s.priority === maxPriority)
      if (idx === -1) break
      surviving.splice(idx, 1)
    }
    // Suppress unused variable warning
    void joined
    return new Set(surviving.map((s) => s.id))
  })

  const SEPARATOR = " │ "

  return (
    <ErrorBoundary fallback={<text>git-statusline error</text>}>
      <text>
        <ErrorBoundary fallback={<span>--</span>}>
          <BranchSegment
            theme={props.theme}
            gitStatus={props.gitStatus}
            vcsBranch={props.api.state.vcs?.branch}
          />
        </ErrorBoundary>
        {/* Model */}
        {survivingIds().has("model") && (
          <>
            <S fg={separatorColor()}>{SEPARATOR}</S>
            <ErrorBoundary fallback={<span>--</span>}>
              <ModelSegment api={props.api} />
            </ErrorBoundary>
          </>
        )}
        {/* Tokens */}
        {survivingIds().has("tokens") && (
          <>
            <S fg={separatorColor()}>{SEPARATOR}</S>
            <ErrorBoundary fallback={<span>↑-- ↓--</span>}>
              <TokensSegment
                api={props.api}
                theme={props.theme}
                sessionID={sessionID}
              />
            </ErrorBoundary>
          </>
        )}
        {/* Cost */}
        {survivingIds().has("cost") && (
          <>
            <S fg={separatorColor()}>{SEPARATOR}</S>
            <ErrorBoundary fallback={<span>$--</span>}>
              <CostSegment api={props.api} sessionID={sessionID} />
            </ErrorBoundary>
          </>
        )}
        {/* Elapsed */}
        {survivingIds().has("elapsed") && (
          <>
            <S fg={separatorColor()}>{SEPARATOR}</S>
            <ErrorBoundary fallback={<span>--m --s</span>}>
              <ElapsedSegment
                api={props.api}
                sessionID={sessionID}
                nowMs={props.nowMs}
              />
            </ErrorBoundary>
          </>
        )}
      </text>
    </ErrorBoundary>
  )
}

// ─── Plugin entry ─────────────────────────────────────────────────────────────

const tui: TuiPlugin = async (api, _options, meta) => {
  console.log(`[git-statusline] loaded v${meta.version ?? "?"}`)

  // ── Signals ────────────────────────────────────────────────────────────────
  const [gitStatus, setGitStatus] = createSignal<GitState>({ ahead: 0, behind: 0, dirty: false })
  const [nowMs, setNowMs] = createSignal(Date.now())

  // ── Git polling ────────────────────────────────────────────────────────────
  let lastGitRunMs = 0

  const runGit = async (): Promise<void> => {
    const cwd = api.state.path.worktree
    if (!cwd) return
    lastGitRunMs = Date.now()
    setGitStatus(await readGitState(cwd))
  }

  // Fire an initial poll immediately (fire-and-forget)
  void runGit()

  const gitTick = setInterval(() => { void runGit() }, 4000)
  const elapsedTick = setInterval(() => setNowMs(Date.now()), 1000)

  // Debounced file-watcher handler: skip if last poll was < 1s ago
  const offWatcher = api.event.on("file.watcher.updated", () => {
    if (Date.now() - lastGitRunMs > 1000) {
      void runGit()
    }
  })

  // ── Lifecycle cleanup ──────────────────────────────────────────────────────
  api.lifecycle.onDispose(() => {
    clearInterval(gitTick)
    clearInterval(elapsedTick)
    offWatcher()
  })

  // ── Optional command: toggle subagent sidebar ─────────────────────────────
  // api.command is @deprecated and optional in newer opencode versions.
  // Optional chaining ensures the plugin does not crash on older/newer runtimes
  // that remove this API. The footer slot still works regardless.
  api.command?.register(() => [
    {
      title: "Subagentes: alternar panel lateral",
      value: "subagents:toggle-sidebar",
      category: "Subagents",
      slash: { name: "subagents:toggle-sidebar" },
      onSelect: () => {
        const enabled = api.kv.get<boolean>("subagents.sidebar.enabled", true) !== false
        api.kv.set("subagents.sidebar.enabled", !enabled)
        api.ui.toast({
          variant: "info",
          message: !enabled ? "Panel de subagentes activado." : "Panel de subagentes ocultado.",
        })
      },
    },
  ])

  // ── Slot registration ─────────────────────────────────────────────────────
  //
  // home_bottom    — visible on the home screen (no session yet).
  //                  sessionID is undefined → tokens/cost/elapsed show "--".
  // sidebar_footer — visible at the bottom of the sidebar in any active session.
  //                  ctx.session_id is the string session ID provided by opencode.
  //
  // home_footer is declared in TuiSlotMap but is NOT actually rendered by the
  // current opencode TUI layout (confirmed: no working plugin uses it).
  // Both home_bottom and sidebar_footer are the proven slots (used by
  // opencode-subagent-statusline@0.4.1 and opencode-sdd-engram-manage@1.5.0).
  api.slots.register({
    order: 50,
    slots: {
      home_bottom: (ctx) => (
        <Footer
          api={api}
          theme={ctx.theme}
          gitStatus={gitStatus}
          nowMs={nowMs}
          sessionID={undefined}
        />
      ),
      sidebar_footer: (ctx, props) => (
        <Footer
          api={api}
          theme={ctx.theme}
          gitStatus={gitStatus}
          nowMs={nowMs}
          sessionID={props.session_id}
        />
      ),
    },
  })
}

export default { id: "git-statusline", tui } satisfies TuiPluginModule
