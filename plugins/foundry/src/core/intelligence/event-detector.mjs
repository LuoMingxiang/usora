const DETECTORS = [
  ["constraint", /不要|必须|要求|限制|注意|只需要|不能|do not|must|require|only/i, 0.85],
  ["correction", /不是|改成|我的意思|纠正|应该是|actually|instead|correction/i, 0.9],
  ["attempt", /尝试|试试|先用|attempt|try|tried/i, 0.7],
  ["failure", /失败|不行|还是不行|报错|failed|does not work|error/i, 0.85],
  ["decision", /最终|采用|确定|决定|结论|decision|decided|use /i, 0.8],
  ["verification", /验证|通过|测试|确认|verified|passes|works/i, 0.8],
  ["result", /完成|解决|修复|done|fixed|implemented/i, 0.75],
];

export function detectSemanticEvents(events) {
  const semanticEvents = [];
  for (const event of events) {
    for (const [type, pattern, confidence] of DETECTORS) {
      if (pattern.test(event.text)) {
        semanticEvents.push({ type, confidence, source_event_id: event.id, text: event.text });
      }
    }
  }
  return semanticEvents;
}
