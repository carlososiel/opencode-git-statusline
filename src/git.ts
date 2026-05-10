/**
 * Git status reader for the git-statusline TUI plugin.
 * Uses `git status --porcelain=2 --branch` (porcelain format v2) for reliable parsing.
 * NEVER throws — all errors are returned as a typed `error` field on GitState.
 */
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileP = promisify(execFile)

export type GitState = {
  branch?: string
  ahead: number
  behind: number
  dirty: boolean
  error?: "not-a-repo" | "git-not-found" | "exec-error"
}

/**
 * Read the git state of the given working directory asynchronously.
 * Runs with a 2s timeout. Never throws — errors are returned in the `error` field.
 *
 * @param cwd - The directory to run `git status` in (should be repo root / worktree path)
 * @returns Resolved GitState with branch, ahead, behind, dirty, and optional error code
 */
export async function readGitState(cwd: string): Promise<GitState> {
  try {
    const { stdout } = await execFileP(
      "git",
      ["status", "--porcelain=2", "--branch"],
      // LANG=C ensures English error messages regardless of system locale,
      // so the "not a git repository" regex match works reliably.
      { cwd, timeout: 2000, windowsHide: true, env: { ...process.env, LANG: "C", LC_ALL: "C" } },
    )
    return parsePorcelainV2(stdout)
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stderr?: string }
    if (e.code === "ENOENT") {
      return { ahead: 0, behind: 0, dirty: false, error: "git-not-found" }
    }
    if (typeof e.stderr === "string" && /not a git repository/i.test(e.stderr)) {
      return { ahead: 0, behind: 0, dirty: false, error: "not-a-repo" }
    }
    return { ahead: 0, behind: 0, dirty: false, error: "exec-error" }
  }
}

/**
 * Parse `git status --porcelain=2 --branch` stdout into a GitState.
 * Lines starting with `#` are header lines; others indicate file changes (dirty).
 */
function parsePorcelainV2(out: string): GitState {
  let branch: string | undefined
  let ahead = 0
  let behind = 0
  let dirty = false

  for (const line of out.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim()
      // "(detached)" is a special value git uses; keep it as-is for display
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) {
        ahead = parseInt(m[1]!, 10)
        behind = parseInt(m[2]!, 10)
      }
    } else if (line.length > 0 && !line.startsWith("#")) {
      // Any non-header, non-empty line indicates a tracked/untracked change
      dirty = true
    }
  }

  return { branch, ahead, behind, dirty }
}
