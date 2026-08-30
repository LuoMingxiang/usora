import { activityTools } from "./activity.ts";
import { candidateTools } from "./candidate.ts";
import { governanceTools } from "./governance.ts";
import { hubTools } from "./hub.ts";
import { skillTools } from "./skill.ts";

export const allToolDefinitions = [...hubTools, ...activityTools, ...candidateTools, ...skillTools, ...governanceTools];
