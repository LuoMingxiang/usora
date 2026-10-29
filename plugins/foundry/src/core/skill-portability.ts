import { exportSkillSnapshot } from "./portability/export.ts";
import { validateSkillSnapshot } from "./portability/validate.ts";

type PortabilityArgs = Record<string, unknown>;

function validateArgs(args: PortabilityArgs, exporting: boolean): void {
  const allowed = new Set(exporting ? ["skill_id", "format", "output_path", "conflict", "dry_run"] : ["skill_id"]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw Error(`INVALID_ARGUMENT: Unknown portability argument: ${key}`);
  }
  if (typeof args.skill_id !== "string" || !args.skill_id.trim()) {
    throw Error("INVALID_ARGUMENT: skill_id must be a nonempty existing Skill name");
  }
  if (!exporting) return;
  if (args.format !== undefined && args.format !== "directory" && args.format !== "zip") {
    throw Error("INVALID_ARGUMENT: format must be directory or zip");
  }
  if (args.conflict !== undefined && args.conflict !== "error" && args.conflict !== "overwrite") {
    throw Error("INVALID_ARGUMENT: conflict must be error or overwrite");
  }
  if (args.dry_run !== undefined && typeof args.dry_run !== "boolean") {
    throw Error("INVALID_ARGUMENT: dry_run must be a boolean");
  }
  if (typeof args.output_path !== "string" || !args.output_path.trim()) {
    throw Error("INVALID_ARGUMENT: output_path must be an existing absolute export parent directory");
  }
}

/** Validate one published Skill without initializing or mutating its Hub. */
export async function handleSkillValidate(args: PortabilityArgs = {}) {
  validateArgs(args, false);
  const { report } = await validateSkillSnapshot(args.skill_id);
  return report;
}

/** Export a validated published snapshot; never publishes or changes the source Skill. */
export async function handleSkillExport(args: PortabilityArgs = {}) {
  validateArgs(args, true);
  const { report, snapshot } = await validateSkillSnapshot(args.skill_id);
  if (!report.valid || !snapshot) {
    return {
      ...report,
      exported: false,
      dry_run: args.dry_run ?? false,
      format: args.format ?? "directory",
      target: null,
    };
  }
  return exportSkillSnapshot(snapshot, report, args);
}
