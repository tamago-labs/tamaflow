/**
 * Direct faucet test — runs the tap command directly without the CLI server.
 * Tests: auth token, scan-proxy, tap command execution.
 */

const fs = require('fs')
const path = require('path')
const { SDK } = require('@canton-network/wallet-sdk')

const WALLET_FILE = path.join(__dirname, '..', 'employee-cli', '.wallet.json')

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

function toDisclosed(c) {
  return {
    templateId: c.template_id,
    contractId: c.contract_id,
    createdEventBlob: c.created_event_blob,
    ...(c.domain_id ? { synchronizerId: c.domain_id } : {})
  }
}

function pickActiveRound(rounds, now) {
  const eligible = rounds.filter(round => {
    const payload = round.payload || {}
    const openMs = payload.opensAt ? Date.parse(payload.opensAt) : NaN
    const closeMs = payload.targetClosesAt ? Date.parse(payload.targetClosesAt) : NaN
    return Number.isFinite(openMs) && Number.isFinite(closeMs) && openMs <= now && now < closeMs
  })
  eligible.sort((a, b) => Date.parse(a.payload.opensAt) - Date.parse(b.payload.opensAt))
  return eligible[eligible.length - 1] || null
}

async function main() {
  console.log('=== Direct Faucet Test ===\n')

  // 1. Load wallet
  if (!fs.existsSync(WALLET_FILE)) {
    console.error('No wallet found at', WALLET_FILE)
    console.error('Start the CLI first to create a wallet.')
    process.exit(1)
  }

  const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'))
  console.log('Wallet:', wallet.partyId)

  // 2. Get auth token
  console.log('\n[1] Fetching auth token...')
  const authRes = await fetch(DEVNET.authTokenUrl, {
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
  const authJson = await authRes.json()
  const token = authJson.access_token
  console.log('  Token length:', token.length)

  // 3. Fetch AmuletRules
  console.log('\n[2] Fetching AmuletRules...')
  const arRes = await fetch(`${DEVNET.validatorUrl}/v0/scan-proxy/amulet-rules`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const arJson = await arRes.json()
  const amuletRules = arJson.amulet_rules.contract
  console.log('  AmuletRules contract_id:', amuletRules.contract_id.slice(0, 40) + '...')
  console.log('  AmuletRules template_id:', amuletRules.template_id.slice(0, 60) + '...')

  // 4. Fetch OpenMiningRounds
  console.log('\n[3] Fetching OpenMiningRounds...')
  const mrRes = await fetch(`${DEVNET.validatorUrl}/v0/scan-proxy/open-and-issuing-mining-rounds`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const mrJson = await mrRes.json()
  const rounds = mrJson.open_mining_rounds.map(r => r.contract)
  console.log('  Found', rounds.length, 'round(s)')

  const activeRound = pickActiveRound(rounds, Date.now())
  if (!activeRound) {
    console.error('  ERROR: No active round!')
    process.exit(1)
  }
  console.log('  Active round:', activeRound.contract_id.slice(0, 40) + '...')

  // 5. Build tap command
  console.log('\n[4] Building tap command...')
  const tapCmd = {
    ExerciseCommand: {
      templateId: amuletRules.template_id,
      contractId: amuletRules.contract_id,
      choice: 'AmuletRules_DevNet_Tap',
      choiceArgument: {
        receiver: wallet.partyId,
        amount: '1000.0000000000',
        openRound: activeRound.contract_id
      }
    }
  }
  const disclosed = [amuletRules, activeRound].map(toDisclosed)
  console.log('  Choice:', tapCmd.ExerciseCommand.choice)
  console.log('  Receiver:', wallet.partyId.slice(0, 40) + '...')

  // 6. Execute via SDK
  console.log('\n[5] Executing tap via SDK...')
  const sdk = await SDK.create({
    auth: { method: 'static', token },
    ledgerClientUrl: DEVNET.ledgerClientUrl
  })

  try {
    const preparedTx = sdk.ledger.prepare({
      commands: [tapCmd],
      disclosedContracts: disclosed,
      partyId: wallet.partyId
    })
    const result = await preparedTx.sign(wallet.privateKey).execute({
      partyId: wallet.partyId
    })
    console.log('  SUCCESS!')
    console.log('  updateId:', result.updateId)
  } catch (err) {
    console.error('  FAILED:', err.message)
    if (err.cause) console.error('  Cause:', err.cause.message || err.cause)
    process.exit(1)
  }

  console.log('\n=== All tests passed ===')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
