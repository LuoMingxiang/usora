# Usora DingTalk

Use this skill when working on the Usora DingTalk integration plugin.

Keep DingTalk-specific transport, signing, and card rendering inside `plugins/dingtalk`. Keep provider-neutral contracts in `@usora/integration`.
Read [configuration.md](configuration.md) for setup, interactive template bindings, capture tools, and recovery semantics. Use `dingtalk_status` first; use the other DingTalk tools only within the user's requested scope. Do not claim real DingTalk acceptance from fixture tests.
