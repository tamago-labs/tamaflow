// Tamaflow room-worker entrypoint. Lives in Bare (pear-runtime
// worker process spawned by `electron/main.js`). Owns the data plane:
//
//   • Corestore  (Autobase + Hyperswarm replication on disk)
//   • Hyperswarm (peer discovery; replicates the store on every conn)
//   • TamaflowRoom (encrypted Autobase + BlindPairing)
//   • Identity (writer key + display name → identity.json on disk)
//   • IPC pipe (FramedStream over Bare.IPC → framed JSON to renderer)
//
// Renderer-side counterpart: `renderer/src/hooks/useRoom.ts`. Wire
// protocol documented in
// `C:\Users\pisut\.claude\plans\nested-beaming-reef.md` (legacy).
//
// Tamaflow drops the Tamarind canvas: no `snapshot` event, no
// `state-action` frames, no default-board bootstrap. The worker
// still owns chat (P2P), per-writer AI state (so peers see each
// other's loaded models), and the P2P completion relay.

const Autobase = require('autobase')
const b4a = require('b4a')
const Corestore = require('corestore')
const debounce = require('debounceify')
const FramedStream = require('framed-stream')
const fs = require('bare-fs')
const goodbye = require('graceful-goodbye')
const Hyperswarm = require('hyperswarm')
const path = require('bare-path')
const ReadyResource = require('ready-resource')
const { command, flag } = require('paparam')
const z32 = require('z32')

const TamaflowRoom = require('./tamaflow-room')

const cmd = command(
  'tamaflow-room',
  flag('--name|-n <name>', 'Your display name'),
  flag('--invite|-i <invite>', 'Invite code to join an existing room'),
  flag('--writer <hex>', 'Override the writer key (hex)')
)

// argv layout from electron/main.js `getWorker()`:
//   argv[0]      = bare binary
//   argv[1]      = path to this entry script
//   argv[2]      = storage dir (read below)
//   argv[3..7]   = 5 more positional args shared with the updater worker:
//                    [appPath, updates, version, upgrade, productName+ext]
//   argv[8..]    = room-worker flags: [--name N] [--invite Z] [--writer H]
// paparam must only see the flag tail — feeding it the updater
// positionals triggers `Bail: UNKNOWN_ARG` on the first non-flag
// (e.g. 'null'). Locate the first `--flag` so we don't hardcode a
// slice index that would drift if `getWorker()` adds or removes a
// positional later.
const storage = path.join(Bare.argv[2], 'app-storage')
const identityPath = path.join(Bare.argv[2], 'identity.json')
const firstFlag = Bare.argv.findIndex((a, i) => i >= 3 && a.startsWith('-'))
const flagArgs = firstFlag >= 0 ? Bare.argv.slice(firstFlag) : []
cmd.parse(flagArgs)
const initialName = cmd.flags.name || null
const initialInvite = cmd.flags.invite || null
const writerOverride = cmd.flags.writer || null

class TamaflowRoomWorkerTask extends ReadyResource {
  constructor(pipe, opts = {}) {
    super()
    this.pipe = pipe
    this.storage = storage
    this._initialInvite = opts.invite
    this._requestedName = opts.name

    this.identity = null // { key: Buffer (writer pubkey), name: string }
    this.peers = 0

    this.store = new Corestore(storage)
    this.swarm = new Hyperswarm()
    this.swarm.on('connection', (conn) => {
      console.log(`[tamaflow-room] swarm connection opened (peers=${this.peers + 1})`)
      this.store.replicate(conn)
      this._peers(1)
      conn.once('close', () => {
        console.log(`[tamaflow-room] swarm connection closed (peers=${this.peers - 1})`)
        this._peers(-1)
      })
    })

    this.room = new TamaflowRoom(this.store, this.swarm, this._initialInvite)
    // Alias for the local writer's keypair. The actual instance
    // lives on the room (`this.room.localBase`); aliasing here so
    // `this.localBase.key` works the same in the entry file as it
    // does in `tamaflow-room.js` itself.
    this.localBase = this.room.localBase
    this.debounceBroadcast = debounce(() => this._broadcast())
    this.room.on('update', () => this.debounceBroadcast())
  }

  async _open() {
    await this.store.ready()
    await this.room.ready()
    await this._loadIdentity()

    // Tell the renderer about the writer's stable pubkey + display
    // name. Used by GroupChatPanel to label "You" for messages from
    // this writer. The key MUST be `this.localBase.key` (not
    // `this.identity.key`) so the renderer's `me.key` matches the
    // writer key broadcast in `peerAiStates` (which is keyed by
    // `localBase.key` in `appendAiState`).
    this.pipe.write(
      JSON.stringify({
        type: 'me',
        key: z32.encode(this.localBase.key),
        name: this.identity.name
      })
    )

    // Push the invite code as soon as the room is open. Idempotent —
    // if the host reloads, the same invite comes back; if a guest
    // joined, the host still mints one for newcomers.
    this.pipe.write(JSON.stringify({ type: 'invite', invite: await this.room.getInvite() }))
    // Role detection: a worker launched with an `--invite` joined an
    // existing room (guest). A worker with no `--invite` minted a
    // fresh room and is its host.
    const role = this._initialInvite ? 'guest' : 'host'
    console.log(
      `[tamaflow-room] role resolved: ${role} (initialInvite=${this._initialInvite ? 'set' : 'null'})`
    )
    this.pipe.write(JSON.stringify({ type: 'role', role, writable: this.room.isWritable() }))
    this.pipe.write(JSON.stringify({ type: 'status', phase: 'ready' }))

    // Listen for renderer frames.
    this.pipe.on('data', (data) => {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch (err) {
        console.error('[tamaflow-room] malformed frame:', err)
        return
      }
      console.log(
        `[tamaflow-room] frame: type=${message && message.type}`,
        message && message.type === 'relay-request'
          ? `requestId=${message.requestId}`
          : ''
      )
      // These frames come from main (not the renderer) and trigger
      // P2P actions on the local writer's behalf.
      if (message && message.type === 'ai-state-snapshot') {
        this.room
          .appendAiState(message.snapshot || {})
          .then(() => this.debounceBroadcast())
          .catch((err) => console.error('[tamaflow-room] appendAiState failed:', err))
        return
      }
      if (message && message.type === 'relay-request') {
        console.log(
          '[tamaflow-room] relay: appendRelayRequest',
          JSON.stringify({
            requestId: message.requestId,
            toKey: (message.toKey || '').slice(0, 8)
          }).slice(0, 200)
        )
        this.room
          .appendRelayRequest(message)
          .catch((err) => console.error('[tamaflow-room] appendRelayRequest failed:', err))
        return
      }
      if (message && message.type === 'relay-response') {
        // The host (or whoever is running the completion) sends a
        // `relay-response` pipe frame per token / kind / done. We
        // append it to the Autobase as a `@tamaflow/relay-response`
        // dispatch so the requester can read it back via the
        // `onRelayResponse` route handler. Without this handler the
        // host's response stream is silently dropped — the
        // requester never sees any tokens.
        console.log(
          '[tamaflow-room] relay: appendRelayResponse',
          JSON.stringify({ requestId: message.requestId, kind: message.kind }).slice(0, 200)
        )
        this.room
          .appendRelayResponse(message)
          .catch((err) => console.error('[tamaflow-room] appendRelayResponse failed:', err))
        return
      }
      if (message && message.type === 'relay-cancel') {
        console.log(
          '[tamaflow-room] relay: appendRelayCancel',
          JSON.stringify({ requestId: message.requestId }).slice(0, 200)
        )
        this.room
          .appendRelayCancel(message)
          .catch((err) => console.error('[tamaflow-room] appendRelayCancel failed:', err))
        return
      }
      this._onFrame(message).catch((err) => {
        console.error('[tamaflow-room] _onFrame threw:', err)
        this.pipe.write(JSON.stringify({ type: 'status', phase: 'error', error: err.message }))
      })
    })

    // Relay route handlers. When a peer's `relay-request` lands at
    // this writer (`toKey === myKey`), ask main to run a local
    // completion. When a `relay-response` from a peer arrives,
    // forward to main so it can push to the renderer's
    // `ai:chat:relay-event` channel.
    //
    // The dispatch decoder returns **Buffer** for `buffer`-typed
    // fields. The local identity key is a Buffer too. We compare
    // buffers directly — DON'T compare to `z32.encode(...)` because
    // that would compare a Buffer to a string, which is always
    // false and would silently drop every relay request.
    this.room.onRelayRequest = (data) => {
      const myKey = this.localBase.key
      if (!b4a.equals(data.toKey, myKey)) {
        console.log(
          '[tamaflow-room] relay: onRelayRequest not for me',
          JSON.stringify({
            requestId: data.requestId,
            myKey: z32.encode(myKey).slice(0, 8),
            toKey: z32.encode(data.toKey).slice(0, 8)
          }).slice(0, 200)
        )
        return
      }
      console.log(
        '[tamaflow-room] relay: onRelayRequest matched',
        JSON.stringify({
          requestId: data.requestId,
          fromKey: z32.encode(data.fromKey).slice(0, 8)
        }).slice(0, 200)
      )
      this.pipe.write(
        JSON.stringify({
          type: 'relay-run',
          requestId: data.requestId,
          // Send the fromKey as z32 — main keeps the canonical
          // writer-key in z32 form for chat-attribution parity.
          fromKey: z32.encode(data.fromKey),
          messages: data.messages,
          modelId: data.modelId
        })
      )
    }
    this.room.onRelayResponse = (data) => {
      // I'm the requester. Push the event to the renderer via main.
      console.log(
        '[tamaflow-room] relay: onRelayResponse (I am requester)',
        JSON.stringify({ requestId: data.requestId, kind: data.kind }).slice(0, 200)
      )
      this.pipe.write(
        JSON.stringify({
          type: 'relay-event',
          requestId: data.requestId,
          kind: data.kind,
          text: data.text ?? null,
          error: data.error ?? null
        })
      )
    }
    this.room.onRelayCancel = (data) => {
      const myKey = this.localBase.key
      if (!b4a.equals(data.toKey, myKey)) {
        console.log(
          '[tamaflow-room] relay: onRelayCancel not for me',
          JSON.stringify({
            requestId: data.requestId,
            myKey: z32.encode(myKey).slice(0, 8),
            toKey: z32.encode(data.toKey).slice(0, 8)
          }).slice(0, 200)
        )
        return
      }
      console.log(
        '[tamaflow-room] relay: onRelayCancel matched',
        JSON.stringify({ requestId: data.requestId }).slice(0, 200)
      )
      this.pipe.write(JSON.stringify({ type: 'relay-cancel', requestId: data.requestId }))
    }

    await this._broadcast()
  }

  async _close() {
    await this.room.close()
    await this.swarm.destroy()
    await this.store.close()
  }

  async _onFrame(message) {
    switch (message.type) {
      case 'send-chat':
        await this.room.addMessage(message.text, {
          name: this.identity.name,
          // Use `localBase.key` so the chat's `info.key` matches the
          // local writer's `me.key` (also `localBase.key`).
          key: z32.encode(this.localBase.key),
          at: Date.now()
        })
        return
      case 'remove-chats':
        // ids=[] means "clear all", ids=[id1, ...] means delete
        // those. Permission model is "if you can append, you can
        // delete" — same as send-chat above.
        if (!Array.isArray(message.ids)) return
        await this.room.appendRemoveChats(message.ids)
        return
      case 'join-invite':
        // Joining after open is a no-op in v1 (a guest must restart
        // with --invite). Stays as a stub so the renderer can call
        // it without a runtime crash.
        return
      case 'create-invite':
        // Always returns the existing invite in v1.
        this.pipe.write(
          JSON.stringify({ type: 'invite', invite: await this.room.getInvite() })
        )
        return
      case 'rename-self':
        this.identity.name = message.name || this.identity.name
        await this._persistIdentity()
        // Re-push the `me` event so the renderer's `useRoom.me`
        // updates and the splash's "Signed in as <name>" label
        // reflects the rename immediately. Otherwise `me` stays at
        // its boot-time value (the writer-pubkey-derived default)
        // until the next worker restart.
        this.pipe.write(
          JSON.stringify({
            type: 'me',
            key: z32.encode(this.localBase.key),
            name: this.identity.name
          })
        )
        return
      case 'send-payslip':
        // Payslip delivery. The renderer sends the full payslip
        // payload; the worker appends it to the Autobase so all
        // peers can replicate it.
        if (!message.data) return
        await this.room.appendPayslip(message.data)
        return
      default:
        return
    }
  }

  async _broadcast() {
    try {
      const [messages, aiStatesRaw, payslips] = await Promise.all([
        this.room.getMessages(),
        this.room.getAiStates(),
        this.room.getPayslips()
      ])
      messages.sort((a, b) => {
        const aAt = a.info?.at ?? 0
        const bAt = b.info?.at ?? 0
        return aAt - bAt
      })
      // Map writerKey from hex (storage format) to z32
      // (chat-attribution format) so the renderer can join against
      // `useRoom.me.key` without an extra lookup.
      const aiStates = aiStatesRaw.map((s) => ({
        writerKey: z32.encode(b4a.from(s.writerKey, 'hex')),
        modelId: s.modelId,
        modelName: s.modelName,
        loadedAt: s.loadedAt,
        accepting: s.accepting
      }))
      console.log(
        `[tamaflow-room] _broadcast emit (peers=${this.peers}, chat=${messages.length}, ai=${aiStates.length})`
      )
      this.pipe.write(JSON.stringify({ type: 'chat', messages }))
      this.pipe.write(JSON.stringify({ type: 'ai-states', states: aiStates }))
      this.pipe.write(JSON.stringify({ type: 'payslips', payslips }))
    } catch (err) {
      this.pipe.write(JSON.stringify({ type: 'status', phase: 'error', error: err.message }))
    }
  }

  _peers(delta) {
    this.peers = Math.max(0, this.peers + delta)
    this.pipe.write(JSON.stringify({ type: 'peers', count: this.peers }))
  }

  // Load the display name from <userData>/identity.json if it
  // exists, otherwise pick a default based on the local writer's
  // key suffix. The writer key is **not** persisted here — it's
  // `this.localBase.key` everywhere.
  async _loadIdentity() {
    if (writerOverride) {
      // `--writer <hex>` still wins. The identity here is treated
      // as a display-only name; the actual writer key for routing
      // is `this.localBase.key` (set up via Corestore).
      const key = Buffer.from(writerOverride, 'hex')
      if (key.length !== 32) throw new Error('writer override must be 32-byte hex')
      this.identity = {
        key,
        name: this._requestedName || `User-${key.toString('hex').slice(-4)}`
      }
      return
    }
    let existing = null
    try {
      const raw = await fs.promises.readFile(identityPath)
      existing = JSON.parse(raw.toString())
    } catch {
      existing = null
    }
    const persistedName = existing && typeof existing.name === 'string' ? existing.name : null
    const defaultSuffix = this.localBase.key.toString('hex').slice(-4)
    this.identity = {
      key: this.localBase.key,
      name: this._requestedName || persistedName || `User-${defaultSuffix}`
    }
    // Persist the display name on first boot so the same name
    // shows up across launches. The key is `this.localBase.key`
    // (not stored) — it's regenerated by Corestore if storage is
    // wiped, so storing it would be stale on the next boot anyway.
    if (!persistedName) {
      await this._persistIdentity()
    }
  }

  async _persistIdentity() {
    // Only persist the display name — the writer key is
    // `this.localBase.key`, regenerated by Corestore if storage is
    // wiped. Storing the key would just leave a stale field in the
    // JSON for a future bug to read.
    const tmp = identityPath + '.tmp'
    await fs.promises.writeFile(tmp, JSON.stringify({ name: this.identity.name }))
    await fs.promises.rename(tmp, identityPath)
  }
}

async function main() {
  const pipe = new FramedStream(Bare.IPC)
  pipe.pause()

  // Build / load the userData dir up-front so identity.json has
  // somewhere to land before the worker task opens.
  await fs.promises.mkdir(storage, { recursive: true })
  await fs.promises.mkdir(path.dirname(identityPath), { recursive: true })

  // When this worker was spawned with --invite (host → guest
  // mid-session swap via the splash's "Join existing board" toggle)
  // the local Corestore may already have an Autobase from the
  // previous host-mode boot. TamaflowRoom's `addCandidate` branch
  // is gated on an empty local core (see tamaflow-room.js) — so
  // without this wipe, the new worker would skip the actual join
  // and stay on its old local key with role=guest + 0 peers.
  // Wiping the Corestore directory before constructing the task
  // forces addCandidate to actually run. `identity.json` lives
  // outside `app-storage` so the writer key + display name
  // survive the wipe.
  if (initialInvite) {
    const probeStore = new Corestore(storage)
    const probe = Autobase.getLocalCore(probeStore)
    await probe.ready()
    const len = probe.length
    await probe.close()
    await probeStore.close()
    if (len > 0) {
      console.log(`[tamaflow-room] wiping local storage (length=${len}) to honor --invite`)
      await fs.promises.rm(storage, { recursive: true, force: true })
      await fs.promises.mkdir(storage, { recursive: true })
    }
  }

  const task = new TamaflowRoomWorkerTask(pipe, {
    invite: initialInvite,
    name: initialName
  })
  goodbye(() => task.close())

  await task.ready()
  pipe.resume()

  console.log(`[tamaflow-room] storage: ${storage}`)
  console.log(`[tamaflow-room] invite: ${await task.room.getInvite()}`)
}

main().catch((err) => {
  console.error('[tamaflow-room] fatal:', err)
  Bare.exit(1)
})
