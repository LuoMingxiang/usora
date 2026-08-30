const LIMITS = {
  task: 200,
  result: 300,
  keyPoint: 160,
  keyPoints: 5,
  technologies: 10,
};

type DigestActivity = Record<string, unknown> & {
  id?: unknown;
  project?: unknown;
  source?: unknown;
  type?: unknown;
  metadata?: Record<string, unknown> | undefined;
  high_value?: unknown;
  domain?: unknown;
  topic?: unknown;
  task?: unknown;
  result?: unknown;
  technologies?: unknown;
  key_points?: unknown;
  fingerprint?: unknown;
  fingerprint_version?: unknown;
  occurrences?: unknown;
  updated_at?: unknown;
  state?: unknown;
};

function compact(value: unknown, limit: number): string {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function buildActivityDigest(activity: DigestActivity) {
  const technologies = Array.isArray(activity.technologies) ? activity.technologies : [];
  const keyPoints = Array.isArray(activity.key_points) ? activity.key_points : [];
  return {
    schema_version: 1,
    id: activity.id,
    project: activity.project || null,
    source: activity.source || null,
    type: activity.type || activity.metadata?.type || null,
    high_value: Boolean(activity.high_value || activity.metadata?.high_value),
    domain: activity.domain || activity.metadata?.domain || null,
    topic: activity.topic || activity.metadata?.topic || null,
    task: compact(activity.task, LIMITS.task),
    result: compact(activity.result, LIMITS.result),
    technologies: technologies.slice(0, LIMITS.technologies),
    key_points: keyPoints.slice(0, LIMITS.keyPoints).map((point) => compact(point, LIMITS.keyPoint)),
    fingerprint: activity.fingerprint || null,
    fingerprint_version: activity.fingerprint_version || null,
    occurrences: activity.occurrences || 1,
    updated_at: activity.updated_at,
    state: activity.state,
  };
}
