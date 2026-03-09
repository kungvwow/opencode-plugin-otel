import * as net from "net"

export type ProbeResult = { ok: boolean; ms: number; error?: string }

export function probeEndpoint(endpoint: string): Promise<ProbeResult> {
  let host: string
  let port: number
  try {
    const url = new URL(endpoint)
    host = url.hostname
    port = parseInt(url.port || "4317", 10)
  } catch {
    return Promise.resolve({ ok: false, ms: 0, error: `invalid endpoint URL: ${endpoint}` })
  }
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy()
      resolve({ ok: true, ms: Date.now() - start })
    })
    socket.setTimeout(5000)
    socket.on("timeout", () => {
      socket.destroy()
      resolve({ ok: false, ms: Date.now() - start, error: "timed out after 5s" })
    })
    socket.on("error", (err) => {
      resolve({ ok: false, ms: Date.now() - start, error: err.message })
    })
  })
}
