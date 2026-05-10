import { createComponent, createElement, insert, insertNode, createTextNode, memo, effect, setProp } from '@opentui/solid';
import { createSignal, untrack, createMemo, ErrorBoundary } from 'solid-js';
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

// src/theme.ts
var useThemeColor = (theme, key) => () => theme.current[key];
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
function stateColor(state, theme) {
  if (state.error && state.error !== "not-a-repo") {
    return useThemeColor(theme, "error")();
  }
  if (state.dirty || state.ahead > 0 || state.behind > 0) {
    return useThemeColor(theme, "warning")();
  }
  return useThemeColor(theme, "success")();
}
function BranchInner(props) {
  const text = createMemo(() => buildBranchText(props.gitStatus(), props.vcsBranch()));
  const color = createMemo(() => stateColor(props.gitStatus(), props.theme));
  return (() => {
    var _el$ = createElement("text");
    insert(_el$, text);
    effect((_$p) => setProp(_el$, "fg", color(), _$p));
    return _el$;
  })();
}
function BranchSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`--`));
        return _el$2;
      })();
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
function ModelInner(props) {
  const label = createMemo(() => {
    props.configVersion();
    return formatModel(props.getModel());
  });
  return (() => {
    var _el$ = createElement("text");
    insert(_el$, label);
    return _el$;
  })();
}
function ModelSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`--`));
        return _el$2;
      })();
    },
    get children() {
      return createComponent(ModelInner, props);
    }
  });
}
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
  const mutedColor = () => useThemeColor(props.theme, "textMuted")();
  const textColor = () => useThemeColor(props.theme, "text")();
  const totals = createMemo(() => {
    const sid = props.sessionID();
    if (!sid) return NO_SESSION;
    return aggregateTokens(props.messages());
  });
  const inputStr = createMemo(() => totals().input < 0 ? "--" : formatTokens(totals().input));
  const outputStr = createMemo(() => totals().output < 0 ? "--" : formatTokens(totals().output));
  const S2 = "span";
  return (() => {
    var _el$ = createElement("text");
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
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`\u2191-- \u2193--`));
        return _el$2;
      })();
    },
    get children() {
      return createComponent(TokensInner, props);
    }
  });
}
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
    const total = aggregateCost(props.messages());
    return formatCost(total);
  });
  return (() => {
    var _el$ = createElement("text");
    insert(_el$, costText);
    return _el$;
  })();
}
function CostSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`$--`));
        return _el$2;
      })();
    },
    get children() {
      return createComponent(CostInner, props);
    }
  });
}
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
  const firstMs = createMemo(() => {
    const sid = props.sessionID();
    if (!sid) return void 0;
    return getFirstMessageMs(props.messages());
  });
  const elapsedText = createMemo(() => {
    if (firstMs() === void 0) return "--m --s";
    const elapsed = props.nowMs() - firstMs();
    return formatDuration(elapsed);
  });
  return (() => {
    var _el$ = createElement("text");
    insert(_el$, elapsedText);
    return _el$;
  })();
}
function ElapsedSegment(props) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`--m --s`));
        return _el$2;
      })();
    },
    get children() {
      return createComponent(ElapsedInner, props);
    }
  });
}

// src/tui.tsx
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
  const separatorColor = () => useThemeColor(props.theme, "borderSubtle")();
  const sessionID = () => props.sessionID;
  const messages = createMemo(() => {
    props.messageVersion();
    const sid = sessionID();
    if (!sid) return [];
    return untrack(() => props.api.state.session.messages(sid));
  });
  const branchText = createMemo(() => {
    props.configVersion();
    const vcsBranch = untrack(() => props.api.state.vcs?.branch);
    return buildBranchText2(props.gitStatus(), vcsBranch);
  });
  const modelText = createMemo(() => {
    props.configVersion();
    return untrack(() => formatModel(props.api.state.config.model));
  });
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
  const termWidth = () => untrack(() => props.api.renderer.width ?? 120);
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
  const SEPARATOR = " \u2502 ";
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (() => {
        var _el$2 = createElement("text");
        insertNode(_el$2, createTextNode(`git-statusline error`));
        return _el$2;
      })();
    },
    get children() {
      var _el$ = createElement("text");
      insert(_el$, createComponent(ErrorBoundary, {
        get fallback() {
          return (() => {
            var _el$4 = createElement("span");
            insertNode(_el$4, createTextNode(`--`));
            return _el$4;
          })();
        },
        get children() {
          return createComponent(BranchSegment, {
            get theme() {
              return props.theme;
            },
            get gitStatus() {
              return props.gitStatus;
            },
            vcsBranch: () => untrack(() => props.api.state.vcs?.branch)
          });
        }
      }), null);
      insert(_el$, (() => {
        var _c$ = memo(() => !!survivingIds().has("model"));
        return () => _c$() && [createComponent(S, {
          get fg() {
            return separatorColor();
          },
          children: SEPARATOR
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return (() => {
              var _el$6 = createElement("span");
              insertNode(_el$6, createTextNode(`--`));
              return _el$6;
            })();
          },
          get children() {
            return createComponent(ModelSegment, {
              get configVersion() {
                return props.configVersion;
              },
              getModel: () => untrack(() => props.api.state.config.model)
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
          children: SEPARATOR
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return (() => {
              var _el$8 = createElement("span");
              insertNode(_el$8, createTextNode(`\u2191-- \u2193--`));
              return _el$8;
            })();
          },
          get children() {
            return createComponent(TokensSegment, {
              get theme() {
                return props.theme;
              },
              messages,
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
          children: SEPARATOR
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return (() => {
              var _el$0 = createElement("span");
              insertNode(_el$0, createTextNode(`$--`));
              return _el$0;
            })();
          },
          get children() {
            return createComponent(CostSegment, {
              messages,
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
          children: SEPARATOR
        }), createComponent(ErrorBoundary, {
          get fallback() {
            return (() => {
              var _el$10 = createElement("span");
              insertNode(_el$10, createTextNode(`--m --s`));
              return _el$10;
            })();
          },
          get children() {
            return createComponent(ElapsedSegment, {
              messages,
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
  const [messageVersion, setMessageVersion] = createSignal(0);
  const [configVersion, setConfigVersion] = createSignal(0);
  let lastGitRunMs = 0;
  const runGit = async () => {
    const cwd = untrack(() => api.state.path.worktree);
    if (!cwd) return;
    lastGitRunMs = Date.now();
    setGitStatus(await readGitState(cwd));
    setConfigVersion((v) => v + 1);
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
  let messageDebounce = null;
  const offMessageUpdated = api.event.on("message.updated", () => {
    if (messageDebounce) clearTimeout(messageDebounce);
    messageDebounce = setTimeout(() => {
      messageDebounce = null;
      setMessageVersion((v) => v + 1);
    }, 150);
  });
  let configDebounce = null;
  const offSessionUpdated = api.event.on("session.updated", () => {
    if (configDebounce) clearTimeout(configDebounce);
    configDebounce = setTimeout(() => {
      configDebounce = null;
      setConfigVersion((v) => v + 1);
    }, 150);
  });
  api.lifecycle.onDispose(() => {
    clearInterval(gitTick);
    clearInterval(elapsedTick);
    if (messageDebounce) clearTimeout(messageDebounce);
    if (configDebounce) clearTimeout(configDebounce);
    offWatcher();
    offMessageUpdated();
    offSessionUpdated();
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
      home_bottom: (ctx) => createComponent(Footer, {
        api,
        get theme() {
          return ctx.theme;
        },
        gitStatus,
        nowMs,
        sessionID: void 0,
        messageVersion,
        configVersion
      }),
      sidebar_footer: (ctx, props) => createComponent(Footer, {
        api,
        get theme() {
          return ctx.theme;
        },
        gitStatus,
        nowMs,
        get sessionID() {
          return props.session_id;
        },
        messageVersion,
        configVersion
      })
    }
  });
};
var tui_default = {
  id: "git-statusline",
  tui
};

export { tui_default as default };
