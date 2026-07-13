const express = require('express')
const { SDK } = require('@canton-network/wallet-sdk')
const PearP2P = require('./pear')

// Canton DevNet configuration (same as desktop app)
const DEVNET_B64 = {
  clientId: 'dmFsaWRhdG9yLWRldm5ldC1tMm0=',
  clientSecret: 'cjY5RlFtZXZMUndFZ01COE5uS2FTREhQZXdUT1N4N1l5NWp1Y3NxQWxtc0FhSmMzRGxnZ2VkQ3o0dHl5b25sNFcyV29PVnprVUlqeThkSFRsYzE2QU9KUXp4MDJRekp5bEFVRzU2b0xUQ29WQ0pVVUs0MHZSdjlDcVFFWTNmam4='
}

const DEVNET = {
  ledgerClientUrl: 'https://ledger-api.validator.devnet.sandbox.fivenorth.io',
  authTokenUrl: 'https://auth.sandbox.fivenorth.io/application/o/token/',
  authScope: 'daml_ledger_api',
  clientId: Buffer.from(DEVNET_B64.clientId, 'base64').toString(),
  clientSecret: Buffer.from(DEVNET_B64.clientSecret, 'base64').toString()
}

class EmployeeCLI {
  constructor() {
    this.app = express()
    this.token = null
    this.tokenExpiry = 0
    this.sdk = null
    this.wallet = null
    this.pear = new PearP2P()
  }

  async start(port = 3001, inviteCode = null) {
    // Connect to Pear P2P if invite provided
    if (inviteCode) {
      const result = await this.pear.connect(inviteCode)
      console.log('[employee-cli] Pear connection:', result)
    }

    this.setupRoutes()
    this.app.listen(port, () => {
      console.log(`[employee-cli] Server running on http://localhost:${port}`)
    })
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token

    const res = await fetch(DEVNET.authTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${DEVNET.clientId}:${DEVNET.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        audience: DEVNET.clientId,
        scope: DEVNET.authScope
      }).toString()
    })

    const json = await res.json()
    this.token = json.access_token
    this.tokenExpiry = Date.now() + (8 * 60 * 60 * 1000)
    return this.token
  }

  async getSDK() {
    if (this.sdk) return this.sdk
    const token = await this.getToken()
    this.sdk = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    return this.sdk
  }

  setupRoutes() {
    this.app.use(express.json())

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // ============================================
    // Wallet endpoints
    // ============================================

    this.app.get('/api/wallet/status', (req, res) => {
      res.json({
        exists: !!this.wallet,
        partyId: this.wallet?.partyId || null,
        fingerprint: this.wallet?.fingerprint || null
      })
    })

    this.app.post('/api/wallet/create', async (req, res) => {
      try {
        const sdk = await this.getSDK()
        const keyPair = sdk.keys.generate()
        const fingerprint = await sdk.keys.fingerprint(keyPair.publicKey)
        const created = await sdk.party.external
          .create(keyPair.publicKey, { partyHint: 'employee' })
          .sign(keyPair.privateKey)
          .execute({ grantUserRights: false })

        this.wallet = {
          partyId: created.partyId,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          fingerprint: created.publicKeyFingerprint ?? fingerprint
        }

        res.json({ success: true, partyId: this.wallet.partyId })
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Canton contract endpoints
    // ============================================

    this.app.get('/api/holdings', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const sdk = await this.getSDK()
        const result = await sdk.token.utxos.list({ partyId: this.wallet.partyId })
        res.json(result)
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    this.app.post('/api/contracts', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { templateId } = req.body
        const token = await this.getToken()
        const ledgerEnd = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/ledger-end`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json())

        const filter = {
          filtersByParty: {
            [this.wallet.partyId]: { cumulative: [] }
          }
        }

        const result = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/active-contracts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventFormat: { filtersByParty: filter, verbose: false },
            activeAtOffset: ledgerEnd.offset
          })
        }).then(r => r.json())

        const contracts = Array.isArray(result) ? result : []
        const filtered = templateId
          ? contracts.filter(c => c.contractEntry?.JsActiveContract?.createdEvent?.templateId?.includes(templateId))
          : contracts

        res.json(filtered)
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    this.app.post('/api/contracts/exercise', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { templateId, contractId, choice, choiceArgument } = req.body

        const sdk = await this.getSDK()
        const command = {
          ExerciseCommand: {
            templateId,
            contractId,
            choice,
            choiceArgument
          }
        }

        const preparedTx = sdk.ledger.prepare({
          commands: [command],
          partyId: this.wallet.partyId
        })
        const result = await preparedTx.sign(this.wallet.privateKey).execute({
          partyId: this.wallet.partyId
        })

        res.json({ success: true, updateId: result.updateId })
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Pear P2P endpoints
    // ============================================

    this.app.get('/api/room/status', (req, res) => {
      res.json(this.pear.getStatus())
    })

    this.app.post('/api/room/connect', async (req, res) => {
      const { invite } = req.body
      if (!invite) return res.status(400).json({ error: 'Invite code required' })
      const result = await this.pear.connect(invite)
      res.json(result)
    })

    this.app.get('/api/chat', (req, res) => {
      res.json(this.pear.getChatMessages())
    })
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3001
const inviteIdx = args.indexOf('--invite')
const inviteCode = inviteIdx !== -1 ? args[inviteIdx + 1] : null

const cli = new EmployeeCLI()
cli.start(port, inviteCode)
