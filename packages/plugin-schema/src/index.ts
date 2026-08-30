import type { PluginManifest } from "../../types/src/index";

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const pluginName = /^[a-z][a-z0-9-]*$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw Error(`${field} must be a non-empty string`);
}

export function validatePluginManifest(value: unknown): PluginManifest {
  if (!isObject(value)) throw Error("manifest must be an object");

  if (value.schemaVersion !== 1) throw Error("schemaVersion must be 1");
  assertString(value.name, "name");
  if (!pluginName.test(value.name)) throw Error("name must be lowercase kebab-case");
  assertString(value.version, "version");
  if (!semver.test(value.version)) throw Error("version must be semver");
  assertString(value.description, "description");

  if (!isObject(value.runtime)) throw Error("runtime must be an object");
  assertString(value.runtime.node, "runtime.node");

  if (!isObject(value.entrypoints)) throw Error("entrypoints must be an object");
  const entrypoints = value.entrypoints as Record<string, unknown>;
  if (entrypoints.mcp !== undefined) assertString(entrypoints.mcp, "entrypoints.mcp");
  if (entrypoints.sessionHook !== undefined) assertString(entrypoints.sessionHook, "entrypoints.sessionHook");
  for (const [key, entrypoint] of Object.entries(entrypoints)) {
    assertString(entrypoint, `entrypoints.${key}`);
    if (entrypoint.includes("\\") || entrypoint.startsWith("/") || entrypoint.includes("..")) {
      throw Error(`entrypoints.${key} must be a relative path inside the plugin`);
    }
    if (entrypoint.startsWith("src/") || entrypoint.endsWith(".ts")) {
      throw Error(`entrypoints.${key} must reference built JavaScript, not TypeScript source`);
    }
  }

  if (value.skills !== undefined && !stringArray(value.skills)) throw Error("skills must be an array of strings");
  if (value.keywords !== undefined && !stringArray(value.keywords)) throw Error("keywords must be an array of strings");
  return value as PluginManifest;
}
