// A local pass-through to OpenWork's live agent MCP. It adds the bearer token (so no client config
// holds a secret) and, unless the variant is `live`, rebuilds only the skill index in `initialize`.
import http from "node:http"
import { rebuildInstructions } from "./skill-index.mjs"

export const UPSTREAM = "https://api.openworklabs.com/mcp/agent"

export function startProxy({ variant, port, getToken, skills, upstream = UPSTREAM }) {
  const server = http.createServer((req, res) => {
    // An upstream stream can be cut (HTTP/2 resets on the long-lived GET); answer 502, don't crash the bench.
    forward(req, res).catch((error) => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" })
      res.end(String(error?.message ?? error))
    })
  })

  async function forward(req, res) {
    const chunks = []

    for await (const chunk of req) chunks.push(chunk)
    const headers = { ...req.headers, authorization: `Bearer ${await getToken()}` }
    delete headers.host
    delete headers["content-length"]
    delete headers["accept-encoding"]
    const hasBody = req.method !== "GET" && req.method !== "HEAD"
    const up = await fetch(upstream, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined })
    let body = await up.text()

    if (variant !== "live" && body.includes('"instructions"')) {
      const patch = (json) => {
        const message = JSON.parse(json)

        if (message.result?.instructions) {
          message.result.instructions = rebuildInstructions(message.result.instructions, skills, variant)
        }

        return JSON.stringify(message)
      }

      // The server answers as plain JSON or as SSE, depending on the client's Accept header.
      body = body.trimStart().startsWith("{") ? patch(body) : body.replace(/^data: (.*)$/m, (_, json) => `data: ${patch(json)}`)
    }

    const out = {}
    up.headers.forEach((value, key) => {
      if (!["content-length", "content-encoding", "transfer-encoding"].includes(key)) out[key] = value
    })
    res.writeHead(up.status, out).end(body)
  }

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)))
}
