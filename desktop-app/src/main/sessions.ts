// File-based session store for AI chats. Ported from v2/electron/sessions.js.
// Storage: <userData>/sessions/<slug>/messages.json

import { app } from 'electron'
import { join } from 'path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync
} from 'fs'

const PINNED_SLUG = 'main'
const SLUG_PREFIX = 'chat-'

function getSessionsDir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function getSessionDir(slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid session slug: ${slug}`)
  }
  return join(getSessionsDir(), slug)
}

function getMessagesPath(slug: string): string {
  return join(getSessionDir(slug), 'messages.json')
}

function isValidSlug(slug: string): boolean {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > 64) {
    return false
  }
  if (slug === PINNED_SLUG) return true
  if (!slug.startsWith(SLUG_PREFIX)) return false
  const tail = slug.slice(SLUG_PREFIX.length)
  return /^\d{1,20}$/.test(tail)
}

function listSessions() {
  const dir = getSessionsDir()
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ENOENT') return []
    throw err
  }
  const out: Array<{
    slug: string
    createdAt: number
    lastActive: number
    messageCount: number
    pinned: boolean
  }> = []
  for (const name of names) {
    if (!isValidSlug(name)) continue
    const dirStat = safeStat(join(dir, name))
    if (!dirStat || !dirStat.isDirectory()) continue
    const messagesPath = getMessagesPath(name)
    const msgStat = safeStat(messagesPath)
    const lastActive = msgStat ? msgStat.mtimeMs : dirStat.mtimeMs
    const messageCount = msgStat ? readMessageCount(messagesPath) : 0
    out.push({
      slug: name,
      createdAt: dirStat.birthtimeMs || dirStat.mtimeMs,
      lastActive,
      messageCount,
      pinned: name === PINNED_SLUG
    })
  }
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.lastActive - a.lastActive
  })
  return out
}

function readMessageCount(messagesPath: string): number {
  try {
    const raw = readFileSync(messagesPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function ensureSessionDir(slug: string): string {
  const d = getSessionDir(slug)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function ensureMainSession(): string {
  const dir = ensureSessionDir(PINNED_SLUG)
  const path = join(dir, 'messages.json')
  if (!existsSync(path)) {
    writeFileSync(path, '[]\n', 'utf-8')
  }
  return PINNED_SLUG
}

function createSession() {
  ensureMainSession()
  const slug = `${SLUG_PREFIX}${Date.now()}`
  ensureSessionDir(slug)
  const path = getMessagesPath(slug)
  if (!existsSync(path)) {
    writeFileSync(path, '[]\n', 'utf-8')
  }
  return { slug }
}

function deleteSession(slug: string) {
  if (!isValidSlug(slug)) return { success: false, error: 'Invalid slug' }
  if (slug === PINNED_SLUG) {
    return { success: false, error: 'CANNOT_DELETE_PINNED' }
  }
  const dir = getSessionDir(slug)
  if (!existsSync(dir)) return { success: true }
  try {
    rmSync(dir, { recursive: true, force: true })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed'
    }
  }
}

function clearMessages(slug: string) {
  if (!isValidSlug(slug)) return { success: false, error: 'Invalid slug' }
  ensureSessionDir(slug)
  try {
    writeFileSync(getMessagesPath(slug), '[]\n', 'utf-8')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Clear failed'
    }
  }
}

function loadMessages(slug: string) {
  if (!isValidSlug(slug)) return []
  const path = getMessagesPath(slug)
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCoercibleTurn).map(coerceTurn)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ENOENT') return []
    throw err
  }
}

function saveMessages(slug: string, messages: unknown[]) {
  if (!isValidSlug(slug)) return { success: false, error: 'Invalid slug' }
  if (!Array.isArray(messages)) {
    return { success: false, error: 'messages must be an array' }
  }
  ensureSessionDir(slug)
  try {
    const safe = messages.filter(isCoercibleTurn).map(coerceTurn)
    writeFileSync(getMessagesPath(slug), JSON.stringify(safe, null, 2) + '\n', 'utf-8')
    return { success: true, count: safe.length }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Save failed'
    }
  }
}

function isCoercibleTurn(m: unknown): boolean {
  if (!m || typeof m !== 'object') return false
  const obj = m as Record<string, unknown>
  return (
    (obj.role === 'user' || obj.role === 'assistant') &&
    typeof obj.content === 'string'
  )
}

function coerceTurn(m: unknown) {
  const obj = m as Record<string, unknown>
  return {
    id: typeof obj.id === 'string' ? obj.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: obj.role,
    content: obj.content,
    timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString(),
    thinking: typeof obj.thinking === 'string' ? obj.thinking : undefined,
    modelId: typeof obj.modelId === 'string' ? obj.modelId : undefined,
    modelName: typeof obj.modelName === 'string' ? obj.modelName : undefined
  }
}

export {
  PINNED_SLUG,
  SLUG_PREFIX,
  listSessions,
  createSession,
  deleteSession,
  clearMessages,
  loadMessages,
  saveMessages,
  ensureMainSession
}
