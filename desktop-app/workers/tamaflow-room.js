// TamaflowRoom — the data plane for a Tamaflow P2P session.
//
// Wraps an encrypted Autobase with a HyperDB view of four collections
// (chat, invites, ai-state, relay-*) and BlindPairing for inviting new
// peers. The previous Tamarind codebase also carried a `board` +
// `item` collection driving a collaborative canvas; Tamaflow drops
// the canvas and keeps only the chat + per-writer AI state + P2P
// completion relay.
//
// Lifecycle: ReadyResource — caller awaits `room.ready()` before
// assuming the Autobase is writable.

const Autobase = require('autobase')
const b4a = require('b4a')
const BlindPairing = require('blind-pairing')
const HyperDB = require('hyperdb')
const ReadyResource = require('ready-resource')
const z32 = require('z32')

const TamaflowDispatch = require('../spec/dispatch')
const TamaflowDb = require('../spec/db')

class TamaflowRoom extends ReadyResource {
  constructor(store, swarm, invite) {
    super()

    this.store = store
    this.swarm = swarm
    this.invite = invite

    this.pairing = new BlindPairing(swarm)

    this.router = new TamaflowDispatch.Router()
    this._setupRouter()

    this.localBase = Autobase.getLocalCore(this.store)
    this.base = null
    this.pairMember = null
  }

  async _open() {
    await this.localBase.ready()
    const localKey = this.localBase.key
    const isEmpty = this.localBase.length === 0

    let key
    let encryptionKey
    if (isEmpty && this.invite) {
      const res = await new Promise((resolve) => {
        this.pairing.addCandidate({
          invite: z32.decode(this.invite),
          userData: localKey,
          onadd: resolve
        })
      })
      key = res.key
      encryptionKey = res.encryptionKey
    }

    await this.localBase.close()
    this.base = new Autobase(this.store, key, {
      encrypt: true,
      encryptionKey,
      open: this._openBase.bind(this),
      close: this._closeBase.bind(this),
      apply: this._applyBase.bind(this)
    })

    const writablePromise = new Promise((resolve) => {
      this.base.on('update', () => {
        if (this.base.writable) resolve()
        if (!this.base._interrupting) this.emit('update')
      })
    })
    await this.base.ready()
    this.swarm.join(this.base.discoveryKey)
    if (!this.base.writable) await writablePromise

    this.view.core.download({ start: 0, end: -1 })

    // Pair-add without a dispatch: the previous Tamarind design used
    // a `@tamarind/add-writer` route to broadcast the new writer's
    // key. Tamaflow drops that — new peers join via BlindPairing
    // only, and writer-set membership is part of the Autobase CRDT
    // (calling `base.addWriter` locally syncs to every connected
    // peer through the normal Autobase update). The new peer's own
    // local core is added by the Autobase constructor.
    this.pairMember = this.pairing.addMember({
      discoveryKey: this.base.discoveryKey,
      onadd: async (request) => {
        const inv = await this.view.findOne('@tamaflow/invites', { id: request.inviteId })
        if (!inv) return
        request.open(inv.publicKey)
        await this.base.addWriter(request.userData)
        request.confirm({
          key: this.base.key,
          encryptionKey: this.base.encryptionKey
        })
      }
    })
  }

  async _close() {
    await this.pairMember?.close()
    await this.base?.close()
    await this.localBase.close()
    await this.pairing.close()
  }

  _openBase(store) {
    return HyperDB.bee(store.get('view'), TamaflowDb, { extension: false, autoUpdate: true })
  }

  async _closeBase(view) {
    await view.close()
  }

  async _applyBase(nodes, view, base) {
    for (const node of nodes) {
      console.log(
        `[tamaflow-room] apply node (length=${base.length}, value=${JSON.stringify(node.value).slice(0, 80)})`
      )
      await this.router.dispatch(node.value, { view, base })
    }
    await view.flush()
  }

  _setupRouter() {
    // Invite plumbing. The first invite is minted by the host
    // (see `getInvite`) and replicated to every peer that joins
    // afterwards. New peers look up the invite by id when a pairing
    // request lands (see `pairMember` above).
    this.router.add('@tamaflow/add-invite', async (data, context) => {
      await context.view.insert('@tamaflow/invites', data)
    })

    // Group chat. `add-chat` is the regular send; `remove-chats`
    // is a batch delete (empty `ids` = clear all). Mirrors the
    // canvasReducer's split that Tamarind used for chat-per-board
    // messages.
    this.router.add('@tamaflow/add-chat', async (data, context) => {
      await context.view.insert('@tamaflow/chat', data)
    })
    this.router.add('@tamaflow/remove-chats', async (data, context) => {
      // Batch chat deletion. `data.ids` is a JSON array of message
      // ids. An empty array means "clear all" — the worker walks
      // the whole collection and deletes every message. Anything
      // that isn't a string array is ignored (defensive — renderer
      // validates but the worker shouldn't crash on malformed
      // frames).
      const ids = Array.isArray(data.ids) ? data.ids : null
      if (ids === null) return
      if (ids.length === 0) {
        const all = await context.view.find('@tamaflow/chat', {}).toArray()
        for (const m of all) {
          await context.view.delete('@tamaflow/chat', { id: m.id })
        }
        return
      }
      // Specific ids — delete each. Missing ids are no-ops.
      for (const id of ids) {
        if (typeof id !== 'string') continue
        await context.view.delete('@tamaflow/chat', { id })
      }
    })

    // Per-writer AI state. `data._writerKey` is the local writer's
    // public key encoded as a hex string (the underscore prefix
    // avoids the schema's `writerKey: buffer` field, which would
    // otherwise force us to ship a Buffer through the dispatch
    // payload). Convert back to a Buffer here for the HyperDB key
    // encoder.
    //
    // Upsert by writerKey: if no row exists yet (first push from
    // this writer), insert. Otherwise apply the update.
    this.router.add('@tamaflow/update-ai-state', async (data, context) => {
      if (typeof data._writerKey !== 'string' || data._writerKey.length === 0) {
        // `_writerKey` is required by the protocol — the local
        // worker always stamps it in `appendAiState`. If it's
        // missing here, either the dispatch schema lost the field
        // (silently dropped by the encoder) or something upstream
        // stripped it. Either way, refusing to insert is better
        // than inserting an empty Buffer that no peer can match
        // against. Logged loudly so the regression is visible in
        // the worker console.
        console.error(
          '[tamaflow-room] update-ai-state: missing _writerKey in dispatch payload, refusing to insert'
        )
        return
      }
      const writerKey = b4a.from(data._writerKey, 'hex')
      const next = {
        writerKey,
        modelId: data.modelId ?? null,
        modelName: data.modelName ?? null,
        loadedAt: data.loadedAt ?? null,
        accepting: !!data.accepting
      }
      const existing = await context.view.get('@tamaflow/ai-state', { writerKey })
      if (existing) {
        // No update helper in HyperDB — the ai-state fields are
        // all replaced atomically, so get → mutate → delete →
        // insert is safe (single-writer, single row per writer).
        await context.view.delete('@tamaflow/ai-state', { writerKey })
      }
      await context.view.insert('@tamaflow/ai-state', next)
    })

    // P2P completion relay. The route handlers run inside the
    // worker (not in main), so the actual `completion()` call has
    // to bounce through main via a `relay-run` frame. The route's
    // job is just to forward — `onRelayRequest` and
    // `onRelayResponse` are wired in the entry file.
    this.router.add('@tamaflow/relay-request', async (data, context) => {
      if (typeof this.onRelayRequest === 'function') {
        this.onRelayRequest(data)
      }
    })
    this.router.add('@tamaflow/relay-response', async (data, context) => {
      if (typeof this.onRelayResponse === 'function') {
        this.onRelayResponse(data)
      }
    })
    this.router.add('@tamaflow/relay-cancel', async (data, context) => {
      if (typeof this.onRelayCancel === 'function') {
        this.onRelayCancel(data)
      }
    })
  }

  get view() {
    return this.base.view
  }

  // Idempotent — returns the existing invite if one is already
  // persisted, otherwise mints a fresh one.
  async getInvite() {
    const existing = await this.view.findOne('@tamaflow/invites', {})
    if (existing) return z32.encode(existing.invite)
    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key)
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/add-invite', { id, invite, publicKey, expires })
    )
    return z32.encode(invite)
  }

  // `null` until the Autobase is ready (matches `base.writable` from
  // the caller).
  isWritable() {
    return Boolean(this.base && this.base.writable)
  }

  async getMessages({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@tamaflow/chat', { reverse, limit }).toArray()
  }

  // Append the local writer's AI state. Stamps the `writerKey`
  // from `this.localBase.key` so the row is always keyed by the
  // writer that produced the dispatch.
  async appendAiState({ modelId, modelName, loadedAt, accepting }) {
    const writerKey = b4a.toString(this.localBase.key, 'hex')
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/update-ai-state', {
        _writerKey: writerKey,
        modelId: modelId ?? null,
        modelName: modelName ?? null,
        loadedAt: loadedAt ?? null,
        accepting: !!accepting
      })
    )
  }

  // Read every `@tamaflow/ai-state` row. Returned as
  // {writerKey, modelId, modelName, loadedAt, accepting}; the
  // `writerKey` is the hex writer pubkey. The entry file maps to
  // z32 for chat-attribution parity.
  async getAiStates() {
    const rows = await this.view.find('@tamaflow/ai-state', {}).toArray()
    return rows.map((r) => ({
      writerKey: b4a.toString(r.writerKey, 'hex'),
      modelId: r.modelId ?? null,
      modelName: r.modelName ?? null,
      loadedAt: r.loadedAt ?? null,
      accepting: !!r.accepting
    }))
  }

  // Append a relay request addressed to a specific writer. The
  // owner's worker route handler picks it up and writes a
  // `relay-run` frame to its main process.
  async appendRelayRequest({ requestId, fromKey, toKey, messages, modelId }) {
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/relay-request', {
        requestId,
        fromKey: b4a.from(fromKey, 'hex'),
        toKey: b4a.from(toKey, 'hex'),
        messages,
        modelId,
        createdAt: Date.now()
      })
    )
  }

  async appendRelayResponse({ requestId, fromKey, toKey, kind, text, error }) {
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/relay-response', {
        requestId,
        fromKey: b4a.from(fromKey, 'hex'),
        toKey: b4a.from(toKey, 'hex'),
        kind,
        text: text ?? null,
        error: error ?? null
      })
    )
  }

  async appendRelayCancel({ requestId, fromKey, toKey }) {
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/relay-cancel', {
        requestId,
        fromKey: b4a.from(fromKey, 'hex'),
        toKey: b4a.from(toKey, 'hex')
      })
    )
  }

  // Per-message + clear-all chat deletion. Empty `ids` means
  // "clear all". The router handler in `_setupRouter` does the
  // actual work; this helper exists so the worker entry can fire
  // the same encoded route that any other peer would emit.
  async appendRemoveChats(ids) {
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/remove-chats', { ids: ids.slice() })
    )
  }

  async addMessage(text, info) {
    const id = Math.random().toString(16).slice(2)
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/add-chat', { id, text, info })
    )
  }
}

module.exports = TamaflowRoom
