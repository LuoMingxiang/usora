import { readFile, writeFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("plugin.json", "utf8"));

manifest.version = pkg.version;
await writeFile("plugin.json", `${JSON.stringify(manifest, null, 2)}\n`);
await import("./sync-plugin-metadata.mjs");
