# Contributing

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- An opencode installation for manual testing

## Getting started

```bash
git clone https://github.com/devtheops/opencode-plugin-otel
cd opencode-plugin-otel
bun install
```

## Development workflow

Point your local opencode config at the repo so changes are picked up immediately without a build step. In `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/path/to/opencode-plugin-otel/index.ts"]
}
```

opencode loads TypeScript natively via Bun, so there is no build step required during development.

## Commands

| Command | Description |
|---------|-------------|
| `bun run typecheck` | Type-check all sources without emitting |
| `bun test` | Run the test suite |
| `bun run build` | Compile to `dist/` for publishing |

## Project structure

```
src/
├── index.ts              — Plugin entrypoint, wires everything together
├── types.ts              — Shared types (Level, HandlerContext, Instruments, etc.)
├── config.ts             — Environment config loading and log level resolution
├── otel.ts               — OTel SDK setup, resource construction, instrument creation
├── probe.ts              — TCP connectivity probe for the OTLP endpoint
├── util.ts               — Utility functions (errorSummary, setBoundedMap)
└── handlers/
    ├── session.ts        — session.created / session.idle / session.error
    ├── message.ts        — message.updated / message.part.updated
    ├── permission.ts     — permission.updated / permission.replied
    └── activity.ts       — session.diff / command.executed
```

## Testing locally with a collector

The easiest way to verify telemetry is being emitted is to run a local OpenTelemetry collector:

```bash
docker run --rm -p 4317:4317 \
  otel/opentelemetry-collector:latest
```

Then set `OPENCODE_ENABLE_TELEMETRY=1` and start opencode. The collector will print received spans and metrics to stdout.

## Submitting changes

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes and ensure `bun run typecheck` passes
3. Open a pull request with a clear description of what changed and why

## Releasing

Releases are handled via GitHub Actions. See [the release workflow](.github/workflows/release.yml). To cut a release, push a version tag:

```bash
git tag v1.2.3
git push origin v1.2.3
```
