import { logs } from "@opentelemetry/api-logs"
import { metrics } from "@opentelemetry/api"
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { ATTR_HOST_ARCH } from "@opentelemetry/semantic-conventions/incubating"
import type { Instruments } from "./types.ts"

export function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  const result: Record<string, string> = {}
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=")
    if (idx > 0) {
      const key = pair.slice(0, idx).trim()
      const val = pair.slice(idx + 1).trim()
      if (key) result[key] = val
    }
  }
  return result
}

export function buildResource(version: string) {
  const attrs: Record<string, string> = {
    [ATTR_SERVICE_NAME]: "opencode",
    "app.version": version,
    "os.type": process.platform,
    [ATTR_HOST_ARCH]: process.arch,
  }
  const raw = process.env["OTEL_RESOURCE_ATTRIBUTES"]
  if (raw) {
    for (const pair of raw.split(",")) {
      const idx = pair.indexOf("=")
      if (idx > 0) {
        const key = pair.slice(0, idx).trim()
        const val = pair.slice(idx + 1).trim()
        if (key) attrs[key] = val
      }
    }
  }
  return resourceFromAttributes(attrs)
}

export type OtelProviders = {
  meterProvider: MeterProvider
  loggerProvider: LoggerProvider
}

export function setupOtel(
  endpoint: string,
  metricsInterval: number,
  logsInterval: number,
  version: string,
): OtelProviders {
  const headers = parseHeaders(process.env["OTEL_EXPORTER_OTLP_HEADERS"])
  const resource = buildResource(version)

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: endpoint, headers }),
        exportIntervalMillis: metricsInterval,
      }),
    ],
  })
  metrics.setGlobalMeterProvider(meterProvider)

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint, headers }), {
        scheduledDelayMillis: logsInterval,
      }),
    ],
  })
  logs.setGlobalLoggerProvider(loggerProvider)

  return { meterProvider, loggerProvider }
}

export function createInstruments(): Instruments {
  const meter = metrics.getMeter("com.opencode")
  return {
    sessionCounter: meter.createCounter("opencode.session.count", {
      unit: "count",
      description: "Count of opencode sessions started",
    }),
    tokenCounter: meter.createCounter("opencode.token.usage", {
      unit: "tokens",
      description: "Number of tokens used",
    }),
    costCounter: meter.createCounter("opencode.cost.usage", {
      unit: "USD",
      description: "Cost of the opencode session in USD",
    }),
    linesCounter: meter.createCounter("opencode.lines_of_code.count", {
      unit: "count",
      description: "Count of lines of code added or removed",
    }),
    commitCounter: meter.createCounter("opencode.commit.count", {
      unit: "count",
      description: "Number of git commits created",
    }),
    toolDurationHistogram: meter.createHistogram("opencode.tool.duration", {
      unit: "ms",
      description: "Duration of tool executions in milliseconds",
    }),
  }
}
