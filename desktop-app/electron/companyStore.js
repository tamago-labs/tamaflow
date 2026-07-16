// Company profile persisted at userData/company.json.
//
// Atomic write via .tmp + rename. Same pattern as employeeStore.js.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const REGISTRY_FILE = 'company.json'

const VALID_COUNTRIES = new Set(['JP', 'TH', 'US', 'GB', 'SG', 'AE', 'EE', 'HK', 'CH', 'VG', 'PA', 'KY', 'MH'])
const VALID_CURRENCIES = new Set(['JPY', 'THB', 'USD', 'EUR', 'SGD', 'CHF', 'HKD'])
const VALID_LEGAL_TYPES = new Set(['dev_lab', 'token_spv', 'dao_wrapper', 'other'])

function validateProfile(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Company profile must be a JSON object')
  }
  const p = input

  const companyName = String(p.companyName || '').trim()
  if (!companyName) throw new Error('Company name is required')
  if (companyName.length > 200) throw new Error('Company name must be 200 characters or fewer')

  const country = p.country
  if (!VALID_COUNTRIES.has(country)) {
    throw new Error(`Invalid jurisdiction: ${String(p.country)}`)
  }

  const baseCurrency = p.baseCurrency
  if (!VALID_CURRENCIES.has(baseCurrency)) {
    throw new Error(`Invalid base currency: ${String(p.baseCurrency)}`)
  }

  const legalEntityType = p.legalEntityType
  if (!VALID_LEGAL_TYPES.has(legalEntityType)) {
    throw new Error(`Invalid legal entity type: ${String(p.legalEntityType)}`)
  }

  const settlementCurrency = p.settlementCurrency || 'CC'

  const fiscalYearStart = typeof p.fiscalYearStart === 'string' ? p.fiscalYearStart : '01'

  // Preserve paymentTemplates, payslipTemplates, and directPaymentDefaultMemo
  const paymentTemplates = Array.isArray(p.paymentTemplates) ? p.paymentTemplates : []
  const payslipTemplates = Array.isArray(p.payslipTemplates) ? p.payslipTemplates : []
  const directPaymentDefaultMemo = typeof p.directPaymentDefaultMemo === 'string' ? p.directPaymentDefaultMemo : ''

  const createdAt = typeof p.createdAt === 'string' ? p.createdAt : ''
  const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : ''

  return {
    companyName,
    country,
    baseCurrency,
    legalEntityType,
    settlementCurrency,
    fiscalYearStart,
    paymentTemplates,
    payslipTemplates,
    directPaymentDefaultMemo,
    createdAt,
    updatedAt
  }
}

class CompanyStore {
  constructor() {
    const userDataPath = app.getPath('userData')
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = path.join(userDataPath, REGISTRY_FILE)
    this.state = null
    this._load()
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      this.state = null
      return
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !parsed.profile) {
        throw new Error('Invalid company file format')
      }
      const profile = validateProfile(parsed.profile)
      this.state = { version: 1, profile }
    } catch (err) {
      console.error('[CompanyStore] Failed to load profile:', err)
      this.state = null
    }
  }

  get() {
    return this.state
  }

  save(profile) {
    const now = new Date().toISOString()
    const validated = validateProfile(profile)
    const file = {
      version: 1,
      profile: {
        ...validated,
        createdAt: validated.createdAt || now,
        updatedAt: now
      }
    }
    this._atomicWrite(file)
    this.state = file
    return file
  }

  reset() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath)
      }
    } catch (err) {
      console.error('[CompanyStore] Failed to delete profile:', err)
    }
    this.state = null
  }

  _atomicWrite(file) {
    const tmpPath = `${this.filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    fs.renameSync(tmpPath, this.filePath)
  }
}

module.exports = { CompanyStore }
