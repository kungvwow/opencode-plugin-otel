import { SeverityNumber } from "@opentelemetry/api-logs"
import type { EventSessionCreated, EventSessionIdle, EventSessionError } from "@opencode-ai/sdk"
import { errorSummary } from "../util.ts"
import type { HandlerContext } from "../types.ts"

export function handleSessionCreated(e: EventSessionCreated, ctx: HandlerContext) {
  const sessionID = e.properties.info.id
  const createdAt = e.properties.info.time.created
  ctx.instruments.sessionCounter.add(1, { ...ctx.commonAttrs, "session.id": sessionID })
  ctx.logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    timestamp: createdAt,
    observedTimestamp: Date.now(),
    body: "session.created",
    attributes: { "event.name": "session.created", "session.id": sessionID, ...ctx.commonAttrs },
  })
  return ctx.log("info", "otel: session.created", { sessionID })
}

function sweepSession(sessionID: string, ctx: HandlerContext) {
  for (const [id, perm] of ctx.pendingPermissions) {
    if (perm.sessionID === sessionID) ctx.pendingPermissions.delete(id)
  }
  for (const [key, span] of ctx.pendingToolSpans) {
    if (span.sessionID === sessionID) ctx.pendingToolSpans.delete(key)
  }
}

export function handleSessionIdle(e: EventSessionIdle, ctx: HandlerContext) {
  const sessionID = e.properties.sessionID
  sweepSession(sessionID, ctx)
  ctx.logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    timestamp: Date.now(),
    observedTimestamp: Date.now(),
    body: "session.idle",
    attributes: { "event.name": "session.idle", "session.id": sessionID, ...ctx.commonAttrs },
  })
}

export function handleSessionError(e: EventSessionError, ctx: HandlerContext) {
  const sessionID = e.properties.sessionID ?? "unknown"
  sweepSession(sessionID, ctx)
  ctx.logger.emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: "ERROR",
    timestamp: Date.now(),
    observedTimestamp: Date.now(),
    body: "session.error",
    attributes: {
      "event.name": "session.error",
      "session.id": sessionID,
      error: errorSummary(e.properties.error),
      ...ctx.commonAttrs,
    },
  })
}
