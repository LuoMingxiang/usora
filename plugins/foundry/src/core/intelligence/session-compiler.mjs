import { detectSemanticEvents } from "./event-detector.mjs";
import { extractKnowledge } from "./knowledge-extractor.mjs";
import { parseSessionEvents } from "./session-parser.mjs";
import { buildSessionGraph } from "./session-graph.mjs";

export function compileSessionKnowledge(session) {
  const events = parseSessionEvents(session);
  const semantic_events = detectSemanticEvents(events);
  const graph = buildSessionGraph(events, semantic_events);
  const activity = extractKnowledge(events, semantic_events);
  const storedEvents = events.map(({ text, ...event }) => ({ ...event, text_chars: text.length }));
  const countType = (type) => semantic_events.filter((event) => event.type === type).length;
  const complexity = {
    message_count: events.length,
    corrections: countType("correction"),
    failed_attempts: countType("failure"),
    task_changed: countType("correction") > 0,
    needs_llm_compression: false,
  };
  return {
    activity,
    session_record: {
      events: storedEvents,
      semantic_events,
      graph,
      knowledge: {
        initial_task: activity.initial_task || null,
        final_task: activity.final_task || null,
        constraints: activity.constraints,
        corrections: activity.corrections,
        decisions: activity.decisions,
        failures: activity.failures,
        knowledge_points: activity.knowledge_points,
        effective_result: activity.effective_result || null,
      },
      complexity,
      source_ref: session.source_ref || null,
      message_count: events.length,
    },
  };
}
