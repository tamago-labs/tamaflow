const express = require('express')
const fs = require('fs')
const path = require('path')
const { SDK } = require('@canton-network/wallet-sdk')
const PearP2P = require('./pear')

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[employee-cli] Uncaught exception:', err.message)
})
process.on('unhandledRejection', (err) => {
  console.error('[employee-cli] Unhandled rejection:', err?.message || err)
})

// Canton DevNet configuration (same as desktop app)
const DEVNET_B64 = {
  clientId: 'dmFsaWRhdG9yLWRldm5ldC1tMm0=',
  clientSecret: 'cjY5RlFtZXZMUndFZ01COE5uS2FTREhQZXdUT1N4N1l5NWp1Y3NxQWxtc0FhSmMzRGxnZ2VkQ3o0dHl5b25sNFcyV29PVnprVUlqeThkSFRsYzE2QU9KUXp4MDJRekp5bEFVRzU2b0xUQ29WQ0pVVUs0MHZSdjlDcVFFWTNmam4='
}

const DEVNET = {
  ledgerClientUrl: 'https://ledger-api.validator.devnet.sandbox.fivenorth.io',
  validatorUrl: 'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
  authTokenUrl: 'https://auth.sandbox.fivenorth.io/application/o/token/',
  authScope: 'daml_ledger_api',
  clientId: Buffer.from(DEVNET_B64.clientId, 'base64').toString(),
  clientSecret: Buffer.from(DEVNET_B64.clientSecret, 'base64').toString()
}

const WALLET_FILE = path.join(__dirname, '..', '.wallet.json')
const DEFAULT_AMULET_AMOUNT = '1000.0000000000'

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
    // Load persisted wallet if exists
    this.loadWallet()

    if (inviteCode) {
      const result = await this.pear.connect(inviteCode)
      console.log('[employee-cli] Pear connection:', result)
    }

    this.setupRoutes()
    this.app.listen(port, () => {
      console.log(`[employee-cli] Server running on http://localhost:${port}`)
      if (this.wallet) {
        console.log(`[employee-cli] Wallet loaded: ${this.wallet.partyId}`)
      }
    })
  }

  // ============================================
  // Wallet persistence
  // ============================================

  loadWallet() {
    try {
      if (fs.existsSync(WALLET_FILE)) {
        const data = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'))
        if (data.partyId && data.privateKey && data.publicKey) {
          this.wallet = data
          console.log('[employee-cli] Loaded wallet from disk')
        }
      }
    } catch (err) {
      console.error('[employee-cli] Failed to load wallet:', err.message)
    }
  }

  saveWallet() {
    try {
      if (this.wallet) {
        fs.writeFileSync(WALLET_FILE, JSON.stringify(this.wallet, null, 2))
        console.log('[employee-cli] Wallet saved to disk')
      }
    } catch (err) {
      console.error('[employee-cli] Failed to save wallet:', err.message)
    }
  }

  // ============================================
  // Token management
  // ============================================

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

  // ============================================
  // Faucet: build AmuletRules_DevNet_Tap command
  // ============================================

  async resolveTemplateId(token, partialId) {
    // Known package IDs for our deployed contracts
    const KNOWN_PACKAGES = {
      'EmployeeRecord': 'a0408b35c53eb7449b5e8eff14d3f0dc4cce9f626c0da2b5f59ef37557cf4bf5',
      'CompanyProfile': 'a0408b35c53eb7449b5e8eff14d3f0dc4cce9f626c0da2b5f59ef37557cf4bf5',
      'JPYCAsset': 'a0408b35c53eb7449b5e8eff14d3f0dc4cce9f626c0da2b5f59ef37557cf4bf5'
    }

    for (const [name, pkgId] of Object.entries(KNOWN_PACKAGES)) {
      if (partialId.includes(name)) {
        return `${pkgId}:${partialId}`
      }
    }

    // Fallback: query the ledger for the full template ID
    const ledgerEnd = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/ledger-end`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json())

    const result = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/active-contracts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventFormat: {
          filtersByParty: {
            [this.wallet.partyId]: { cumulative: [] }
          },
          verbose: false
        },
        activeAtOffset: ledgerEnd.offset
      })
    }).then(r => r.json())

    const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])
    for (const c of contracts) {
      const tid = c.contractEntry?.JsActiveContract?.createdEvent?.templateId || ''
      if (tid.includes(partialId)) return tid
    }
    return null
  }

  async fetchScanProxy(path) {
    const token = await this.getToken()
    const res = await fetch(`${DEVNET.validatorUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Scan-proxy GET ${path} returned ${res.status}: ${text}`)
    }
    return await res.json()
  }

  pickActiveRound(rounds, now) {
    const eligible = rounds.filter(round => {
      const payload = round.payload || {}
      const openMs = payload.opensAt ? Date.parse(payload.opensAt) : NaN
      const closeMs = payload.targetClosesAt ? Date.parse(payload.targetClosesAt) : NaN
      return Number.isFinite(openMs) && Number.isFinite(closeMs) && openMs <= now && now < closeMs
    })
    eligible.sort((a, b) => Date.parse(a.payload.opensAt) - Date.parse(b.payload.opensAt))
    return eligible[eligible.length - 1] || null
  }

  async buildTapCommand(receiver, amount = DEFAULT_AMULET_AMOUNT) {
    // 1. Fetch AmuletRules (DSO singleton)
    const amuletRulesResp = await this.fetchScanProxy('/v0/scan-proxy/amulet-rules')
    const amuletRules = amuletRulesResp.amulet_rules.contract

    // 2. Fetch OpenMiningRounds and pick the active one
    const roundsResp = await this.fetchScanProxy('/v0/scan-proxy/open-and-issuing-mining-rounds')
    const rounds = roundsResp.open_mining_rounds.map(r => r.contract)
    const activeRound = this.pickActiveRound(rounds, Date.now())
    if (!activeRound) {
      throw new Error('No active OpenMiningRound at the current moment')
    }

    console.log('[faucet] AmuletRules:', amuletRules.contract_id)
    console.log('[faucet] Active round:', activeRound.contract_id)

    // 3. Build the ExerciseCommand
    const tapCmd = {
      ExerciseCommand: {
        templateId: amuletRules.template_id,
        contractId: amuletRules.contract_id,
        choice: 'AmuletRules_DevNet_Tap',
        choiceArgument: {
          receiver,
          amount,
          openRound: activeRound.contract_id
        }
      }
    }

    // 4. Disclosed contracts (camelCase)
    const toDisclosed = c => ({
      templateId: c.template_id,
      contractId: c.contract_id,
      createdEventBlob: c.created_event_blob,
      ...(c.domain_id ? { synchronizerId: c.domain_id } : {})
    })

    return [tapCmd, [amuletRules, activeRound].map(toDisclosed)]
  }

  // ============================================
  // Routes
  // ============================================

  setupRoutes() {
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      if (req.method === 'OPTIONS') return res.sendStatus(200)
      next()
    })

    this.app.use(express.json())

    // Health
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // ============================================
    // Wallet endpoints
    // ============================================

    this.app.get('/api/wallet/status', (_req, res) => {
      res.json({
        exists: !!this.wallet,
        partyId: this.wallet?.partyId || null,
        fingerprint: this.wallet?.fingerprint || null
      })
    })

    this.app.post('/api/wallet/create', async (_req, res) => {
      try {
        // If wallet already exists, return it
        if (this.wallet) {
          return res.json({ success: true, partyId: this.wallet.partyId, existing: true })
        }

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

        this.saveWallet()
        res.json({ success: true, partyId: this.wallet.partyId })
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    this.app.post('/api/wallet/faucet', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { amount = DEFAULT_AMULET_AMOUNT } = req.body || {}
        console.log('[faucet] Starting faucet for', this.wallet.partyId, 'amount:', amount)

        const [tapCmd, disclosedContracts] = await this.buildTapCommand(this.wallet.partyId, amount)
        console.log('[faucet] Tap command built, disclosed contracts:', disclosedContracts.length)

        // Create a fresh SDK for this request
        const token = await this.getToken()
        const sdk = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })
        console.log('[faucet] SDK created, preparing tx...')

        const preparedTx = sdk.ledger.prepare({
          commands: [tapCmd],
          disclosedContracts,
          partyId: this.wallet.partyId
        })
        console.log('[faucet] Tx prepared, signing...')

        const signedTx = preparedTx.sign(this.wallet.privateKey)
        console.log('[faucet] Tx signed, executing...')

        const result = await signedTx.execute({ partyId: this.wallet.partyId })
        console.log('[faucet] SUCCESS! updateId:', result.updateId)

        res.json({
          success: true,
          updateId: result.updateId,
          amount,
          partyId: this.wallet.partyId
        })
      } catch (err) {
        console.error('[faucet] Error:', err.message)
        console.error('[faucet] Stack:', err.stack)
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Account info
    // ============================================

    this.app.get('/api/account', async (_req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        res.json({
          partyId: this.wallet.partyId,
          fingerprint: this.wallet.fingerprint,
          publicKey: this.wallet.publicKey
        })
      } catch (err) {
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Contract endpoints
    // ============================================

    this.app.get('/api/holdings', async (_req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const token = await this.getToken()

        // Query active contracts for this party using Holding interface
        const ledgerEnd = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/ledger-end`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json())

        const result = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/active-contracts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventFormat: {
              filtersByParty: {
                [this.wallet.partyId]: { cumulative: [] }
              },
              verbose: true
            },
            activeAtOffset: ledgerEnd.offset
          })
        }).then(r => r.json())

        const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])
        res.json(contracts)
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

        const result = await fetch(`${DEVNET.ledgerClientUrl}/v2/state/active-contracts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventFormat: {
              filtersByParty: {
                [this.wallet.partyId]: { cumulative: [] }
              },
              verbose: true
            },
            activeAtOffset: ledgerEnd.offset
          })
        }).then(r => r.json())

        const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])
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
        console.log('[exercise] Starting:', choice, 'on', templateId)

        const token = await this.getToken()

        // Resolve full template ID with package ID
        let fullTemplateId = templateId
        if (!templateId.match(/^[0-9a-f]{64}:/)) {
          const resolved = await this.resolveTemplateId(token, templateId)
          if (resolved) fullTemplateId = resolved
        }
        console.log('[exercise] Full template ID:', fullTemplateId)

        // Create fresh SDK and use prepare/sign/execute
        const sdk = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })

        const command = {
          ExerciseCommand: { templateId: fullTemplateId, contractId, choice, choiceArgument }
        }

        const preparedTx = sdk.ledger.prepare({
          commands: [command],
          partyId: this.wallet.partyId
        })
        const result = await preparedTx.sign(this.wallet.privateKey).execute({
          partyId: this.wallet.partyId
        })

        console.log('[exercise] SUCCESS! updateId:', result.updateId)
        res.json({ success: true, updateId: result.updateId })
      } catch (err) {
        console.error('[exercise] Error:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Pear P2P endpoints
    // ============================================

    this.app.get('/api/room/status', (_req, res) => {
      res.json(this.pear.getStatus())
    })

    this.app.post('/api/room/connect', async (req, res) => {
      const { invite } = req.body
      if (!invite) return res.status(400).json({ error: 'Invite code required' })
      const result = await this.pear.connect(invite)
      res.json(result)
    })

    this.app.get('/api/chat', (_req, res) => {
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
