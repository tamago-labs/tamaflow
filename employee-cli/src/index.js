const express = require('express')
const fs = require('fs')
const path = require('path')
const { SDK } = require('@canton-network/wallet-sdk')
const PearP2P = require('./pear')
const { buildTransferCommand } = require('./transfer')

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
  constructor(employeePartyId) {
    this.app = express()
    this.token = null
    this.tokenExpiry = 0
    this.sdk = null
    this.wallet = null
    this.pear = new PearP2P()
    if (employeePartyId) {
      this.pear.partyId = employeePartyId
    }
  }

  async start(port = 3001) {
    // Load persisted wallet if exists
    this.loadWallet()

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
    const { KNOWN_PACKAGES } = require('./contracts-ids')

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

    // Username
    this.app.post('/api/username', (req, res) => {
      const { name } = req.body
      if (!name) return res.status(400).json({ error: 'Name required' })
      this.pear.setName(name)
      res.json({ success: true, name: this.pear.identity.name })
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
    // Transfer (send CC to another party)
    // ============================================

    this.app.post('/api/transfer', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { recipient, amount, memo } = req.body || {}
        if (!recipient || !amount) {
          return res.status(400).json({ error: 'recipient and amount are required' })
        }

        console.log('[transfer] Starting transfer from', this.wallet.partyId, 'to', recipient, 'amount:', amount)

        const token = await this.getToken()
        const dsoParty = await (require('./transfer').getAmuletDsoParty)(token, DEVNET.validatorUrl)
        console.log('[transfer] DSO party:', dsoParty)

        const [transferCommand, disclosedContracts] = await buildTransferCommand(
          token,
          DEVNET.validatorUrl,
          DEVNET.ledgerClientUrl,
          {
            sender: this.wallet.partyId,
            recipient,
            amount,
            dsoParty
          }
        )
        console.log('[transfer] Command built, disclosed contracts:', disclosedContracts.length)

        const sdk = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })

        const result = await sdk.ledger
          .prepare({
            partyId: this.wallet.partyId,
            commands: transferCommand,
            disclosedContracts
          })
          .sign(this.wallet.privateKey)
          .execute({ partyId: this.wallet.partyId })

        console.log('[transfer] SUCCESS! updateId:', result.updateId)

        res.json({
          success: true,
          updateId: result.updateId,
          amount,
          recipient
        })
      } catch (err) {
        console.error('[transfer] Error:', err.message)
        console.error('[transfer] Stack:', err.stack)
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
      try {
        const { invite } = req.body
        if (!invite) return res.status(400).json({ error: 'Invite code required' })
        await this.pear.connect(invite)
        res.json({ success: true, connected: true })
      } catch (err) {
        console.error('[room] Connect failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    this.app.get('/api/chat', (_req, res) => {
      res.json(this.pear.getChatMessages())
    })

    this.app.post('/api/chat', async (req, res) => {
      try {
        if (!this.pear.connected) return res.status(400).json({ error: 'Not connected to room' })
        const { text } = req.body
        if (!text) return res.status(400).json({ error: 'Message text required' })
        await this.pear.sendMessage(text)
        res.json({ success: true })
      } catch (err) {
        console.error('[chat] Send failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Asset approval endpoints
    // ============================================

    this.app.get('/api/pending-transfers', async (_req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })

        const token = await this.getToken()
        const base = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })

        // Extend SDK with token namespace for pending transfer queries
        const sdk = await base.extend({
          token: {
            validatorUrl: DEVNET.validatorUrl,
            auth: { method: 'static', token },
            registries: ['https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator']
          }
        })

        // Use SDK's token.transfer.pending() to get contracts with interfaceViewValue
        const contracts = await sdk.token.transfer.pending(this.wallet.partyId)
        const pending = []

        for (const c of contracts) {
          const view = c.interfaceViewValue
          if (!view?.transfer) continue
          if (view.transfer.receiver !== this.wallet.partyId) continue
          if (view.status?.tag !== 'TransferPendingReceiverAcceptance') continue

          const t = view.transfer
          const rawAmount = typeof t.amount === 'object' && t.amount !== null
            ? t.amount.initialAmount
            : t.amount
          const amountStr = String(rawAmount ?? '0')

          const memo = view.meta?.values?.memo

          pending.push({
            contractId: c.contractId,
            sender: t.sender ?? '',
            receiver: t.receiver ?? this.wallet.partyId,
            amount: amountStr,
            instrumentId: t.instrumentId?.id ?? '',
            executeBefore: t.executeBefore ?? '',
            ...(memo ? { memo } : {})
          })
        }

        console.log('[assets] found', pending.length, 'pending transfers')
        res.json(pending)
      } catch (err) {
        console.error('[assets] Failed to fetch pending transfers:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    this.app.post('/api/contracts/accept', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { contractId } = req.body
        if (!contractId) return res.status(400).json({ error: 'Contract ID required' })

        const token = await this.getToken()
        const base = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })

        const sdk = await base.extend({
          token: {
            validatorUrl: DEVNET.validatorUrl,
            auth: { method: 'static', token },
            registries: ['https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator']
          }
        })

        // Use SDK's token.transfer.accept() which handles disclosed contracts
        const tokenTransfer = sdk.token.transfer
        const [wrapped, disclosed] = await tokenTransfer.accept({
          transferInstructionCid: contractId,
          registryUrl: new URL(`${DEVNET.validatorUrl}/v0/scan-proxy`)
        })

        const preparedTx = sdk.ledger.prepare({
          commands: [wrapped],
          disclosedContracts: disclosed,
          partyId: this.wallet.partyId
        })
        const result = await preparedTx.sign(this.wallet.privateKey).execute({
          partyId: this.wallet.partyId
        })

        console.log('[assets] Accept transfer:', contractId)
        res.json({ success: true, updateId: result.updateId })
      } catch (err) {
        console.error('[assets] Accept failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    this.app.post('/api/contracts/reject', async (req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
        const { contractId } = req.body
        if (!contractId) return res.status(400).json({ error: 'Contract ID required' })

        const token = await this.getToken()
        const base = await SDK.create({
          auth: { method: 'static', token },
          ledgerClientUrl: DEVNET.ledgerClientUrl
        })

        const sdk = await base.extend({
          token: {
            validatorUrl: DEVNET.validatorUrl,
            auth: { method: 'static', token },
            registries: ['https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator']
          }
        })

        // Use SDK's token.transfer.reject() which handles disclosed contracts
        const tokenTransfer = sdk.token.transfer
        const [wrapped, disclosed] = await tokenTransfer.reject({
          transferInstructionCid: contractId,
          registryUrl: new URL(`${DEVNET.validatorUrl}/v0/scan-proxy`)
        })

        const preparedTx = sdk.ledger.prepare({
          commands: [wrapped],
          disclosedContracts: disclosed,
          partyId: this.wallet.partyId
        })
        const result = await preparedTx.sign(this.wallet.privateKey).execute({
          partyId: this.wallet.partyId
        })

        console.log('[assets] Reject transfer:', contractId)
        res.json({ success: true, updateId: result.updateId })
      } catch (err) {
        console.error('[assets] Reject failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Payslip endpoints
    // ============================================

    this.app.get('/api/payslips', (_req, res) => {
      const payslips = this.pear.getPayslips()
      // Map HyperDB records to the frontend's expected shape
      const listing = payslips.map(p => ({
        id: p.id,
        type: 'payslip',
        employee: p.employeeName || p.employee || '',
        period: p.period,
        grossPay: p.grossPay,
        netPay: p.netPay,
        currency: p.currency,
        style: 'standard',
        markdown: p.html || '',
        companyName: p.companyName,
        createdAt: p.createdAt,
      }))
      res.json(listing)
    })

    // Get a single payslip with full body (mapped to frontend shape)
    this.app.get('/api/payslips/:id', (req, res) => {
      const payslips = this.pear.getPayslips()
      const found = payslips.find(p => p.id === req.params.id)
      if (!found) return res.status(404).json({ error: 'Payslip not found' })
      res.json({
        id: found.id,
        type: 'payslip',
        employee: found.employeeName || found.employee || '',
        period: found.period,
        grossPay: found.grossPay,
        netPay: found.netPay,
        currency: found.currency,
        style: 'standard',
        markdown: found.html || '',
        companyName: found.companyName,
        createdAt: found.createdAt,
      })
    })

    // Get payslip HTML for rendering in sandboxed iframe
    this.app.get('/api/payslips/:id/html', (req, res) => {
      const payslips = this.pear.getPayslips()
      const found = payslips.find(p => p.id === req.params.id)
      if (!found) return res.status(404).send('Payslip not found')
      if (!found.html) return res.status(404).send('No HTML content')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(found.html)
    })

    this.app.post('/api/payslips', async (req, res) => {
      try {
        if (!this.pear.connected) return res.status(400).json({ error: 'Not connected to room' })
        const payslip = req.body
        if (!payslip || !payslip.id) return res.status(400).json({ error: 'Invalid payslip data' })
        await this.pear.sendPayslip(payslip)
        res.json({ success: true, id: payslip.id })
      } catch (err) {
        console.error('[payslip] Send failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    // Query PayslipRecord contracts on-ledger
    this.app.get('/api/payslip-records', async (_req, res) => {
      try {
        if (!this.wallet) return res.status(400).json({ error: 'No wallet' })
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
        const payslipRecords = contracts.filter(c => {
          const tid = c.contractEntry?.JsActiveContract?.createdEvent?.templateId || ''
          return tid.includes('PayslipRecord')
        }).map(c => {
          const event = c.contractEntry?.JsActiveContract?.createdEvent
          const arg = event?.createArgument || {}
          return {
            contractId: event?.contractId,
            employer: arg.employer || '',
            employee: arg.employee || '',
            payslipId: arg.payslipId || '',
            period: arg.period || '',
            status: arg.status || '',
            createdAt: arg.createdAt || ''
          }
        })

        res.json(payslipRecords)
      } catch (err) {
        console.error('[payslip-records] Failed to query:', err.message)
        res.status(500).json({ error: err.message })
      }
    })

    // ============================================
    // Knowledge Base search (relay to employer via P2P)
    // ============================================

    this.app.post('/api/rag/search', async (req, res) => {
      try {
        if (!this.pear.connected) {
          return res.status(400).json({ error: 'Not connected to room' })
        }
        const { query, topK = 5 } = req.body || {}
        if (!query || !query.trim()) {
          return res.status(400).json({ error: 'query is required' })
        }

        console.log('[rag] Search request:', query, 'topK:', topK)

        // Send search request via P2P room and wait for response
        const requestId = `rag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
        const results = await this.pear.relayRagSearch(query, topK, requestId)

        console.log('[rag] Search results:', results?.length || 0)
        res.json({ success: true, results: results || [] })
      } catch (err) {
        console.error('[rag] Search failed:', err.message)
        res.status(500).json({ error: err.message })
      }
    })
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3001
const partyIdIdx = args.indexOf('--party-id')
const employeePartyId = partyIdIdx !== -1 ? args[partyIdIdx + 1] : null

const cli = new EmployeeCLI(employeePartyId)
cli.start(port)
