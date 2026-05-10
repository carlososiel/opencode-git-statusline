# Diagnostic: Why SDD Subagents Don't Appear in the Sidebar

> **TL;DR**: `opencode-subagent-statusline@0.4.1` does **not** filter agents by a `hidden` property. It builds its own state machine from opencode events (`session.created`, `session.updated`, `session.idle`, `session.error`, `message.part.updated`, `message.updated`). If SDD subagents are not appearing, the most likely causes are: **(A)** the entire subagent section is disabled via the `subagents.sidebar.enabled` KV key, or **(B)** the subagent sessions are simply not generating the expected events at the time the sidebar is observed. See [Remediation Options](#remediation-options) for ordered fixes.

---

## What Was Investigated

| File | Version | Path |
|------|---------|------|
| `opencode-subagent-statusline` | **0.4.1** | `~/.cache/opencode/packages/opencode-subagent-statusline@latest/node_modules/opencode-subagent-statusline/dist/tui.js` |
| `opencode-sdd-engram-manage` | **1.5.0** | `~/.cache/opencode/packages/opencode-sdd-engram-manage@latest/node_modules/opencode-sdd-engram-manage/dist/tui.js` |

Investigation date: **2026-05-09**. Both package versions come from `@latest` resolution at that date — pin these if upgrading.

---

## Filtering Behavior

**Finding: No `hidden` filter exists in `opencode-subagent-statusline@0.4.1`.** The design hypothesis that "SDD agents are filtered by `hidden: true`" was **not confirmed** by the source code. No `.hidden`, `agent.hidden`, `.mode`, or agent-config property is read anywhere in the plugin.

Instead, the plugin tracks subagents through a pure event-sourcing model. It subscribes to these six opencode events at lines 1826 of `dist/tui.js`:

```js
// dist/tui.js line 1826
const disposers = [
  api.event.on("session.created",       applyEvent),
  api.event.on("session.updated",       applyEvent),
  api.event.on("session.idle",          applyEvent),
  api.event.on("session.error",         applyEvent),
  api.event.on("message.updated",       applyEvent),
  api.event.on("message.part.updated",  applyEvent),
];
```

Each event is passed to `applySubagentEvent(state, event)` (line 509). A child (subagent) is created in state when a `session.created` or `session.updated` event contains a non-null `info.parentID` field (`extractCreatedChild`, line 241). Tool-based subagents (delegate/task tool calls) are captured via `message.part.updated` events when `part.type === "tool"` and `part.tool === "delegate" || part.tool === "task"` (line 380).

```js
// dist/tui.js line 380 — extractToolChild
if (tool !== "delegate" && tool !== "task") return null;
```

**There is no `hidden` property filter.** If SDD agent sessions fire the correct events with a `parentID`, they will appear in the sidebar.

The display filters that DO exist:
- `collapseToolWrappers` (line 1035): hides a generic "delegate"/"task" tool entry when a real session-based child exists for the same parent+message — this prevents duplicate rows, not hidden agents.
- `visibleChildren` (line 1159): shows children for the current session first; if none, shows "other sessions" children.

---

## KV Flags

Two KV keys control sidebar visibility:

| Key | Default | Role | Read/write location |
|-----|---------|------|---------------------|
| `subagents.sidebar.enabled` | `true` | Master toggle — hides/shows the entire subagent sidebar section | Line 1662/1674–1680 of `dist/tui.js` |
| `subagents.sidebar.expanded` | `true` | Collapsed/expanded state of the subagent list within the section | Line 1661/1666–1672 of `dist/tui.js` |

Source:

```js
// dist/tui.js lines 1661–1662
const [subagentsExpanded, setSubagentsExpanded] =
  createSignal(api.kv.get(SUBAGENTS_EXPANDED_KV_KEY, true) !== false);
const [subagentsSectionEnabled, setSubagentsSectionEnabled] =
  createSignal(api.kv.get(SUBAGENTS_SECTION_ENABLED_KV_KEY, true) !== false);
```

Where:
```js
// dist/tui.js lines 734–735
var SUBAGENTS_EXPANDED_KV_KEY     = "subagents.sidebar.expanded";
var SUBAGENTS_SECTION_ENABLED_KV_KEY = "subagents.sidebar.enabled";
```

The sidebar section renders wrapped in a `<Show when={subagentsSectionEnabled()}>` (line 1852–1870). If `subagentsSectionEnabled()` is `false`, nothing renders regardless of children state.

The upstream plugin also registers its own toggle command (line 1682–1688):

```js
// dist/tui.js line 1682
const commandDispose = api.command.register(() => [{
  title: subagentsSectionEnabled()
    ? "Subagents: Disable sidebar section"
    : "Subagents: Enable sidebar section",
  value: "subagent-statusline.toggle-sidebar-section",
  category: "Subagents",
  onSelect: () => setSubagentsSectionEnabledPreference(!subagentsSectionEnabled()),
}]);
```

This is different from the `/subagents:toggle-sidebar` command shipped in `opencode-git-statusline` — both flip the same KV key via the same underlying mechanism.

---

## Slot Interaction with `opencode-sdd-engram-manage`

Both plugins register the `sidebar_content` slot. Observed registration calls:

**`opencode-subagent-statusline@0.4.1`** — `dist/tui.js` lines 1839–1881:
```js
api.slots.register({
  order: 90,       // explicit order
  slots: {
    sidebar_content(ctx) { /* SidebarSubagents component */ },
    home_bottom(ctx)     { /* HomeBottomStatus component */ },
  }
});
```

**`opencode-sdd-engram-manage@1.5.0`** — `dist/tui.js` lines 2665–2695:
```js
api.slots.register({
  // no order field
  slots: {
    home_bottom(ctx)     { /* ActiveModelBadge component */ },
    sidebar_content(ctx) { /* ActiveModelBadge (model info) */ },
  }
});
```

**Observed behavior**: Both plugins contribute to `sidebar_content`. The opencode slot system accumulates content from all registered plugins — it is a multi-producer pattern, not "last writer wins." The `order: 90` in `opencode-subagent-statusline` determines its rendering order relative to other plugins; `opencode-sdd-engram-manage` has no explicit order (defaults to runtime insertion order). In practice, the engram-manage model badge and the subagent-statusline list should both appear in the sidebar, stacked vertically.

**Implication**: A `sidebar_content` slot collision is unlikely to cause the subagent list to disappear. If the subagent list is missing, the issue is more likely the KV master toggle or missing events.

---

## Remediation Options

Ordered from smallest fix to largest:

### Option A — Flip `subagents.sidebar.enabled` (smallest)

**What**: Toggle the master KV key back to `true`.

**Where**: Run `/subagents:toggle-sidebar` in the opencode TUI (command registered by `opencode-git-statusline`, this plugin) or run the upstream command `/subagents.toggle-sidebar-section` already present in `opencode-subagent-statusline`.

**Expected outcome**: The sidebar section reappears immediately on next render, no restart needed.

**Tradeoff**: None — this is the reversible, zero-config fix. If the key was already `true`, this is not the root cause; move to Option B.

**Verification**: After toggling, check the KV value by toggling twice (the toast messages confirm the flip direction).

---

### Option B — Verify SDD session events fire with `parentID`

**What**: Confirm that SDD subagent sessions are emitting `session.created` events with a non-null `parentID` that matches the current parent session.

**Where**: Set `OPENCODE_SUBAGENT_STATUSLINE_DEBUG_EVENTS=1` in your environment (or check `~/.local/share/opencode/log/`) and inspect whether `session.created` events appear with `info.parentID` populated when SDD agents run.

**Expected outcome**: If events are firing correctly, the sidebar will populate. If `parentID` is missing, the event-sourcing model will not create a child entry.

**Tradeoff**: Requires restarting opencode with the env var set. Produces a debug log at `$XDG_RUNTIME_DIR/opencode-subagent-statusline/tui-events.log`.

---

### Option C — Wait for hydration retry

**What**: `opencode-subagent-statusline` includes a hydration retry mechanism (up to 6 attempts with exponential backoff, lines 1722–1792) that reads historical sessions via `api.client.session.children()` on route mount.

**Where**: Navigate away from the session and back — this triggers a fresh hydration attempt.

**Expected outcome**: If subagent sessions exist in the database but the live events were missed, hydration should backfill them.

**Tradeoff**: Hydration reads from `~/.local/share/opencode/opencode.db` via sqlite3 (line 815). If `sqlite3` CLI is not installed, token hydration silently fails (the session list still appears, just without token counts). Session list itself comes from `api.client.session.children()`.

---

### Option D — Patch upstream to surface hidden agents (largest)

**What**: If a future version of opencode marks SDD agents as `hidden: true` in session metadata and the plugin is updated to filter on that, contribute an upstream option to surface hidden sessions.

**Where**: `opencode-subagent-statusline` source at `extractCreatedChild` (line 241) — add an opt-in `showHidden` config flag.

**Expected outcome**: Full visibility of sessions regardless of `hidden` flag.

**Tradeoff**: Requires upstream contribution and publishing a new package version. High effort. As of v0.4.1, there is NO `hidden` filter in the plugin — so this option is only relevant if a future version adds one.

---

### Option E — Document as expected behavior

**What**: If SDD subagent sessions are by design scoped and not expected to appear in the generic subagent list, document this as expected behavior and remove the diagnostic link from the README.

**Where**: Update `README.md` and this document.

**Tradeoff**: Loses the visibility benefit of the sidebar. Only appropriate if the SDD workflow intentionally uses isolated sessions.

---

## Conclusion

Based on direct source inspection of `opencode-subagent-statusline@0.4.1`:

1. **No `hidden` property filter exists** in the plugin. The design hypothesis was not confirmed. Recommendation: do NOT set `hidden: false` on SDD agents as a workaround — there is nothing to work around in this dimension.

2. **The most actionable first check** is whether `subagents.sidebar.enabled` is set to `false`. Use `/subagents:toggle-sidebar` (shipped in `opencode-git-statusline`) or the upstream command `subagent-statusline.toggle-sidebar-section` to flip it. This is **Option A** — zero config, instant effect.

3. **If the key is already `true`**, the issue is that SDD subagent sessions are not generating `session.created` events with a valid `parentID`. Enable debug logging (`OPENCODE_SUBAGENT_STATUSLINE_DEBUG_EVENTS=1`) to confirm — that is **Option B**.

4. The `sidebar_content` slot is **multi-producer** — both `opencode-subagent-statusline` and `opencode-sdd-engram-manage` contribute content. They do not collide; they stack. Slot collision is NOT the cause of missing subagents.

**Recommended action**: Start with Option A (toggle KV). If the list still does not appear, proceed to Option B (debug events).
