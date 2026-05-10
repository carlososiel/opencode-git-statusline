import { createComponent, insert, memo, template, effect, setAttribute } from 'solid-js/web';
import { createSignal, createMemo, ErrorBoundary } from 'solid-js';
import { execFile } from 'child_process';
import { promisify } from 'util';

// src/tui.tsx
var execFileP = promisify(execFile);
async function readGitState(cwd) {
  try {
    const { stdout } = await execFileP(
      "git",
      ["status", "--porcelain=2", "--branch"],
      // LANG=C ensures English error messages regardless of system locale,
      // so the "not a git repository" regex match works reliably.
      { cwd, timeout: 2e3, windowsHide: true, env: { ...process.env, LANG: "C", LC_ALL: "C" } }
    );
    return parsePorcelainV2(stdout);
  } catch (err) {
    const e = err;
    if (e.code === "ENOENT") {
      return { ahead: 0, behind: 0, dirty: false, error: "git-not-found" };
    }
    if (typeof e.stderr === "string" && /not a git repository/i.test(e.stderr)) {
      return { ahead: 0, behind: 0, dirty: false, error: "not-a-repo" };
    }
    return { ahead: 0, behind: 0, dirty: false, error: "exec-error" };
  }
}
function parsePorcelainV2(out) {
  let branch;
  let ahead = 0;
  let behind = 0;
  let dirty = false;
  for (const line of out.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim();
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) {
        ahead = parseInt(m[1], 10);
        behind = parseInt(m[2], 10);
      }
    } else if (line.length > 0 && !line.startsWith("#")) {
      dirty = true;
    }
  }
  return { branch, ahead, behind, dirty };
}

// src/overflow.ts
var SEPARATOR = " \u2502 ";
var SEPARATOR_LEN = SEPARATOR.length;
function collapseSegments(parts, width) {
  let surviving = [...parts];
  const joinedWidth = (segs) => {
    if (segs.length === 0) return 0;
    return segs.reduce((acc, s) => acc + s.text.length, 0) + (segs.length - 1) * SEPARATOR_LEN;
  };
  if (joinedWidth(surviving) <= width) {
    return surviving.map((s) => s.text).join(SEPARATOR);
  }
  while (joinedWidth(surviving) > width) {
    const droppable = surviving.filter((s) => s.droppable);
    if (droppable.length === 0) break;
    const maxPriority = Math.max(...droppable.map((s) => s.priority ?? 0));
    const idx = surviving.findIndex((s) => s.droppable && s.priority === maxPriority);
    if (idx === -1) break;
    surviving.splice(idx, 1);
  }
  if (joinedWidth(surviving) > width && surviving.length > 0) {
    surviving = surviving.map((s) => ({
      ...s,
      text: s.minText.length <= width ? s.minText : s.minText.slice(0, Math.max(width, 1))
    }));
  }
  return surviving.map((s) => s.text).join(SEPARATOR);
}

// src/theme.ts
var useThemeColor = (theme, key) => () => theme.current[key];
var _tmpl$ = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$2 = /* @__PURE__ */ template(`<svg><text>--</svg>`, false, true, false);
function buildBranchText(state, vcsBranch) {
  if (state.error === "not-a-repo" || !state.branch && !vcsBranch) {
    return "--";
  }
  const branch = state.branch ?? vcsBranch ?? "--";
  let suffix = "";
  if (!state.error) {
    if (state.dirty) suffix += "*";
    if (state.ahead > 0) suffix += `\u2191${state.ahead}`;
    if (state.behind > 0) suffix += `\u2193${state.behind}`;
  }
  return `${branch}${suffix}`;
}
function stateColorGetter(state, theme) {
  if (state.error && state.error !== "not-a-repo") {
    return useThemeColor(theme, "error");
  }
  if (state.dirty || state.ahead > 0 || state.behind > 0) {
    return useThemeColor(theme, "warning");
  }
  return useThemeColor(theme, "success");
}
function BranchInner(props) {
  const text = createMemo(() => buildBranchText(props.gitStatus(), props.vcsBranch));
  const colorGetter = createMemo(() => stateColorGetter(props.gitStatus(), props.theme));
  return (() => {
    var _el$ = _tmpl$();
    insert(_el$, text);
    effect(() => setAttribute(_el$, "fg", colorGetter()()));
    return _el$;
  })();
}
function BranchSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$2();
    },
    get children() {
      return createComponent(BranchInner, props);
    }
  });
}

// src/format.ts
function formatTokens(n) {
  if (n < 1e3) return String(n);
  if (n < 1e6) return `${(n / 1e3).toFixed(1)}k`;
  return `${(n / 1e6).toFixed(1)}M`;
}
function formatCost(n) {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "--m --s";
  const totalSec = Math.floor(ms / 1e3);
  const h = Math.floor(totalSec / 3600);
  if (h >= 1) {
    const m2 = Math.floor((totalSec - h * 3600) / 60);
    return `${h}h ${String(m2).padStart(2, "0")}m`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
function formatModel(id) {
  if (!id) return "--";
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

// src/segments/model.tsx
var _tmpl$3 = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$22 = /* @__PURE__ */ template(`<svg><text>--</svg>`, false, true, false);
function ModelInner(props) {
  const label = createMemo(() => formatModel(props.api.state.config.model));
  return (() => {
    var _el$ = _tmpl$3();
    insert(_el$, label);
    return _el$;
  })();
}
function ModelSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$22();
    },
    get children() {
      return createComponent(ModelInner, props);
    }
  });
}
var _tmpl$4 = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$23 = /* @__PURE__ */ template(`<svg><text>\u2191-- \u2193--</svg>`, false, true, false);
var NO_SESSION = {
  input: -1,
  output: -1
};
function aggregateTokens(messages) {
  let input = 0;
  let output = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") {
      input += msg.tokens.input;
      output += msg.tokens.output;
    }
  }
  return {
    input,
    output
  };
}
function TokensInner(props) {
  const mutedColor = createMemo(() => useThemeColor(props.theme, "textMuted")());
  const textColor = createMemo(() => useThemeColor(props.theme, "text")());
  const totals = createMemo(() => {
    const sid = props.sessionID();
    if (!sid) return NO_SESSION;
    const messages = props.api.state.session.messages(sid);
    return aggregateTokens(messages);
  });
  const inputStr = createMemo(() => totals().input < 0 ? "--" : formatTokens(totals().input));
  const outputStr = createMemo(() => totals().output < 0 ? "--" : formatTokens(totals().output));
  const S2 = "span";
  return (() => {
    var _el$ = _tmpl$4();
    insert(_el$, createComponent(S2, {
      get fg() {
        return mutedColor();
      },
      children: "\u2191"
    }), null);
    insert(_el$, createComponent(S2, {
      get fg() {
        return textColor();
      },
      get children() {
        return inputStr();
      }
    }), null);
    insert(_el$, createComponent(S2, {
      get fg() {
        return mutedColor();
      },
      children: " \u2193"
    }), null);
    insert(_el$, createComponent(S2, {
      get fg() {
        return textColor();
      },
      get children() {
        return outputStr();
      }
    }), null);
    return _el$;
  })();
}
function TokensSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$23();
    },
    get children() {
      return createComponent(TokensInner, props);
    }
  });
}
var _tmpl$5 = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$24 = /* @__PURE__ */ template(`<svg><text>$--</svg>`, false, true, false);
function aggregateCost(messages) {
  let total = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") {
      total += msg.cost;
    }
  }
  return total;
}
function CostInner(props) {
  const costText = createMemo(() => {
    const sid = props.sessionID();
    if (!sid) return "$--";
    const messages = props.api.state.session.messages(sid);
    const total = aggregateCost(messages);
    return formatCost(total);
  });
  return (() => {
    var _el$ = _tmpl$5();
    insert(_el$, costText);
    return _el$;
  })();
}
function CostSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$24();
    },
    get children() {
      return createComponent(CostInner, props);
    }
  });
}
var _tmpl$6 = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$25 = /* @__PURE__ */ template(`<svg><text>--m --s</svg>`, false, true, false);
function getFirstMessageMs(messages) {
  let earliest;
  for (const msg of messages) {
    const t = msg.time.created;
    if (earliest === void 0 || t < earliest) {
      earliest = t;
    }
  }
  return earliest;
}
function ElapsedInner(props) {
  const elapsedText = createMemo(() => {
    const sid = props.sessionID();
    if (!sid) return "--m --s";
    const messages = props.api.state.session.messages(sid);
    const firstMs = getFirstMessageMs(messages);
    if (firstMs === void 0) return "--m --s";
    const elapsed = props.nowMs() - firstMs;
    return formatDuration(elapsed);
  });
  return (() => {
    var _el$ = _tmpl$6();
    insert(_el$, elapsedText);
    return _el$;
  })();
}
function ElapsedSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$25();
    },
    get children() {
      return createComponent(ElapsedInner, props);
    }
  });
}

// src/tui.tsx
var _tmpl$7 = /* @__PURE__ */ template(`<svg><text></svg>`, false, true, false);
var _tmpl$26 = /* @__PURE__ */ template(`<svg><text>git-statusline error</svg>`, false, true, false);
var _tmpl$32 = /* @__PURE__ */ template(`<span>--`);
var _tmpl$42 = /* @__PURE__ */ template(`<span>\u2191-- \u2193--`);
var _tmpl$52 = /* @__PURE__ */ template(`<span>$--`);
var _tmpl$62 = /* @__PURE__ */ template(`<span>--m --s`);
var S = "span";
function buildBranchText2(state, vcsBranch) {
  if (state.error === "not-a-repo" || !state.branch && !vcsBranch) return "--";
  const branch = state.branch ?? vcsBranch ?? "--";
  let suffix = "";
  if (!state.error) {
    if (state.dirty) suffix += "*";
    if (state.ahead > 0) suffix += `\u2191${state.ahead}`;
    if (state.behind > 0) suffix += `\u2193${state.behind}`;
  }
  return `${branch}${suffix}`;
}
function buildTokensText(messages) {
  let input = 0, output = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") {
      input += msg.tokens.input;
      output += msg.tokens.output;
    }
  }
  return `\u2191${formatTokens(input)} \u2193${formatTokens(output)}`;
}
function buildCostText(messages) {
  let total = 0;
  for (const msg of messages) {
    if (msg.role === "assistant") total += msg.cost;
  }
  return formatCost(total);
}
function buildElapsedText(messages, nowMs) {
  let earliest;
  for (const msg of messages) {
    const t = msg.time.created;
    if (earliest === void 0 || t < earliest) earliest = t;
  }
  if (earliest === void 0) return "--m --s";
  return formatDuration(nowMs - earliest);
}
function Footer(props) {
  const separatorColor = createMemo(() => useThemeColor(props.theme, "borderSubtle")());
  const sessionID = createMemo(() => {
    const route = props.api.route.current;
    return route.name === "session" && typeof route.params?.sessionID === "string" ? route.params.sessionID : void 0;
  });
  const messages = createMemo(() => {
    const sid = sessionID();
    if (!sid) return [];
    return props.api.state.session.messages(sid);
  });
  const branchText = createMemo(() => buildBranchText2(props.gitStatus(), props.api.state.vcs?.branch));
  const modelText = createMemo(() => formatModel(props.api.state.config.model));
  const tokensText = createMemo(() => {
    const sid = sessionID();
    if (!sid) return "\u2191-- \u2193--";
    return buildTokensText(messages());
  });
  const costText = createMemo(() => {
    const sid = sessionID();
    if (!sid) return "$--";
    return buildCostText(messages());
  });
  const elapsedText = createMemo(() => {
    const sid = sessionID();
    if (!sid) return "--m --s";
    return buildElapsedText(messages(), props.nowMs());
  });
  const termWidth = createMemo(() => props.api.renderer.width ?? 120);
  const segments = createMemo(() => [{
    id: "branch",
    text: branchText(),
    minText: branchText().slice(0, 8) || "--",
    droppable: false
  }, {
    id: "model",
    text: modelText(),
    minText: modelText().slice(0, 6) || "--",
    droppable: true,
    priority: 1
  }, {
    id: "tokens",
    text: tokensText(),
    minText: tokensText().slice(0, 11) || "\u2191-- \u2193--",
    droppable: true,
    priority: 2
  }, {
    id: "cost",
    text: costText(),
    minText: costText().slice(0, 7) || "$--",
    droppable: true,
    priority: 3
  }, {
    id: "elapsed",
    text: elapsedText(),
    minText: elapsedText().slice(0, 7) || "--m --s",
    droppable: true,
    priority: 4
  }]);
  const survivingIds = createMemo(() => {
    const parts = segments();
    const width = termWidth();
    collapseSegments(parts, width);
    const surviving = [...parts];
    const joinedWidth = (segs) => {
      if (segs.length === 0) return 0;
      return segs.reduce((acc, s) => acc + s.text.length, 0) + (segs.length - 1) * 3;
    };
    while (joinedWidth(surviving) > width) {
      const droppable = surviving.filter((s) => s.droppable);
      if (droppable.length === 0) break;
      const maxPriority = Math.max(...droppable.map((s) => s.priority ?? 0));
      const idx = surviving.findIndex((s) => s.droppable && s.priority === maxPriority);
      if (idx === -1) break;
      surviving.splice(idx, 1);
    }
    return new Set(surviving.map((s) => s.id));
  });
  const SEPARATOR2 = " \u2502 ";
  return createComponent(ErrorBoundary, {
    get fallback() {
      return _tmpl$26();
    },
    get children() {
      var _el$ = _tmpl$7();
      insert(_el$, createComponent(ErrorBoundary, {
        get fallback() {
          return _tmpl$32();
        },
        get children() {
          return createComponent(BranchSegment, {
            get theme() {
              return props.theme;
            },
            get gitStatus() {
              return props.gitStatus;
            },
            get vcsBranch() {
              return props.api.state.vcs?.branch;
            }
          });
        }
      }), null);
      insert(_el$, (() => {
        var _c$ = memo(() => !!survivingIds().has("model"));
        return () => _c$() && [createComponent(S, {
          get fg() {
            return separatorColor();
          },
          children: SEPARATOR2
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return _tmpl$32();
          },
          get children() {
            return createComponent(ModelSegment, {
              get api() {
                return props.api;
              }
            });
          }
        })];
      })(), null);
      insert(_el$, (() => {
        var _c$2 = memo(() => !!survivingIds().has("tokens"));
        return () => _c$2() && [createComponent(S, {
          get fg() {
            return separatorColor();
          },
          children: SEPARATOR2
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return _tmpl$42();
          },
          get children() {
            return createComponent(TokensSegment, {
              get api() {
                return props.api;
              },
              get theme() {
                return props.theme;
              },
              sessionID
            });
          }
        })];
      })(), null);
      insert(_el$, (() => {
        var _c$3 = memo(() => !!survivingIds().has("cost"));
        return () => _c$3() && [createComponent(S, {
          get fg() {
            return separatorColor();
          },
          children: SEPARATOR2
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return _tmpl$52();
          },
          get children() {
            return createComponent(CostSegment, {
              get api() {
                return props.api;
              },
              sessionID
            });
          }
        })];
      })(), null);
      insert(_el$, (() => {
        var _c$4 = memo(() => !!survivingIds().has("elapsed"));
        return () => _c$4() && [createComponent(S, {
          get fg() {
            return separatorColor();
          },
          children: SEPARATOR2
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return _tmpl$62();
          },
          get children() {
            return createComponent(ElapsedSegment, {
              get api() {
                return props.api;
              },
              sessionID,
              get nowMs() {
                return props.nowMs;
              }
            });
          }
        })];
      })(), null);
      return _el$;
    }
  });
}
var tui = async (api, _options, meta) => {
  console.log(`[git-statusline] loaded v${meta.version ?? "?"}`);
  const [gitStatus, setGitStatus] = createSignal({
    ahead: 0,
    behind: 0,
    dirty: false
  });
  const [nowMs, setNowMs] = createSignal(Date.now());
  let lastGitRunMs = 0;
  const runGit = async () => {
    const cwd = api.state.path.worktree;
    if (!cwd) return;
    lastGitRunMs = Date.now();
    setGitStatus(await readGitState(cwd));
  };
  void runGit();
  const gitTick = setInterval(() => {
    void runGit();
  }, 4e3);
  const elapsedTick = setInterval(() => setNowMs(Date.now()), 1e3);
  const offWatcher = api.event.on("file.watcher.updated", () => {
    if (Date.now() - lastGitRunMs > 1e3) {
      void runGit();
    }
  });
  api.lifecycle.onDispose(() => {
    clearInterval(gitTick);
    clearInterval(elapsedTick);
    offWatcher();
  });
  api.command?.register(() => [{
    title: "Subagentes: alternar panel lateral",
    value: "subagents:toggle-sidebar",
    category: "Subagents",
    slash: {
      name: "subagents:toggle-sidebar"
    },
    onSelect: () => {
      const enabled = api.kv.get("subagents.sidebar.enabled", true) !== false;
      api.kv.set("subagents.sidebar.enabled", !enabled);
      api.ui.toast({
        variant: "info",
        message: !enabled ? "Panel de subagentes activado." : "Panel de subagentes ocultado."
      });
    }
  }]);
  api.slots.register({
    order: 50,
    slots: {
      home_footer: (ctx) => createComponent(Footer, {
        api,
        get theme() {
          return ctx.theme;
        },
        gitStatus,
        nowMs
      })
    }
  });
};
var tui_default = {
  id: "git-statusline",
  tui
};

export { tui_default as default };
