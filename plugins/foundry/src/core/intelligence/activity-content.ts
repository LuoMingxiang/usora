/** Content that can support learning, independent of host/session metadata. */
export function hasActivityContent(activity: Record<string, unknown>): boolean {
  const meaningful = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const digest = activity.digest && typeof activity.digest === "object" && !Array.isArray(activity.digest)
    ? activity.digest as Record<string, unknown> : {};
  return (
    meaningful(activity.task) ||
    meaningful(activity.result) ||
    (Array.isArray(activity.key_points) && activity.key_points.some(meaningful)) ||
    meaningful(digest.task) || meaningful(digest.result) || meaningful(digest.topic) ||
    (Array.isArray(digest.key_points) && digest.key_points.some(meaningful))
  );
}
