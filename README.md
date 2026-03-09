# opencode-plugin-otel

An [opencode](https://opencode.ai) plugin that exports telemetry via OpenTelemetry (OTLP/gRPC), mirroring the same signals as [Claude Code's monitoring](https://code.claude.com/docs/en/monitoring-usage).

## What it instruments

### Metrics

| Metric | Description |
|--------|-------------|
| `opencode.session.count` | Counter — incremented on each `session.created` event |
| `opencode.token.usage` | Counter — per token type: `input`, `output`, `reasoning`, `cacheRead`, `cacheCreation` |
| `opencode.cost.usage` | Counter — USD cost per completed assistant message |
| `opencode.lines_of_code.count` | Counter — lines added/removed per `session.diff` event |
| `opencode.commit.count` | Counter — git commits detected via bash tool |
| `opencode.tool.duration` | Histogram — tool execution time in milliseconds |

### Log events

| Event | Description |
|-------|-------------|
| `session.created` | Session started |
| `session.idle` | Session went idle |
| `session.error` | Session error |
| `user_prompt` | User sent a message (includes `prompt_length`, `model`, `agent`) |
| `api_request` | Completed assistant message (tokens, cost, duration) |
| `api_error` | Failed assistant message (error summary, duration) |
| `tool_result` | Tool completed or errored (duration, success, output size) |
| `tool_decision` | Permission prompt answered (accept/reject) |
| `commit` | Git commit detected |

## Installation

Add the plugin to your opencode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-otel"]
}
```

Or point directly at a local checkout for development:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/path/to/opencode-plugin-otel/index.ts"]
}
```

## Configuration

All configuration is via environment variables. Set them in your shell profile (`~/.zshrc`, `~/.bashrc`, etc.).

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_ENABLE_TELEMETRY` | _(unset)_ | Set to any non-empty value to enable the plugin |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC OTLP collector endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | _(none)_ | Comma-separated `key=value` auth headers, e.g. `api-key=abc123` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` | Metrics export interval in milliseconds |
| `OTEL_LOGS_EXPORT_INTERVAL` | `5000` | Logs export interval in milliseconds |
| `OTEL_RESOURCE_ATTRIBUTES` | _(none)_ | Extra resource attributes, e.g. `team=platform,env=prod` |

### Quick start

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
opencode
```

### Datadog example

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.datadoghq.com
export OTEL_EXPORTER_OTLP_HEADERS=dd-api-key=YOUR_API_KEY
export OTEL_RESOURCE_ATTRIBUTES=team=platform,env=prod
```

### Honeycomb example

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
export OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY
```

## Local development

See [CONTRIBUTING.md](./CONTRIBUTING.md).
