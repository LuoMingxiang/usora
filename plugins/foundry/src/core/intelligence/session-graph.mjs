export function buildSessionGraph(events, semanticEvents) {
  const byType = (type) => semanticEvents.filter((event) => event.type === type);
  return {
    task: events.find((event) => event.role === "user")?.id || null,
    constraints: byType("constraint").map((event) => event.source_event_id),
    corrections: byType("correction").map((event) => event.source_event_id),
    attempts: byType("attempt").map((event) => event.source_event_id),
    failures: byType("failure").map((event) => event.source_event_id),
    decisions: byType("decision").map((event) => event.source_event_id),
    verifications: byType("verification").map((event) => event.source_event_id),
  };
}
