const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const path = require('path')
const os = require('os')
const fs = require('fs')

// Default storage directory
const DEFAULT_STORAGE = path.join(os.homedir(), '.tamaflow-cli')

class PearP2P {
  constructor(storageDir = DEFAULT_STORAGE) {
    this.storageDir = storageDir
    this.store = null
    this.swarm = null
    this.room = null
    this.connected = false
    this.chatMessages = []
    this.invite = null
    this.role = null
  }

  async connect(inviteCode) {
    try {
      // Create storage directory
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true })
      }

      // Initialize Corestore
      this.store = new Corestore(this.storageDir)

      // Initialize Hyperswarm
      this.swarm = new Hyperswarm()

      // Handle connections
      this.swarm.on('connection', (conn) => {
        console.log('[pear] New peer connected')
        this.store.replicate(conn)
      })

      // For now, just log that we're ready
      // In production, would join room via BlindPairing with invite code
      console.log('[pear] Storage initialized at:', this.storageDir)
      console.log('[pear] Ready to connect to desktop app')

      this.connected = true
      return { success: true, storageDir: this.storageDir }
    } catch (err) {
      console.error('[pear] Connection failed:', err)
      return { success: false, error: err.message }
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      storageDir: this.storageDir,
      role: this.role || 'guest',
      peers: 0
    }
  }

  getChatMessages() {
    return this.chatMessages
  }

  disconnect() {
    if (this.swarm) {
      this.swarm.destroy()
    }
    this.connected = false
  }
}

module.exports = PearP2P
