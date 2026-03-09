# AGENTS.md

Instructions for AI agents working in this repository.

## Build & typecheck

Always run after making changes:

```bash
bun run typecheck
```

There is no separate build step needed for local development. For publishing:

```bash
bun run build
```

## Testing

```bash
bun test
```

## Project layout

```
src/
├── index.ts              — Plugin entrypoint
├── types.ts              — Shared types
├── config.ts             — Env config and log level
├── otel.ts               — OTel SDK setup and instruments
├── probe.ts              — OTLP endpoint TCP probe
├── util.ts               — errorSummary, setBoundedMap
└── handlers/
    ├── session.ts        — Session lifecycle events
    ├── message.ts        — LLM message and tool part events
    ├── permission.ts     — Tool permission events
    └── activity.ts       — File diffs and git commits
```

## Key conventions

- **Bun over Node** — use `bun`, `bun test`, `bun run`. Never use `node`, `npx`, `jest`, or `vitest`.
- **No comments** unless explicitly requested.
- **No `sdk-node`** — the OTel Node SDK meta-package is intentionally excluded; use individual packages.
- **`HandlerContext`** — all event handlers receive a `HandlerContext` (defined in `src/types.ts`). Do not import `client` or OTel globals directly inside handlers; thread them through the context.
- **`setBoundedMap`** — always use this instead of `Map.set` for `pendingToolSpans` and `pendingPermissions` to prevent unbounded growth.
- **Single source of truth for tokens/cost** — token and cost counters are incremented only in `message.updated` (`src/handlers/message.ts`), never in `step-finish`.
- **Shutdown** — OTel providers are flushed via `SIGTERM`/`SIGINT`/`beforeExit`. Do not use `process.on("exit")` for async flushing.
- **`OPENCODE_ENABLE_TELEMETRY`** — all OTel instrumentation is gated on this env var. The plugin always loads regardless; only telemetry is disabled when unset.
