import { defineConfig } from "tsup"
import { solidPlugin } from "esbuild-plugin-solid"

export default defineConfig({
  entry: { tui: "src/tui.tsx" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  dts: false,                   // hand-written dist/tui.d.ts (see design decision)
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@opencode-ai/plugin", "@opentui/core", "@opentui/solid", "solid-js"],
  esbuildPlugins: [
    solidPlugin({
      solid: {
        generate: "universal",
        moduleName: "@opentui/solid",
      },
    }),
  ],
})
