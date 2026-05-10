# opencode-git-statusline

A TUI plugin for [opencode](https://opencode.ai) that renders a persistent single-line status bar at the bottom of the screen — showing the current **git branch state**, **active model**, **session token usage**, **cost**, and **elapsed time**. It works on both the home route and any active session route.

> **Status**: Active development via SDD — slice 1 (scaffold + tooling) complete; UI rendering lands in slice 2.

---

## Installation

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

3. Run the package manager in your opencode config directory:
   ```sh
   cd ~/.config/opencode
   npm install
   ```

4. Restart opencode. The statusline will appear in the footer on every route.

---

## Slot Used

This plugin registers the **`home_footer`** slot.

---

## Coexistence Note

`opencode-git-statusline` uses **only** the `home_footer` slot. It does NOT register `sidebar_content` or `home_bottom`, so it coexists cleanly with [`opencode-subagent-statusline`](https://github.com/opencode-ai/opencode-subagent-statusline) (which owns the sidebar) and any other plugin using those slots.

---

## Screenshot

TODO: add screenshot / asciinema recording.

---

## Diagnostics

If the sidebar for SDD subagents is not showing, see the diagnostic document:

[docs/diagnostics/subagent-statusline.md](./docs/diagnostics/subagent-statusline.md)

It explains filtering behavior, KV flags, slot stacking with `opencode-sdd-engram-manage`, and at least three remediation options ordered from smallest to largest fix.

---

## License

MIT © 2026 Carlos Osiel
