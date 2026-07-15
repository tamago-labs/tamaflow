// Contract configuration persisted at userData/contracts.json.
// Atomic write via .tmp + rename. Same pattern as companyStore.js.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const REGISTRY_FILE = 'contracts.json'

const DEFAULT_CONFIG = {
  packageId: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48',
  templates: {
    companyProfile: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.CompanyProfile:CompanyProfile',
    employeeRecord: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.EmployeeRecord:EmployeeRecord',
    jpycAsset: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.JPYC.Asset:JPYCAsset',
    payslipRecord: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.PayslipRecord:PayslipRecord',
  },
  contracts: {
    company: '00ff8857228d7f5f372ee72716f1e0ef30d958e6a1bdd49c1c3ab43f73d5a8a491ca121220d7df1d1bc05edadc3ba23f39700482694fa67dd29740f1741010ac674f4aba31',
  }
}

function validateConfig(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Contract config must be a JSON object')
  }
  return {
    packageId: String(input.packageId || DEFAULT_CONFIG.packageId),
    templates: {
      companyProfile: String(input.templates?.companyProfile || DEFAULT_CONFIG.templates.companyProfile),
      employeeRecord: String(input.templates?.employeeRecord || DEFAULT_CONFIG.templates.employeeRecord),
      jpycAsset: String(input.templates?.jpycAsset || DEFAULT_CONFIG.templates.jpycAsset),
      payslipRecord: String(input.templates?.payslipRecord || DEFAULT_CONFIG.templates.payslipRecord),
    },
    contracts: {
      company: String(input.contracts?.company || DEFAULT_CONFIG.contracts.company),
    }
  }
}

class ContractsStore {
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
      this.state = { version: 1, ...DEFAULT_CONFIG }
      return
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
        throw new Error('Invalid contracts file format')
      }
      this.state = { version: 1, ...validateConfig(parsed) }
    } catch (err) {
      console.error('[ContractsStore] Failed to load config:', err)
      this.state = { version: 1, ...DEFAULT_CONFIG }
    }
  }

  get() {
    return this.state
  }

  save(config) {
    const validated = validateConfig(config)
    const file = {
      version: 1,
      ...validated
    }
    this._atomicWrite(file)
    this.state = file
    return file
  }

  reset() {
    this.state = { version: 1, ...DEFAULT_CONFIG }
    this._atomicWrite(this.state)
    return this.state
  }

  _atomicWrite(file) {
    const tmpPath = `${this.filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    fs.renameSync(tmpPath, this.filePath)
  }
}

module.exports = { ContractsStore, DEFAULT_CONFIG }
