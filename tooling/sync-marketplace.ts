import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { discoverPlugins } from "./discover-plugins";

const root = process.cwd();
const check = process.argv.includes("--check");
const repoUrl = "https://github.com/LuoMingxiang/usora.git";
const releaseBaseUrl = "https://github.com/LuoMingxiang/usora/releases/download";

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(root, file), "utf8")) as Record<string, unknown>;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const target = path.join(root, file);
  if (check) {
    const current = await readFile(target, "utf8").catch(() => "");
    try {
      assert.deepEqual(JSON.parse(current), JSON.parse(JSON.stringify(value)));
    } catch {
      throw Error(`${file} is stale; run bun run marketplace:build`);
    }
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}

const template = await readJson("common/marketplace.json");
const plugins = await discoverPlugins(root);
const slash = (value: string) => value.replaceAll("\\", "/");
const firstPlugin = plugins[0];
const firstDescription = firstPlugin?.manifest.description || template.description;
const firstVersion = firstPlugin?.manifest.version || "0.0.0";

function authorName(author: unknown): string {
  return author && typeof author === "object" && "name" in author && typeof author.name === "string"
    ? author.name
    : "Veyra";
}

function shortDescription(value: unknown, fallback: string): string {
  return value && typeof value === "object" && "shortDescription" in value && typeof value.shortDescription === "string"
    ? value.shortDescription
    : fallback;
}

function releaseArtifact(plugin: (typeof plugins)[number]) {
  const fileName = `usora-${plugin.manifest.name}-${plugin.manifest.version}.zip`;
  const checksumFile = `artifacts/usora-${plugin.manifest.name}-${plugin.manifest.version}.sha256`;
  return readFile(path.join(root, checksumFile), "utf8")
    .then((checksum) => ({
      type: "zip",
      url: `${releaseBaseUrl}/${plugin.manifest.name}-v${plugin.manifest.version}/${fileName}`,
      checksum: `sha256:${checksum.trim().split(/\s+/)[0]}`,
    }))
    .catch(async () => {
      const url = `${releaseBaseUrl}/${plugin.manifest.name}-v${plugin.manifest.version}/${fileName}`;
      const current: Record<string, unknown> = check ? await readJson("marketplace.json").catch(() => ({})) : {};
      const currentPlugin = Array.isArray(current.plugins)
        ? current.plugins.find(
            (entry: unknown) =>
              entry && typeof entry === "object" && "name" in entry && entry.name === plugin.manifest.name,
          )
        : undefined;
      const artifact =
        currentPlugin &&
        typeof currentPlugin === "object" &&
        "artifact" in currentPlugin &&
        currentPlugin.artifact &&
        typeof currentPlugin.artifact === "object"
          ? currentPlugin.artifact
          : {};
      const checksum =
        "url" in artifact && artifact.url === url && "checksum" in artifact && typeof artifact.checksum === "string"
          ? artifact.checksum
          : `sha256:pending-${plugin.manifest.name}-${plugin.manifest.version}`;
      return { type: "zip", url, checksum };
    });
}

const codexMarketplace = {
  name: template.name,
  displayName: template.displayName,
  description: template.description,
  owner: template.owner,
  metadata: template.metadata,
  interface: { displayName: template.displayName },
  plugins: await Promise.all(
    plugins.map(async (plugin) => {
      const artifact = await releaseArtifact(plugin);
      return {
        name: plugin.manifest.name,
        source: {
          source: "git-subdir",
          url: repoUrl,
          ref: "marketplace",
          path: `./${slash(plugin.dir)}`,
        },
        ...(artifact ? { artifact } : {}),
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: plugin.manifest.category,
      };
    }),
  ),
};

for (const plugin of plugins) {
  const manifest = plugin.manifest;
  const pluginDir = slash(plugin.dir);
  await writeJson(path.join(pluginDir, ".codex-plugin/plugin.json"), {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    homepage: manifest.homepage,
    repository: manifest.repository,
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    hooks: "./hooks/codex-hooks.json",
    interface: manifest.interface,
  });
  await writeJson(path.join(pluginDir, ".codebuddy-plugin/plugin.json"), {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    homepage: manifest.homepage,
    repository: manifest.repository,
    license: manifest.license,
    keywords: manifest.keywords,
    category: manifest.category,
    skills: manifest.skills,
    mcpServers: "./.codebuddy-plugin/mcp.json",
    hooks: "./hooks/codebuddy-hooks.json",
  });
  await writeJson(path.join(pluginDir, ".mcp.json"), {
    practice: { command: "node", args: [manifest.entrypoints.mcp], cwd: "." },
  });
  await writeJson(path.join(pluginDir, ".codebuddy-plugin/mcp.json"), {
    mcpServers: {
      practice: { command: "node", args: [`\${CODEBUDDY_PLUGIN_ROOT}/${manifest.entrypoints.mcp}`] },
    },
  });
  if (manifest.entrypoints.sessionHook) {
    await writeJson(path.join(pluginDir, "hooks/codex-hooks.json"), {
      hooks: {
        SessionEnd: [
          {
            hooks: [
              {
                type: "command",
                command: `node "\${CLAUDE_PLUGIN_ROOT}/${manifest.entrypoints.sessionHook}"`,
                timeout: 30,
              },
            ],
          },
        ],
      },
    });
    await writeJson(path.join(pluginDir, "hooks/codebuddy-hooks.json"), {
      hooks: {
        SessionEnd: [
          {
            hooks: [
              {
                type: "command",
                command: `node "\${CODEBUDDY_PLUGIN_ROOT}/${manifest.entrypoints.sessionHook}"`,
                timeout: 30,
              },
            ],
          },
        ],
      },
    });
  }
}

const legacyMarketplacePlugins = plugins.map((plugin) => ({
  name: plugin.manifest.name,
  source: `./${slash(plugin.dir)}`,
  description: shortDescription(plugin.manifest.interface, plugin.manifest.description),
  version: plugin.manifest.version,
  author: { name: authorName(plugin.manifest.author) },
  license: plugin.manifest.license,
  keywords: plugin.manifest.keywords,
  category: plugin.manifest.category,
}));

const distributionMarketplacePlugins = plugins.map((plugin) => ({
  name: plugin.manifest.name,
  source: {
    source: "git-subdir",
    url: repoUrl,
    ref: "marketplace",
    path: `./${slash(plugin.dir)}`,
  },
  description: shortDescription(plugin.manifest.interface, plugin.manifest.description),
  version: plugin.manifest.version,
  author: { name: authorName(plugin.manifest.author) },
  license: plugin.manifest.license,
  keywords: plugin.manifest.keywords,
  category: plugin.manifest.category,
}));

await writeJson(".codebuddy-plugin/marketplace.json", {
  name: template.name,
  displayName: template.displayName,
  owner: template.owner,
  description: template.description,
  metadata: { description: firstDescription, version: firstVersion },
  plugins: distributionMarketplacePlugins,
});
await writeJson(".claude-plugin/marketplace.json", {
  name: template.name,
  displayName: template.displayName,
  owner: template.owner,
  description: template.description,
  metadata: { description: firstDescription, version: firstVersion, pluginRoot: "plugins" },
  plugins: legacyMarketplacePlugins.map((plugin) => ({ ...plugin, source: plugin.source.replace("./plugins/", "./") })),
});
await writeJson("marketplace.json", codexMarketplace);
await writeJson(".agents/plugins/marketplace.json", codexMarketplace);
console.log(check ? "marketplace metadata fresh" : "marketplace metadata synced");
