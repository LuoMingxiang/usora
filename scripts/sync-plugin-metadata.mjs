import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const repoUrl = "https://github.com/LuoMingxiang/usora.git";

async function readJson(file) {
  return JSON.parse(await readFile(path.join(root, file), "utf8"));
}

async function writeJson(file, value) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

function marketplaceEntry(manifest, source) {
  return {
    name: manifest.name,
    source,
    description: "Turn AI work practice into a local-first reusable Skill Hub.",
    version: manifest.version,
    author: { name: manifest.author.name },
    license: manifest.license,
    keywords: manifest.keywords,
    category: manifest.category,
  };
}

const manifest = await readJson("plugin.json");
const template = await readJson("common/marketplace.json");
const pkg = await readJson("package.json");

pkg.version = manifest.version;
await writeJson("package.json", pkg);

await writeJson(".codex-plugin/plugin.json", {
  name: manifest.name,
  version: manifest.version,
  description: "A personal AI capability hub that turns real work into reusable, continuously improving skills.",
  author: { name: manifest.author.name },
  homepage: manifest.homepage,
  repository: manifest.repository,
  skills: "./skills/",
  mcpServers: "./.mcp.json",
  hooks: "./hooks/codex-hooks.json",
  interface: manifest.interface,
});

await writeJson(".codebuddy-plugin/plugin.json", {
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

const codebuddyMarketplace = {
  ...template,
  metadata: {
    description: manifest.description,
    version: manifest.version,
  },
  plugins: [marketplaceEntry(manifest, ".")],
};
await writeJson(".codebuddy-plugin/marketplace.json", codebuddyMarketplace);

const codexMarketplace = {
  name: manifest.name,
  interface: {
    displayName: manifest.interface.displayName,
  },
  plugins: [
    {
      name: manifest.name,
      source: {
        source: "url",
        url: repoUrl,
        ref: "master",
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: manifest.category,
    },
  ],
};
await writeJson("marketplace.json", codexMarketplace);
await writeJson(".agents/plugins/marketplace.json", codexMarketplace);

console.log(`Synced Usora plugin metadata ${manifest.version}`);
