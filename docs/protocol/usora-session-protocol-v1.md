# Usora Session Protocol v1

Usora adapters normalize host-specific session data into this protocol before core intelligence runs.

## Required Fields

- `schema_version`: `1`
- `source`: host or adapter name, for example `codex`, `codebuddy`, or a future adapter id
- `messages`: ordered array of session events

Each message requires:

- `role`: one of `user`, `assistant`, `tool`, `command`, `error`, `validation`, `event`
- `text`: compact plain text

Optional fields:

- `source_ref`: `{ type, path }` or equivalent pointer to source material
- `id`: host message id
- `timestamp`: ISO timestamp when available
- `event_type`: original event type when `role` is normalized to `event`

## Event Types

Unsupported host event types must be normalized to `role: "event"` and preserve the original type in `event_type`.

## Boundary

Adapters may parse host-specific transcript formats. Core intelligence modules must consume only this normalized protocol and must not know about Codex, CodeBuddy, or host transcript internals.
