// PearP2P — TamaflowRoom guest client for employee-cli.
//
// Joins an existing room via BlindPairing invite code.
// Runs in Node.js (not Bare), so uses Node.js fs instead of bare-fs.
// Always operates as guest (never hosts).

const Autobase = require('autobase')
const b4a = require('b4a')
const BlindPairing = require('blind-pairing')
const Corestore = require('corestore')
const debounce = require('debounceify')
const fs = require('fs')
const Hyperswarm = require('hyperswarm')
const os = require('os')
const path = require('path')
const z32 = require('z32')

const TamaflowDispatch = require('../spec/dispatch')
const TamaflowDb = require('../spec/db')
const HyperDB = require('hyperdb')
const ReadyResource = require('ready-resource')

// ============================================
// TamaflowRoom (simplified for CLI guest use)
// ============================================

class CliTamaflowRoom extends ReadyResource {
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

    // Event handlers (set by PearP2P)
    this.onMessage = null
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
  }

  async _close() {
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
      await this.router.dispatch(node.value, { view, base })
    }
    await view.flush()
  }

  _setupRouter() {
    this.router.add('@tamaflow/add-writer', async (data, context) => {
      await context.base.addWriter(data.key)
    })
    this.router.add('@tamaflow/add-invite', async (data, context) => {
      await context.view.insert('@tamaflow/invites', data)
    })
    this.router.add('@tamaflow/add-chat', async (data, context) => {
      await context.view.insert('@tamaflow/chat', data)
      if (typeof this.onMessage === 'function') {
        this.onMessage(data)
      }
    })
    this.router.add('@tamaflow/remove-chats', async (data, context) => {
      const ids = Array.isArray(data.ids) ? data.ids : null
      if (ids === null) return
      if (ids.length === 0) {
        const all = await context.view.find('@tamaflow/chat', {}).toArray()
        for (const m of all) {
          await context.view.delete('@tamaflow/chat', { id: m.id })
        }
        return
      }
      for (const id of ids) {
        if (typeof id !== 'string') continue
        await context.view.delete('@tamaflow/chat', { id })
      }
    })
    this.router.add('@tamaflow/update-ai-state', async () => {})
    this.router.add('@tamaflow/relay-request', async () => {})
    this.router.add('@tamaflow/relay-response', async () => {})
    this.router.add('@tamaflow/relay-cancel', async () => {})
  }

  get view() {
    return this.base.view
  }

  isWritable() {
    return Boolean(this.base && this.base.writable)
  }

  async getMessages({ reverse = true, limit = 100 } = {}) {
    return await this.view.find('@tamaflow/chat', { reverse, limit }).toArray()
  }

  async addMessage(text, info) {
    const id = Math.random().toString(16).slice(2)
    await this.base.append(
      TamaflowDispatch.encode('@tamaflow/add-chat', { id, text, info })
    )
  }
}

// ============================================
// PearP2P — Express-backed P2P client
// ============================================

class PearP2P {
  constructor(storageDir) {
    this.storageDir = storageDir || path.join(os.homedir(), '.tamaflow-cli')
    this.store = null
    this.swarm = null
    this.room = null
    this.connected = false
    this.role = 'guest'
    this.peers = 0
    this.invite = null
    this.identity = { name: 'Employee' }
    this.chatMessages = []
    this.payslips = []

    // Debounced broadcast to update payslips on Autobase changes
    this._debouncedRefresh = debounce(() => this._refreshPayslips(), 500)
  }

  setName(name) {
    if (name && typeof name === 'string') {
      this.identity.name = name.trim() || 'Employee'
      console.log('[pear] Identity name set to:', this.identity.name)
    }
  }

  async connect(inviteCode) {
    if (!inviteCode) throw new Error('Invite code required')

    // Initialize Corestore + Hyperswarm
    await fs.promises.mkdir(this.storageDir, { recursive: true })
    this.store = new Corestore(this.storageDir)
    await this.store.ready()

    this.swarm = new Hyperswarm()
    this.swarm.on('connection', (conn) => {
      console.log('[pear] swarm connection opened')
      this.store.replicate(conn)
      this.peers++
      conn.once('close', () => {
        this.peers--
        console.log(`[pear] swarm connection closed (peers=${this.peers})`)
      })
    })

    // Create and join the room as guest
    this.room = new CliTamaflowRoom(this.store, this.swarm, inviteCode)

    // Listen for incoming messages (payslips arrive as chat messages)
    this.room.onMessage = (msg) => {
      console.log('[pear] incoming message:', msg.text?.slice(0, 100))
      this.chatMessages.push(msg)
      // Check if this is a payslip
      if (msg.text && msg.text.startsWith('[payslip]')) {
        try {
          const payload = JSON.parse(msg.text.slice('[payslip]'.length).trim())
          this.payslips.push(payload)
          console.log('[pear] received payslip:', payload.id)
        } catch (e) {
          console.error('[pear] failed to parse payslip:', e.message)
        }
      }
    }

    // Listen for Autobase updates to refresh payslips
    this.room.on('update', this._debouncedRefresh)

    await this.room.ready()
    this.connected = true
    this.invite = inviteCode

    // Load existing chat messages and payslips
    await this._refreshPayslips()

    console.log('[pear] connected to room as guest')
    console.log('[pear] local key:', z32.encode(this.room.localBase.key))
  }

  async _refreshPayslips() {
    if (!this.room) return
    try {
      const messages = await this.room.getMessages({ limit: 200 })
      this.chatMessages = messages
      // Extract payslips from messages
      this.payslips = []
      for (const msg of messages) {
        if (msg.text && msg.text.startsWith('[payslip]')) {
          try {
            const payload = JSON.parse(msg.text.slice('[payslip]'.length).trim())
            this.payslips.push(payload)
          } catch (e) {
            // skip malformed payslips
          }
        }
      }
    } catch (e) {
      console.error('[pear] failed to refresh payslips:', e.message)
    }
  }

  async sendMessage(text) {
    if (!this.room || !this.connected) throw new Error('Not connected')
    await this.room.addMessage(text, {
      name: this.identity.name,
      key: z32.encode(this.room.localBase.key),
      at: Date.now()
    })
  }

  async sendPayslip(payslipData) {
    const payload = `[payslip] ${JSON.stringify(payslipData)}`
    await this.sendMessage(payload)
  }

  getStatus() {
    return {
      connected: this.connected,
      role: this.role,
      peers: this.peers,
      storageDir: this.storageDir,
      localKey: this.room ? z32.encode(this.room.localBase.key) : null
    }
  }

  getChatMessages() {
    return this.chatMessages.map((m) => ({
      id: m.id,
      text: m.text,
      info: {
        name: m.info?.name || 'Unknown',
        at: m.info?.at || 0
      }
    }))
  }

  getPayslips() {
    return this.payslips
  }

  disconnect() {
    this.swarm?.destroy()
    this.connected = false
    this.peers = 0
  }
}

module.exports = PearP2P
