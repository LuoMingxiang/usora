export type Diagnostic = {
  code: string;
  message: string;
  file?: string;
};

export type Dependency = {
  kind: "usora_mcp" | "mcp" | "runtime" | "platform" | "external_service" | "credential" | "dynamic_resource";
  name: string;
  required: boolean;
  reason: string;
};

export type BufferedSkillFile = {
  path: string;
  data: Buffer;
  mode?: number;
};

export type SkillSnapshot = {
  name: string;
  files: BufferedSkillFile[];
  source: { skill_id: string; state: string; revision: number };
};

export type ValidationResult = {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  files: { path: string; bytes: number; sha256: string }[];
  dependencies: Dependency[];
  compatibility: {
    agent_skills: boolean;
    independent: boolean;
    notes: string[];
  };
};
