# Host Adapter Guide

To add a host, implement an adapter that returns Usora Session Protocol v1.

1. Read host-specific event or transcript data.
2. Convert it to `{ schema_version: 1, source, source_ref, messages }`.
3. Use supported message roles: `user`, `assistant`, `tool`, `command`, `error`, `validation`, or `event`.
4. Normalize unsupported host events to `event` and preserve the original type in `event_type`.
5. Keep host-specific parsing outside `plugins/foundry/src/core/intelligence`.

Run adapter conformance tests after adding an adapter.
