// CLI API client for TamaFlow Employee CLI
// Connects to localhost:3001 (employee-cli)

const CLI_URL = 'http://localhost:3001'

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CLI error: ${res.status} ${text}`)
  }
  return res.json()
}

export const cli = {
  wallet: {
    status: () => fetchJson(`${CLI_URL}/api/wallet/status`),
    create: () => fetchJson(`${CLI_URL}/api/wallet/create`, { method: 'POST' }),
    faucet: (amount?: string) => fetchJson(`${CLI_URL}/api/wallet/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    }),
  },

  account: {
    info: () => fetchJson(`${CLI_URL}/api/account`),
  },

  holdings: {
    list: () => fetchJson(`${CLI_URL}/api/holdings`),
  },

  contracts: {
    query: (templateId?: string) =>
      fetchJson(`${CLI_URL}/api/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId })
      }),
    exercise: (templateId: string, contractId: string, choice: string, args: unknown) =>
      fetchJson(`${CLI_URL}/api/contracts/exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, contractId, choice, choiceArgument: args })
      }),
  },

  room: {
    status: () => fetchJson(`${CLI_URL}/api/room/status`),
    connect: (invite: string) =>
      fetchJson(`${CLI_URL}/api/room/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite })
      }),
  },

  chat: {
    list: () => fetchJson(`${CLI_URL}/api/chat`),
  },

  health: () => fetchJson(`${CLI_URL}/api/health`),
}

export default cli
