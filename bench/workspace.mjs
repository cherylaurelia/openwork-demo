// OpenWork agent registration (https://openworklabs.com/auth.md): an anonymous, provisional
// workspace that expires after 72 hours, plus a token cache and a tiny MCP client.
import { readFileSync, writeFileSync } from "node:fs"

const API = "https://api.openworklabs.com"
const TOKEN_ENDPOINT = "https://app.openworklabs.com/api/auth/oauth2/token"

export async function register(workspaceName, file) {
  const res = await fetch(`${API}/v1/bootstrap/workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceName, claimRoles: ["owner"] }),
  })

  if (!res.ok) throw new Error(`register: HTTP ${res.status} ${await res.text()}`)
  const body = await res.json()
  // The assertion is a secret: owner-only file, never printed.
  writeFileSync(file, JSON.stringify(body), { mode: 0o600 })

  return { organization: body.organization.id, expiresAt: body.setup.expiresAt }
}

/** Returns a function that hands out an access token, exchanging the assertion again before it expires. */
export function tokenSource(file) {
  const { identity } = JSON.parse(readFileSync(file, "utf8"))
  let token = ""
  let expires = 0

  return async () => {
    if (Date.now() < expires) return token

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: identity.assertionType, assertion: identity.assertion }),
    })

    if (!res.ok) throw new Error(`token exchange: HTTP ${res.status} ${await res.text()}`)
    const body = await res.json()
    token = body.access_token
    expires = Date.now() + (body.expires_in - 120) * 1000

    return token
  }
}

export async function mcp(getToken, method, params = {}) {
  const res = await fetch(`${API}/mcp/agent`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await getToken()}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })

  const text = await res.text()
  const json = text.trimStart().startsWith("{") ? text : text.match(/^data: (.*)$/m)?.[1]

  if (!json) throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 200)}`)
  const message = JSON.parse(json)

  if (message.error) throw new Error(`${method}: ${message.error.message}`)

  return message.result
}

export async function listSkills(getToken) {
  const result = await mcp(getToken, "tools/call", { name: "list_skills", arguments: { limit: 200 } })

  return result.structuredContent.skills
}
