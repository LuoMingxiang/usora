export type PluginName = string;

export type PluginEntrypoints = {
  mcp?: string;
  sessionHook?: string;
};

export type PluginManifest = {
  schemaVersion: 1;
  name: PluginName;
  version: string;
  description: string;
  runtime: {
    node: string;
  };
  entrypoints: PluginEntrypoints;
  displayName?: string;
  author?: unknown;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  category?: string;
  skills?: string[];
  mcpServers?: string;
  interface?: unknown;
};

export type DiscoveredPlugin = {
  dir: string;
  manifestPath: string;
  manifest: PluginManifest;
};
