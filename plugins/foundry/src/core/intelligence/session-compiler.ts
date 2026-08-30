import { detectSemanticEvents } from "./event-detector.ts";
import { extractKnowledge } from "./knowledge-extractor.ts";
import { parseSessionEvents } from "./session-parser.ts";
import { buildSessionGraph } from "./session-graph.ts";
import type { normalizeSessionProtocol } from "../session-protocol.ts";

type NormalizableSession = Parameters<typeof normalizeSessionProtocol>[0];

export function compileSessionKnowledge(session: NormalizableSession = {}) {
  const events = parseSessionEvents(session);
  const semantic_events = detectSemanticEvents(events);
  const graph = buildSessionGraph(events, semantic_events);
  const activity = extractKnowledge(events, semantic_events);
  const storedEvents = events.map(({ text, ...event }) => ({ ...event, text_chars: text.length }));
  const countType = (type: string) => semantic_events.filter((event) => event.type === type).length;
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
