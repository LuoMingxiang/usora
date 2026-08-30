import { compactText } from "../session-protocol.ts";
import type { SemanticEvent } from "./event-detector.ts";
import type { ParsedSessionEvent } from "./session-parser.ts";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function scoreUserEvent(event: ParsedSessionEvent): number {
  let score = 0;
  if (event.index === 0) score += 3;
  if (/不要|必须|要求|限制|注意|只需要|不能|do not|must|require|only/i.test(event.text)) score += 5;
  if (/不是|改成|我的意思|纠正|应该是|actually|instead|correction/i.test(event.text)) score += 5;
  if (/最终|采用|确定|决定|结论|原因|decision|decided|because/i.test(event.text)) score += 4;
  if (/失败|不行|报错|failed|error/i.test(event.text)) score += 3;
  if (event.text.length < 8) score -= 3;
  return score;
}

export function extractKnowledge(events: ParsedSessionEvent[], semanticEvents: SemanticEvent[]) {
  const users = events.filter((event) => event.role === "user");
  const assistants = events.filter((event) => event.role === "assistant");
  const byType = (type: string) =>
    semanticEvents.filter((event) => event.type === type).map((event) => compactText(event.text, 240));
  const ranked = users
    .map((event) => ({ event, score: scoreUserEvent(event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.event.index - b.event.index)
    .slice(0, 8)
    .sort((a, b) => a.event.index - b.event.index)
    .map((item) => compactText(item.event.text, 240));
  const semanticPoints = semanticEvents
    .filter((event) => ["constraint", "correction", "decision", "failure", "verification"].includes(event.type))
    .map((event) => compactText(event.text, 240));
  const result = assistants.at(-1)?.text;
  const key_points = unique([...ranked, ...semanticPoints]).slice(0, 12);
  return {
    initial_task: users[0]?.text,
    final_task: byType("correction").at(-1) || users.at(-1)?.text || users[0]?.text,
    task: users[0]?.text,
    result,
    effective_result: result,
    summary: result ? compactText(result, 200) : undefined,
    constraints: byType("constraint"),
    corrections: byType("correction"),
    decisions: byType("decision"),
    failures: byType("failure"),
    knowledge_points: key_points,
    key_points,
  };
}
