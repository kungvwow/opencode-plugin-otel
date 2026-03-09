import type { Plugin } from "@opencode-ai/plugin"
import type {
  AssistantMessage,
  EventSessionCreated,
  EventSessionIdle,
  EventSessionError,
  EventMessageUpdated,
  EventMessagePartUpdated,
  ToolPart,
  StepFinishPart,
} from "@opencode-ai/sdk"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"
import { metrics } from "@opentelemetry/api"
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs"
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc"
import { resourceFromAttributes } from "@opentelemetry/resources"
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_OS_TYPE,
  ATTR_HOST_ARCH,
} from "@opentelemetry/semantic-conventions"

const SERVICE_NAME = "opencode"
const METER_NAME = "com.opencode"

function buildResource() {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_OS_TYPE]: process.platform,
    [ATTR_HOST_ARCH]: process.arch,
    ...(process.env["OTEL_RESOURCE_ATTRIBUTES"]
      ? Object.fromEntries(
          process.env["OTEL_RESOURCE_ATTRIBUTES"]
            .split(",")
            .map((pair) => pair.split("=") as [string, string]),
        )
      : {}),
  })
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  return Object.fromEntries(
    raw
      .split(",")
      .map((h) => h.split("=") as [string, string])
      .filter(([k]) => k),
  )
}

function setupOtel() {
  const endpoint =
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4317"
  const headers = parseHeaders(process.env["OTEL_EXPORTER_OTLP_HEADERS"])
  const resource = buildResource()

  const metricsInterval = parseInt(
    process.env["OTEL_METRIC_EXPORT_INTERVAL"] ?? "60000",
    10,
  )
  const logsInterval = parseInt(
    process.env["OTEL_LOGS_EXPORT_INTERVAL"] ?? "5000",
    10,
  )

  const metricExporter = new OTLPMetricExporter({ url: endpoint, headers })
  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: metricsInterval,
      }),
    ],
  })
  metrics.setGlobalMeterProvider(meterProvider)

  const logExporter = new OTLPLogExporter({ url: endpoint, headers })
  const loggerProvider = new LoggerProvider({ resource })
  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(logExporter, {
      scheduledDelayMillis: logsInterval,
    }),
  )
  logs.setGlobalLoggerProvider(loggerProvider)

  return { meterProvider, loggerProvider }
}

export const OtelPlugin: Plugin = async ({ project }) => {
  if (!process.env["OPENCODE_ENABLE_TELEMETRY"]) return {}

  const { meterProvider, loggerProvider } = setupOtel()

  const meter = metrics.getMeter(METER_NAME)
  const logger = logs.getLogger(METER_NAME)

  const sessionCounter = meter.createCounter("opencode.session.count", {
    unit: "count",
    description: "Count of opencode sessions started",
  })
  const tokenCounter = meter.createCounter("opencode.token.usage", {
    unit: "tokens",
    description: "Number of tokens used",
  })
  const costCounter = meter.createCounter("opencode.cost.usage", {
    unit: "USD",
    description: "Cost of the opencode session in USD",
  })
  const toolDurationHistogram = meter.createHistogram(
    "opencode.tool.duration",
    {
      unit: "ms",
      description: "Duration of tool executions in milliseconds",
    },
  )

  const activeSessions = new Map<string, { startMs: number }>()
  const pendingToolSpans = new Map<
    string,
    { tool: string; sessionID: string; startMs: number }
  >()

  const commonAttrs = () => ({
    "project.path": project.path,
  })

  process.on("exit", () => {
    meterProvider.shutdown().catch(() => {})
    loggerProvider.shutdown().catch(() => {})
  })

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const e = event as EventSessionCreated
        const sessionID = e.properties.id
        activeSessions.set(sessionID, { startMs: Date.now() })
        sessionCounter.add(1, {
          ...commonAttrs(),
          "session.id": sessionID,
        })
        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: "INFO",
          body: "session.created",
          attributes: {
            "event.name": "session.created",
            "event.timestamp": new Date().toISOString(),
            "session.id": sessionID,
            ...commonAttrs(),
          },
        })
        return
      }

      if (event.type === "session.idle") {
        const e = event as EventSessionIdle
        const sessionID = e.properties.sessionID
        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: "INFO",
          body: "session.idle",
          attributes: {
            "event.name": "session.idle",
            "event.timestamp": new Date().toISOString(),
            "session.id": sessionID,
            ...commonAttrs(),
          },
        })
        return
      }

      if (event.type === "session.error") {
        const e = event as EventSessionError
        const sessionID = e.properties.sessionID ?? "unknown"
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: "ERROR",
          body: "session.error",
          attributes: {
            "event.name": "session.error",
            "event.timestamp": new Date().toISOString(),
            "session.id": sessionID,
            error: e.properties.error ?? "unknown",
            ...commonAttrs(),
          },
        })
        return
      }

      if (event.type === "message.updated") {
        const e = event as EventMessageUpdated
        const msg = e.properties
        if (msg.role !== "assistant") return
        const assistant = msg as AssistantMessage
        const sessionID = assistant.sessionID
        const modelID = assistant.modelID
        const providerID = assistant.providerID

        if (assistant.time.completed) {
          const duration =
            assistant.time.completed - assistant.time.created

          tokenCounter.add(assistant.tokens.input, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
            type: "input",
          })
          tokenCounter.add(assistant.tokens.output, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
            type: "output",
          })
          tokenCounter.add(assistant.tokens.reasoning, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
            type: "reasoning",
          })
          tokenCounter.add(assistant.tokens.cache.read, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
            type: "cacheRead",
          })
          tokenCounter.add(assistant.tokens.cache.write, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
            type: "cacheCreation",
          })
          costCounter.add(assistant.cost, {
            ...commonAttrs(),
            "session.id": sessionID,
            model: modelID,
          })

          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: "INFO",
            body: "api_request",
            attributes: {
              "event.name": "api_request",
              "event.timestamp": new Date(
                assistant.time.created,
              ).toISOString(),
              "session.id": sessionID,
              model: modelID,
              provider: providerID,
              cost_usd: assistant.cost,
              duration_ms: duration,
              input_tokens: assistant.tokens.input,
              output_tokens: assistant.tokens.output,
              reasoning_tokens: assistant.tokens.reasoning,
              cache_read_tokens: assistant.tokens.cache.read,
              cache_creation_tokens: assistant.tokens.cache.write,
              ...(assistant.error
                ? { error: assistant.error.name }
                : {}),
              ...commonAttrs(),
            },
          })
        }
        return
      }

      if (event.type === "message.part.updated") {
        const e = event as EventMessagePartUpdated
        const part = e.properties.part

        if (part.type === "tool") {
          const toolPart = part as ToolPart
          const key = `${toolPart.sessionID}:${toolPart.callID}`

          if (toolPart.state.status === "running") {
            pendingToolSpans.set(key, {
              tool: toolPart.tool,
              sessionID: toolPart.sessionID,
              startMs: toolPart.state.time.start,
            })
          } else if (
            toolPart.state.status === "completed" ||
            toolPart.state.status === "error"
          ) {
            const span = pendingToolSpans.get(key)
            pendingToolSpans.delete(key)
            const start = span?.startMs ?? toolPart.state.time.start
            const end = toolPart.state.time.end
            const duration_ms = end - start
            const success = toolPart.state.status === "completed"

            toolDurationHistogram.record(duration_ms, {
              ...commonAttrs(),
              "session.id": toolPart.sessionID,
              tool_name: toolPart.tool,
              success: String(success),
            })

            logger.emit({
              severityNumber: success
                ? SeverityNumber.INFO
                : SeverityNumber.ERROR,
              severityText: success ? "INFO" : "ERROR",
              body: "tool_result",
              attributes: {
                "event.name": "tool_result",
                "event.timestamp": new Date(start).toISOString(),
                "session.id": toolPart.sessionID,
                tool_name: toolPart.tool,
                success: String(success),
                duration_ms,
                ...(toolPart.state.status === "completed"
                  ? {
                      tool_result_size_bytes: Buffer.byteLength(
                        toolPart.state.output,
                        "utf8",
                      ),
                    }
                  : { error: toolPart.state.error }),
                ...commonAttrs(),
              },
            })
          }
        }

        if (part.type === "step-finish") {
          const stepPart = part as StepFinishPart
          tokenCounter.add(stepPart.tokens.input, {
            ...commonAttrs(),
            "session.id": stepPart.sessionID,
            type: "input",
          })
          tokenCounter.add(stepPart.tokens.output, {
            ...commonAttrs(),
            "session.id": stepPart.sessionID,
            type: "output",
          })
          costCounter.add(stepPart.cost, {
            ...commonAttrs(),
            "session.id": stepPart.sessionID,
          })
        }
        return
      }
    },
  }
}
