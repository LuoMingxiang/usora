/** Content that can support learning, independent of host/session metadata. */
export function hasActivityContent(activity: Record<string, unknown>): boolean {
  const meaningful = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  return (
    meaningful(activity.task) ||
    meaningful(activity.result) ||
    (Array.isArray(activity.key_points) && activity.key_points.some(meaningful))
  );
}
