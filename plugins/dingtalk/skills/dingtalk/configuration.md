# DingTalk setup and delivery semantics

Set `DINGTALK_CONFIG` to an absolute JSON file path, then restart the plugin MCP server.
Keep this file outside the repository. Without it, the server exposes diagnostics but performs no network operations.

```json
{
  "enabled": true,
  "transport": "app",
  "stream": true,
  "foundryMcp": "D:/Usora/plugins/foundry/dist/mcp.js",
  "foundryEnv": {
    "PLUGIN_DATA": "PATH_TO_YOUR_FOUNDRY_PLUGIN_DATA_DIRECTORY",
    "CODEBUDDY_PLUGIN_DATA": ""
  },
  "corpId": "YOUR_CORP_ID",
  "conversationId": "YOUR_OPEN_CONVERSATION_ID",
  "templateId": "YOUR_PUBLISHED_CARD_TEMPLATE_ID",
  "identities": {
    "YOUR_CORP_ID:YOUR_STAFF_ID": "YOUR_USORA_ACTOR_ID"
  }
}
```

`foundryMcp` points to the **installed Foundry MCP executable**, not its private source files. Alternatively set `USORA_FOUNDRY_MCP`.
`foundryEnv` overlays the child environment. Copy the **Foundry** server's data environment, not the DingTalk plugin's data directory: `PLUGIN_DATA` points to the parent of the `.usora` anchor containing Foundry's config. For CodeBuddy, set `CODEBUDDY_PLUGIN_DATA` instead. Copy `USORA_HOME` too if Foundry uses a separate shared knowledge path. If the host supplies plugin data variables, `foundryEnv` is required to prevent silently opening a different Hub. Verify the paths using Foundry's `hub_status` before enabling delivery.
The authoritative Maintainer comes from Foundry configuration and is checked again on each command; do not put a separate Maintainer in DingTalk config.

Supply `DINGTALK_APP_KEY` and `DINGTALK_APP_SECRET` as environment variables. Enable and publish the enterprise application's Stream robot and grant access to the target group and required APIs.
Map staff IDs explicitly with their tenant ID. Unmapped users and callbacks from another tenant are denied.

## Interactive card template

Publish a template in your own DingTalk application's card designer. The application must have permission to use it.
The transport supplies these variables in `cardData.cardParamMap`:

| Variable   | Template binding                                                                            |
| ---------- | ------------------------------------------------------------------------------------------- |
| `title`    | Text heading                                                                                |
| `markdown` | Markdown body                                                                               |
| `actions`  | JSON array: render a button for each item, label from `label`, callback action ID from `id` |
| `feedback` | Private text feedback, updated after the action                                             |

Configure button behavior as **server callback**, not URL navigation or local data mutation. Use `STREAM` callback mode.
Candidate action IDs are `candidate.view`, `candidate.approve`, `candidate.reject`; governance action IDs are `governance.keep`, `governance.evolve`, `governance.deprecate`, `governance.retire`.
The server checks that the action was offered in the persisted card and retrieves its target locally. Callback parameters cannot replace that target.
An approval evaluates a Candidate as `pass`; it does not publish a Skill. Destructive governance operations recheck the Foundry Maintainer.

## Tools and bot commands

- `dingtalk_status`: readiness and Stream connection state, without secrets.
- `dingtalk_sync`: consume Foundry events now. While the MCP connection stays open, a 30-second poll also consumes them.
- `dingtalk_capture_document`: supply a document's `docKey` and an authorized operator's **unionId** as `operatorId`. Calls `GET /v1.0/doc/suites/documents/{docKey}/blocks`, preserves returned block content, then calls Foundry `activity_capture`. Repeating a capture updates the same document Activity. No enterprise-wide scan occurs.
- `dingtalk_replay`: supply a dead-letter delivery's full `id` to reset it, then run sync.

Bot commands: `status`, `candidates`, `candidate ID`, `skill NAME`, `governance`, `foundry run`, `digest` (an optional leading `/` is accepted).
`foundry run` runs Foundry's existing incremental Pattern index; it does not synthesize or publish Skills. `digest` returns existing telemetry.

For notification-only operation, use `transport: "webhook"`, supply `DINGTALK_WEBHOOK_URL` and optionally `DINGTALK_WEBHOOK_SECRET`.
Webhook Markdown is intentionally a fallback: custom-robot URL cards cannot replace authenticated interactive cards. Use app + Stream + your template for actions.
Document capture still requires app credentials. Access-denied or malformed document responses fail without creating an Activity.

## ADR-008: recovery and authenticated integration boundary

Status: accepted for this repair. This supersedes claims that the earlier fixture-only implementation was production-complete.

- Incoming network callbacks use the official Stream SDK's authenticated connection. No HTTP callback endpoint is exposed. The optional local signed-envelope parser is **not** DingTalk's HTTP callback protocol; it requires a body-bound HMAC and a five-minute timestamp window, and is not exposed as an MCP tool.
- Cross-process state exclusion uses `proper-lockfile` with a heartbeat and a 30-second stale lease. This replaces custom PID-lock recovery. Do not manually remove a live lock. Long process suspension beyond the lease is outside the local runner guarantee.
- A crashed `delivering` record can retry after lock recovery. Failed records wait for `nextAttemptAt`; exhausted attempts enter dead letter.
- Webhook delivery is **at least once**: a crash after remote acceptance but before local persistence can repeat a notification. The webhook API supplies no transaction with local storage, so exactly-once delivery is not claimed.
- App cards keep a stable `outTrackId` derived from provider/subscription/event ID. Retries never invent a new card identity. Provider errors remain visible in delivery records; operators must not work around them by changing IDs.
- Callback receipts are written only after success. Foundry persists request deduplication with the domain record and can recover deterministic lifecycle events after a crash before event writing. Retry does not reapply an earlier action after a later action changed the record.
- The runtime uses only public Foundry MCP tools and public event files located through `hub_status`; DingTalk never imports Foundry private modules.
- The SDK and lock library are bundled in distributable JavaScript. Source is linted; generated dependency bundles are tested and packaged rather than linted as hand-written source.

## Verification boundary

Automated tests cover real installed MCP processes and Foundry state changes; DingTalk HTTP responses and Stream frames use fixtures.
A real enterprise acceptance run still requires your app credentials, granted document permissions, published template, and group access. These results must not be represented as having passed before that run.

Protocol references: [official Node Stream SDK](https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs), [official card example](https://github.com/open-dingtalk/dingtalk-card-examples/tree/main/examples/helloworld/nodejs), and `@alicloud/dingtalk` 2.2.46's generated `DocBlocksQuery` client contract.
