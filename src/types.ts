import type { Counter, Histogram } from "@opentelemetry/api"
import type { Logger as OtelLogger } from "@opentelemetry/api-logs"

export const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
export type Level = keyof typeof LEVELS

export const MAX_PENDING = 500

export type PluginLogger = (
  level: Level,
  message: string,
  extra?: Record<string, unknown>,
) => Promise<void>

export type CommonAttrs = { readonly "project.id": string }

export type PendingToolSpan = {
  tool: string
  sessionID: string
  startMs: number
}

export type PendingPermission = {
  type: string
  title: string
  sessionID: string
}

export type Instruments = {
  sessionCounter: Counter
  tokenCounter: Counter
  costCounter: Counter
  linesCounter: Counter
  commitCounter: Counter
  toolDurationHistogram: Histogram
}

export type HandlerContext = {
  logger: OtelLogger
  log: PluginLogger
  instruments: Instruments
  commonAttrs: CommonAttrs
  pendingToolSpans: Map<string, PendingToolSpan>
  pendingPermissions: Map<string, PendingPermission>
}
