const LIMITS = {
  task: 200,
  result: 300,
  keyPoint: 160,
  keyPoints: 5,
  technologies: 10,
};

function compact(value, limit) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function buildActivityDigest(activity) {
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
    technologies: (activity.technologies || []).slice(0, LIMITS.technologies),
    key_points: (activity.key_points || []).slice(0, LIMITS.keyPoints).map((point) => compact(point, LIMITS.keyPoint)),
    fingerprint: activity.fingerprint || null,
    fingerprint_version: activity.fingerprint_version || null,
    occurrences: activity.occurrences || 1,
    updated_at: activity.updated_at,
    state: activity.state,
  };
}
