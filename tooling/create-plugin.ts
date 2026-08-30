import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) throw Error("Usage: bun run plugin:create <kebab-name>");

const root = process.cwd();
const pluginRoot = path.join(root, "plugins", name);
if (await stat(pluginRoot).catch(() => null)) throw Error(`Plugin already exists: ${name}`);
await mkdir(path.join(pluginRoot, "src", "cli"), { recursive: true });
await mkdir(path.join(pluginRoot, "skills"), { recursive: true });
await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
await mkdir(path.join(pluginRoot, "assets"), { recursive: true });
await mkdir(path.join(pluginRoot, ".codex-plugin"), { recursive: true });
await mkdir(path.join(pluginRoot, ".codebuddy-plugin"), { recursive: true });

await writeFile(
  path.join(pluginRoot, "plugin.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      name,
      displayName: name,
      version: "0.1.0",
      description: `${name} plugin`,
      runtime: { node: ">=20" },
      entrypoints: { mcp: "dist/mcp.js" },
      skills: [],
    },
    null,
    2,
  )}\n`,
);
await writeFile(path.join(pluginRoot, "src", "cli", "mcp.ts"), "console.log('plugin scaffold');\n");
await writeFile(
  path.join(pluginRoot, ".mcp.json"),
  `${JSON.stringify({ [name]: { command: "node", args: ["dist/mcp.js"], cwd: "." } }, null, 2)}\n`,
);
await writeFile(
  path.join(pluginRoot, ".codex-plugin", "plugin.json"),
  `${JSON.stringify({ name, version: "0.1.0", description: `${name} plugin`, skills: "./skills/", mcpServers: "./.mcp.json" }, null, 2)}\n`,
);
await writeFile(
  path.join(pluginRoot, ".codebuddy-plugin", "plugin.json"),
  `${JSON.stringify({ name, version: "0.1.0", description: `${name} plugin`, skills: [], mcpServers: "./.codebuddy-plugin/mcp.json" }, null, 2)}\n`,
);
await writeFile(
  path.join(pluginRoot, ".codebuddy-plugin", "mcp.json"),
  `${JSON.stringify({ mcpServers: { [name]: { command: "node", args: [`\${CODEBUDDY_PLUGIN_ROOT}/dist/mcp.js`] } } }, null, 2)}\n`,
);
await writeFile(path.join(pluginRoot, "hooks", "codex-hooks.json"), `${JSON.stringify({ hooks: {} }, null, 2)}\n`);
await writeFile(path.join(pluginRoot, "hooks", "codebuddy-hooks.json"), `${JSON.stringify({ hooks: {} }, null, 2)}\n`);
await writeFile(
  path.join(pluginRoot, "package.json"),
  `${JSON.stringify({ name: `@usora/${name}`, version: "0.1.0", type: "module", private: true }, null, 2)}\n`,
);
await writeFile(
  path.join(pluginRoot, "tsconfig.json"),
  `${JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src/**/*.ts"] }, null, 2)}\n`,
);
console.log(`created plugins/${name}`);
