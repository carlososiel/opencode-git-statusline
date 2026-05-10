# opencode-git-statusline

A TUI plugin for [opencode](https://opencode.ai) that renders a persistent single-line status bar at the bottom of every screen — showing the current **git branch state**, **active model**, **session token usage**, **cost**, and **elapsed time**.

> TODO: add screenshot / asciinema recording.

---

## Install

1. Add the dependency to `~/.config/opencode/package.json`:
   ```json
   {
     "dependencies": {
       "opencode-git-statusline": "file:../../Code/opencode-git-statusline"
     }
   }
   ```

2. Register the plugin in `~/.config/opencode/tui.json`:
   ```json
   {
     "plugin": ["opencode-git-statusline"]
   }
   ```

3. Install dependencies:
   ```sh
   cd ~/.config/opencode
   npm install
   ```

4. Restart opencode. The statusline appears on the home screen and in the sidebar footer of every active session.

---

## What's Shown

A single line, five segments separated by `│`:

```
main*↑2↓1 │ claude-sonnet-4-6 │ ↑12.3k ↓4.5k │ $0.04 │ 12m 34s
```

| Segment | Description |
|---------|-------------|
| `main*↑2↓1` | Git branch name + dirty indicator (`*`) + ahead/behind upstream counts |
| `claude-sonnet-4-6` | Active model (provider prefix stripped) |
| `↑12.3k ↓4.5k` | Input and output tokens for the current session (smart units: `k`, `M`) |
| `$0.04` | Cumulative session cost (4 decimals below $0.01, 2 decimals above) |
| `12m 34s` | Wall-clock time since the first message (`Nh MMm` format over 1 hour) |

On the home route (no active session), tokens, cost, and elapsed show `↑-- ↓--`, `$--`, and `--m --s` respectively.

On narrow terminals, segments collapse right-to-left: elapsed drops first, then cost, then tokens, then model. The branch segment is never dropped.

---

## Slots

`opencode-git-statusline` registers two TUI slots:

| Slot | Where it renders | Session data |
|------|-----------------|--------------|
| `home_bottom` | Home screen (no active session) | branch + model only; tokens/cost/elapsed show `--` |
| `sidebar_footer` | Bottom of the sidebar in any active session | All five segments with live session data |

> **Why not `home_footer`?** That slot is declared in the opencode type definitions but is not actually rendered by the current TUI layout. Confirmed by inspecting `opencode-subagent-statusline@0.4.1` and `opencode-sdd-engram-manage@1.5.0` — both use `home_bottom` + `sidebar_content` (or `sidebar_footer`). Registering `home_footer` results in silent load with no visible output.

## Coexistence

`opencode-git-statusline` does not touch `sidebar_content`, so it coexists cleanly with `opencode-subagent-statusline` (sidebar subagent list) and `opencode-sdd-engram-manage` (model badge). Zero slot collision.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/subagents:toggle-sidebar` | Flips the `subagents.sidebar.enabled` KV key and shows a toast confirming the new state. Registered by this plugin via `api.command?.register`. Requires opencode with `api.command` support (v1 API). |

---

## Diagnostics

If SDD subagents are not appearing in the sidebar, read:

[docs/diagnostics/subagent-statusline.md](./docs/diagnostics/subagent-statusline.md)

It covers: filtering behavior in `opencode-subagent-statusline@0.4.1`, the two KV flags (`subagents.sidebar.enabled` / `subagents.sidebar.expanded`), slot stacking with `opencode-sdd-engram-manage`, and five remediation options ordered from smallest fix to largest.

---

## Development

```sh
# Watch mode — rebuilds on src change
npm run dev

# One-off build (produces dist/tui.js)
npm run build

# TypeScript type check (no emit)
npm run typecheck
```

After `npm run build`, restore the hand-written type stub if it was wiped by tsup's `clean: true`:
```sh
# dist/tui.d.ts is committed manually — tsup clean erases it.
# Run this after every build if dist/tui.d.ts disappears:
git checkout -- dist/tui.d.ts
```

---

## License

MIT © 2026 Carlos Osiel
