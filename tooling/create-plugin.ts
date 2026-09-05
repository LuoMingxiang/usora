import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type PluginKind = "generic" | "integration";

function usage(): never {
  throw Error("Usage: bun run plugin:create <kebab-name> [--type generic|integration]");
}

function parseArgs(args: string[]): { name: string; type: PluginKind } {
  const typeIndex = args.indexOf("--type");
  const type = typeIndex === -1 ? "generic" : args[typeIndex + 1];
  const name = args.find((arg, index) => arg !== "--type" && index !== typeIndex + 1);
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) usage();
  if (type !== "generic" && type !== "integration") usage();
  return { name, type };
}

async function writeJson(file: string, value: unknown) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function integrationProviderSource(name: string) {
  return `import { assertProviderContract, type IntegrationProvider } from "@usora/integration";

export function createIntegrationProvider(): IntegrationProvider {
  return assertProviderContract({
    id: "${name}",
    enabled: false,
    capabilities: { messaging: true },
    messaging: {
      sendMessage() {
        return { ok: false, error: "${name} transport is not configured", code: "PROVIDER_NOT_CONFIGURED" };
      },
    },
  });
}
`;
}

const mcpSource = `process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, result: { tools: [] } }) + "\\n");
`;

export async function createPlugin({
  root = process.cwd(),
  name,
  type = "generic",
}: {
  root?: string;
  name: string;
  type?: PluginKind;
}) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) usage();
  const pluginRoot = path.join(root, "plugins", name);
  if (await stat(pluginRoot).catch(() => null)) throw Error(`Plugin already exists: ${name}`);
  await mkdir(path.join(pluginRoot, "src", "cli"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills"), { recursive: true });
  await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
  await mkdir(path.join(pluginRoot, "assets"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".codex-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".codebuddy-plugin"), { recursive: true });

  await writeJson(path.join(pluginRoot, "plugin.json"), {
    schemaVersion: 1,
    name,
    displayName: name,
    version: "0.1.0",
    description: `${name} plugin`,
    runtime: { node: ">=20" },
    entrypoints: { mcp: "dist/mcp.js" },
    skills: [],
    ...(type === "integration" ? { keywords: ["integration", name] } : {}),
  });
  await writeFile(path.join(pluginRoot, "src", "cli", "mcp.ts"), mcpSource);
  if (type === "integration") {
    await writeFile(path.join(pluginRoot, "src", "provider.ts"), integrationProviderSource(name));
    await writeFile(path.join(pluginRoot, "src", "index.ts"), 'export * from "./provider.ts";\n');
  }
  await writeJson(path.join(pluginRoot, ".mcp.json"), { [name]: { command: "node", args: ["dist/mcp.js"], cwd: "." } });
  await writeJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), {
    name,
    version: "0.1.0",
    description: `${name} plugin`,
    skills: "./skills/",
    mcpServers: "./.mcp.json",
  });
  await writeJson(path.join(pluginRoot, ".codebuddy-plugin", "plugin.json"), {
    name,
    version: "0.1.0",
    description: `${name} plugin`,
    skills: [],
    mcpServers: "./.codebuddy-plugin/mcp.json",
  });
  await writeJson(path.join(pluginRoot, ".codebuddy-plugin", "mcp.json"), {
    mcpServers: { [name]: { command: "node", args: ["${CODEBUDDY_PLUGIN_ROOT}/dist/mcp.js"] } },
  });
  await writeJson(path.join(pluginRoot, "hooks", "codex-hooks.json"), { hooks: {} });
  await writeJson(path.join(pluginRoot, "hooks", "codebuddy-hooks.json"), { hooks: {} });
  await writeJson(path.join(pluginRoot, "package.json"), {
    name: `@usora/${name}`,
    version: "0.1.0",
    type: "module",
    private: true,
    ...(type === "integration" ? { dependencies: { "@usora/integration": "workspace:*" } } : {}),
  });
  await writeJson(path.join(pluginRoot, "tsconfig.json"), {
    extends: "../../tsconfig.base.json",
    include: ["src/**/*.ts"],
  });
}

if (import.meta.main) {
  const { name, type } = parseArgs(process.argv.slice(2));
  await createPlugin({ name, type });
  console.log(`created plugins/${name}`);
}
