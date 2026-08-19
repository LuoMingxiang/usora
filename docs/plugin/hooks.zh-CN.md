<p align="center">
  <a href="hooks.md">English</a> ·
  <a href="hooks.zh-CN.md">中文</a>
</p>

# Hooks：自动记录会话活动

本页说明 MVP 阶段的 hook 实现——当宿主触发 `SessionEnd` 时，自动记录 AI 会话活动。

新增内容

- `hooks/session-hook.mjs` 从 stdin 读取 SessionEnd 事件 JSON，尽力提取会话元数据，并通过 Usora 的 canonical Activity 流程记录。
- `hooks/codebuddy-hooks.json` 使用 `${CODEBUDDY_PLUGIN_ROOT}` 注册 CodeBuddy 命令 hook。
- `hooks/codex-hooks.json` 使用 `${CLAUDE_PLUGIN_ROOT}` 注册 Codex 命令 hook。
- `.codex-plugin/plugin.json` 与 `.codebuddy-plugin/plugin.json` 都指向各自宿主的 hook 文件。

工作原理

当 CodeBuddy 或 Codex 触发 `SessionEnd` 时，宿主会调用 `hooks/session-hook.mjs`，并在 stdin 上提供事件 JSON。脚本复用已有的 Activity 合并逻辑，因此同一个 `session_id` 的重复事件只会更新 Hub 中的一条 Activity。

本地测试

在仓库根目录运行：

```bash
echo '{"session_id":"abc123","cwd":"/path/to/repo","timestamp":"2026-08-19T00:00:00Z"}' | node ./hooks/session-hook.mjs
node ./scripts/plugin.mjs status
```

注意事项

- SessionEnd 事件可能不包含 `task` 或 `result`；hook 创建的 Activity 可以先让这些字段为空，之后再补全。
- 非法的时间戳会回退为当前时间。
- hook 会尊重已配置的 Hub 路径，而不是直接写入当前项目的 `.usora/activities`。
