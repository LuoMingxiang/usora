# Archive Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preview and permanently delete unreferenced archived Activities.
**Architecture:** Extend hub_cleanup with an archive mode and a focused archive cleaner. Read Candidate and Skill references before any deletion; retain referenced and malformed records.
**Tech Stack:** TypeScript, Node fs, Vitest, Bun.
**Spec:** docs/superpowers/specs/2026-11-10-archive-cleanup-design.md

## Global Constraints

No new dependencies. Existing cleanup defaults unchanged. Delete only current host archived JSON Activity files after confirm=true.

## Review Focus

Malformed references fail closed; nested Skill evolution evidence protects records; symlinks are not followed; malformed archives are retained; repeat deletion is idempotent.

### Task 1: Archive cleanup

Files: core/archive-cleanup.ts, core/hub.ts, mcp/tools/hub.ts, integration/foundry-archive-cleanup.test.ts, bilingual hub tool docs.
Interface: cleanupArchive(confirm: boolean) returns mode, dry_run, eligible, deleted, protected, skipped.

- [x] Write tests for preview/delete, reference protection, invalid files, symlinks and idempotency.
- [x] Run tests and observe unsupported archive mode failure.
- [x] Implement reference collection and guarded deletion; expose schema enum.
- [x] Run full tests, build, typecheck, lint and formatting; document usage.
- [x] Review and commit feature branch without merging or publishing.

## Verification

180 tests passed across 20 files. Build, package, marketplace generation, TypeScript, lint, formatting and git diff checks passed. Fresh review found no important defects. Original baseline lacked yaml and packaged artifacts; installing workspace dependencies and generating packages resolved those setup failures.
