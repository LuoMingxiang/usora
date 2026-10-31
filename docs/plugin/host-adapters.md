# Host Adapter Guide

To add a host, implement an adapter that returns Usora Session Protocol v1.

1. Read host-specific event or transcript data.
2. Convert it to `{ schema_version: 1, source, source_ref, messages }`.
3. Use supported message roles: `user`, `assistant`, `tool`, `command`, `error`, `validation`, or `event`.
4. Normalize unsupported host events to `event` and preserve the original type in `event_type`.
5. Keep host-specific parsing outside `plugins/foundry/src/core/intelligence`.

The contract is defined in [Usora Session Protocol v1](../protocol/usora-session-protocol-v1.md). Existing parsers live in `plugins/foundry/src/adapters/`; conformance coverage is in `test/integration/foundry-multi-host-protocol.test.ts`.

## Activity Sources and shared Knowledge

A Session adapter parses a host transcript. An Activity Source reads already-captured Usora Activities; it does not import raw transcripts into shared Knowledge.

- Implement `ActivitySource` in `plugins/foundry/src/sources/activity-source.ts` and register it in `sources/registry.ts`. The current local-file implementation is `LocalActivitySource`.
- Sources resolve a host root and its `activities/` directory. Current Codex and CodeBuddy roots can be overridden with `USORA_CODEX_HOME` and `USORA_CODEBUDDY_HOME`; discovery deduplicates resolved roots.
- Local sources read JSON Activities with a fingerprint and digest, excluding `ARCHIVED` records. Pattern indexing merges evidence by fingerprint, records `{source, id}` in `activity_refs` and host names in `source_hosts`, and avoids counting the same source/Activity twice. It does not change source Activity state.
- `sources/ingestion-state.ts` stores per-source `last_seen_at` and `recent_ids` in shared `indexes/ingestion.json`. The current local reader scans the directory; these fields do not provide timestamp-based incremental reads.

Session and Activity storage stays host-local; Patterns, Candidates, Skills, indexes, events and usage use Knowledge Home. See the [storage guide](../plugin.md#data) for paths, relocation and explicit migration behavior. `hub_status` reports resolved paths and source availability.

Coverage for cross-host aggregation and source immutability is in `test/integration/foundry-activity-sources.test.ts`; lifecycle migration coverage is in `test/integration/foundry-migration.test.ts`. Build before running integration tests.
