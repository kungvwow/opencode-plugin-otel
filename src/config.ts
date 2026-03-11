import { LEVELS, type Level } from "./types.ts"

export type PluginConfig = {
  enabled: boolean
  endpoint: string
  metricsInterval: number
  logsInterval: number
  metricPrefix: string
  otlpHeaders: string | undefined
  resourceAttributes: string | undefined
}

export function parseEnvInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function loadConfig(): PluginConfig {
  const otlpHeaders = process.env["OPENCODE_OTLP_HEADERS"]
  const resourceAttributes = process.env["OPENCODE_RESOURCE_ATTRIBUTES"]

  if (otlpHeaders) process.env["OTEL_EXPORTER_OTLP_HEADERS"] = otlpHeaders
  if (resourceAttributes) process.env["OTEL_RESOURCE_ATTRIBUTES"] = resourceAttributes

  return {
    enabled: !!process.env["OPENCODE_ENABLE_TELEMETRY"],
    endpoint: process.env["OPENCODE_OTLP_ENDPOINT"] ?? "http://localhost:4317",
    metricsInterval: parseEnvInt("OPENCODE_OTLP_METRICS_INTERVAL", 60000),
    logsInterval: parseEnvInt("OPENCODE_OTLP_LOGS_INTERVAL", 5000),
    metricPrefix: process.env["OPENCODE_METRIC_PREFIX"] ?? "opencode.",
    otlpHeaders,
    resourceAttributes,
  }
}

export function resolveLogLevel(logLevel: string, current: Level): Level {
  const candidate = logLevel.toLowerCase()
  if (candidate in LEVELS) return candidate as Level
  return current
}
