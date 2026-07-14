// Tamaflow hyperschema + hyperdb + hyperdispatch source-of-truth.
//
// Records, collections, and dispatch routes for the P2P room worker
// (`workers/tamaflow-room.js`). The Tamaflow data plane carries:
//
//   • invites — BlindPairing invite codes (one per room)
//   • chat    — group chat messages (P2P-replicated across peers)
//   • ai-state — per-writer model metadata (which model each peer
//     has loaded, whether it's accepting requests)
//   • relay   — P2P completion routing (peer A asks peer B to run a
//     completion on peer B's local model)
//
// The previous Tamarind codebase also had `board` + `item` collections
// driving a collaborative canvas. Tamaflow drops the canvas — the
// frontend is splash + login/invite only, the worker is local-AI +
// sessions + chat. Schema mirror lives at
// `C:\Users\pisut\.claude\plans\nested-beaming-reef.md` (legacy).

const Hyperschema = require('hyperschema')
const HyperdbBuilder = require('hyperdb/builder')
const Hyperdispatch = require('hyperdispatch')

const SCHEMA_DIR = './spec/schema'
const DB_DIR = './spec/db'
const DISPATCH_DIR = './spec/dispatch'

const hyperSchema = Hyperschema.from(SCHEMA_DIR)
const schema = hyperSchema.namespace('tamaflow')

// ── Records ─────────────────────────────────────────────────────────
schema.register({
  name: 'writer',
  fields: [{ name: 'key', type: 'buffer', required: true }]
})

schema.register({
  name: 'invite',
  fields: [
    { name: 'id', type: 'buffer', required: true },
    { name: 'invite', type: 'buffer', required: true },
    { name: 'publicKey', type: 'buffer', required: true },
    { name: 'expires', type: 'int', required: true }
  ]
})

schema.register({
  name: 'chat-msg',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'text', type: 'string', required: true },
    { name: 'info', type: 'json' }
  ]
})

// Batch chat deletion — `ids` is a `string[]` of message ids to remove.
// An empty array means "clear all chat history". hyperschema doesn't
// do arrays-of-named-record for v1, so we serialise the batch as JSON.
schema.register({
  name: 'chats-remove',
  fields: [{ name: 'ids', type: 'json', required: true }]
})

// Per-writer AI state (which model each peer has loaded and
// whether it's currently accepting requests). One row per writer,
// keyed by `writerKey`. `accepting` flips to false during an in-flight
// completion so peers can see when a model is busy. `modelId` and
// `modelName` are null when no model is loaded.
schema.register({
  name: 'ai-state',
  fields: [
    { name: 'writerKey', type: 'buffer', required: true },
    { name: 'modelId', type: 'string', required: false },
    { name: 'modelName', type: 'string', required: false },
    { name: 'loadedAt', type: 'int', required: false },
    { name: 'accepting', type: 'bool', required: true }
  ]
})

// Dispatch payload for the writer's own AI state update. Mirrors
// the fields on `ai-state` plus a `_writerKey: string` (underscore
// prefix to keep it out of the collection's key namespace) that
// carries the writer's public key as a hex string. The local worker
// stamps `_writerKey` on the outbound dispatch and the route handler
// decodes it back to a Buffer for the HyperDB key encoder. We use
// `string` here (not `buffer`) because the dispatch payload is
// JSON-serialised on the pipe; a hex string survives the round-trip
// whereas a raw Buffer would need base64 wrapping.
//
// SCHEMA CHANGES: We're greenfield — no production data to preserve.
// When you change ANY dispatch or collection schema (add/remove/
// rename/reorder fields), wipe the local storage dirs before
// restarting:
//   npm run clean:storage
// Compact-encoding is positional, so any schema change breaks the
// decoder for old on-disk bytes. Don't ship a schema change
// without also telling the user to wipe.
schema.register({
  name: 'ai-state-update',
  fields: [
    { name: '_writerKey', type: 'string', required: false },
    { name: 'modelId', type: 'string', required: false },
    { name: 'modelName', type: 'string', required: false },
    { name: 'loadedAt', type: 'int', required: false },
    { name: 'accepting', type: 'bool', required: true }
  ]
})

// P2P completion routing. A requester encodes a chat-completion
// payload and pins it at the owner's writer key. The owner runs the
// local inference and streams the result back as a sequence of
// `relay-response` records with the same `requestId`. We do NOT
// include `messages` in the `relay-response` because the requester
// already has them — only deltas/error/done are echoed back.
schema.register({
  name: 'relay-request',
  fields: [
    { name: 'requestId', type: 'string', required: true },
    { name: 'fromKey', type: 'buffer', required: true },
    { name: 'toKey', type: 'buffer', required: true },
    { name: 'messages', type: 'json', required: true },
    { name: 'modelId', type: 'string', required: true },
    { name: 'createdAt', type: 'int', required: true }
  ]
})

schema.register({
  name: 'relay-response',
  fields: [
    { name: 'requestId', type: 'string', required: true },
    { name: 'fromKey', type: 'buffer', required: true },
    { name: 'toKey', type: 'buffer', required: true },
    { name: 'kind', type: 'string', required: true },
    { name: 'text', type: 'string', required: false },
    { name: 'error', type: 'json', required: false }
  ]
})

schema.register({
  name: 'relay-cancel',
  fields: [
    { name: 'requestId', type: 'string', required: true },
    { name: 'fromKey', type: 'buffer', required: true },
    { name: 'toKey', type: 'buffer', required: true }
  ]
})

Hyperschema.toDisk(hyperSchema)

// ── Collections ─────────────────────────────────────────────────────
const hyperdb = HyperdbBuilder.from(SCHEMA_DIR, DB_DIR)
const db = hyperdb.namespace('tamaflow')

db.collections.register({
  name: 'chat',
  schema: '@tamaflow/chat-msg',
  key: ['id']
})

db.collections.register({
  name: 'invites',
  schema: '@tamaflow/invite',
  key: ['id']
})

// Per-writer AI state. One row per writer key; the worker upserts
// this whenever the local writer's AI state changes.
db.collections.register({
  name: 'ai-state',
  schema: '@tamaflow/ai-state',
  key: ['writerKey']
})

// P2P completion relay. We index both `relay-request` and
// `relay-response` by `requestId` so the worker can scan a specific
// in-flight request efficiently. The `relay-cancel` row is consumed
// once and removed by the owner.
db.collections.register({
  name: 'relay-request',
  schema: '@tamaflow/relay-request',
  key: ['requestId']
})

db.collections.register({
  name: 'relay-response',
  schema: '@tamaflow/relay-response',
  key: ['requestId', 'fromKey']
})

db.collections.register({
  name: 'relay-cancel',
  schema: '@tamaflow/relay-cancel',
  key: ['requestId']
})

HyperdbBuilder.toDisk(hyperdb)

// ── Dispatch routes ────────────────────────────────────────────────
// Chat + invite plumbing + AI state + P2P completion relay. No board
// / item routes — the Tamaflow data plane does not carry a canvas.
const hyperdispatch = Hyperdispatch.from(SCHEMA_DIR, DISPATCH_DIR, { offset: 0 })
const dispatch = hyperdispatch.namespace('tamaflow')

dispatch.register({ name: 'add-invite', requestType: '@tamaflow/invite' })

dispatch.register({ name: 'add-chat', requestType: '@tamaflow/chat-msg' })
dispatch.register({ name: 'remove-chats', requestType: '@tamaflow/chats-remove' })

dispatch.register({ name: 'update-ai-state', requestType: '@tamaflow/ai-state-update' })
dispatch.register({ name: 'relay-request', requestType: '@tamaflow/relay-request' })
dispatch.register({ name: 'relay-response', requestType: '@tamaflow/relay-response' })
dispatch.register({ name: 'relay-cancel', requestType: '@tamaflow/relay-cancel' })

dispatch.register({ name: 'add-writer', requestType: '@tamaflow/writer' })

Hyperdispatch.toDisk(hyperdispatch)
