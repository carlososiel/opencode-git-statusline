# Diagnostic: Why SDD Subagents Don't Appear in the Sidebar

> **TL;DR**: _TODO — fill in after investigation in slice 3._

---

## What Was Investigated

_TODO: File paths examined, package versions observed, snapshot date._

---

## Filtering Behavior

_TODO: Quote the exact filter mechanism (e.g. `agents.filter(a => !a.hidden)`), the trigger event, and cite the file path + approximate line in `~/.cache/opencode/packages/opencode-subagent-statusline@latest/...`._

---

## KV Flags

_TODO: Describe `subagents.sidebar.enabled` (master toggle, default value, read/write locations) and `subagents.sidebar.expanded` (collapsed/expanded state, default value, read/write locations)._

---

## Slot Interaction with `opencode-sdd-engram-manage`

_TODO: Both plugins register `sidebar_content`. Document observed stacking behavior — which one wins, in what order, with evidence from cached source._

---

## Remediation Options

_TODO: At minimum three options, ordered smallest fix → largest, each with: what to change, where (file/KV key), expected outcome, and tradeoff._

---

## Conclusion

_TODO: Single, unambiguous statement of root cause + recommended remediation option. Cite the specific line/identifier in upstream source._
