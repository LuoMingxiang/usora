import assert from "node:assert/strict";
import test from "node:test";
import { compileSessionKnowledge } from "../plugins/foundry/src/core/intelligence/session-compiler.mjs";

test("session compiler extracts early constraints, corrections, failures, decisions, and verification", () => {
  const compiled = compileSessionKnowledge({
    messages: [
      { id: "u1", role: "user", text: "必须优先阅读执行规则，不要直接重写全部 Foundry" },
      { id: "a1", role: "assistant", text: "I will inspect the current implementation first." },
      { id: "u2", role: "user", text: "不是这个意思，改成可验证子任务" },
      { id: "a2", role: "assistant", text: "Attempted the baseline tests." },
      { id: "u3", role: "user", text: "还是不行，测试失败" },
      { id: "u4", role: "user", text: "最终采用 deterministic compiler 并验证通过" },
      { id: "a3", role: "assistant", text: "Implemented compiler and tests pass." },
    ],
  });

  assert.equal(compiled.activity.task, "必须优先阅读执行规则，不要直接重写全部 Foundry");
  assert.equal(compiled.activity.result, "Implemented compiler and tests pass.");
  assert.ok(compiled.activity.key_points.includes("必须优先阅读执行规则，不要直接重写全部 Foundry"));
  assert.ok(compiled.activity.key_points.includes("不是这个意思，改成可验证子任务"));
  assert.ok(compiled.activity.key_points.includes("最终采用 deterministic compiler 并验证通过"));
  assert.ok(compiled.session_record.semantic_events.some((event) => event.type === "constraint"));
  assert.ok(compiled.session_record.semantic_events.some((event) => event.type === "correction"));
  assert.ok(compiled.session_record.semantic_events.some((event) => event.type === "failure"));
  assert.ok(compiled.session_record.semantic_events.some((event) => event.type === "decision"));
  assert.ok(compiled.session_record.semantic_events.some((event) => event.type === "verification"));
});
