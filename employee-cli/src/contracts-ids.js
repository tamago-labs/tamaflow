// Contract IDs and template IDs for TamaFlow smart contracts.
// Loads from contracts.json (user-editable), falls back to defaults.

const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.join(__dirname, '..', 'contracts.json')

const DEFAULTS = {
  packageId: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48',
  templates: {
    CompanyProfile: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.CompanyProfile:CompanyProfile',
    EmployeeRecord: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.EmployeeRecord:EmployeeRecord',
    JPYCAsset: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.JPYC.Asset:JPYCAsset',
    PayslipRecord: '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48:TamaFlow.Company.PayslipRecord:PayslipRecord'
  },
  contracts: {
    company: '00ff8857228d7f5f372ee72716f1e0ef30d958e6a1bdd49c1c3ab43f73d5a8a491ca121220d7df1d1bc05edadc3ba23f39700482694fa67dd29740f1741010ac674f4aba31'
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      return {
        packageId: data.packageId || DEFAULTS.packageId,
        templates: { ...DEFAULTS.templates, ...data.templates },
        contracts: { ...DEFAULTS.contracts, ...data.contracts }
      }
    }
  } catch (err) {
    console.error('[contracts-ids] Failed to load config, using defaults:', err.message)
  }
  return DEFAULTS
}

const config = loadConfig()

module.exports = {
  PACKAGE_ID: config.packageId,
  TEMPLATES: config.templates,
  CONTRACTS: config.contracts,
  KNOWN_PACKAGES: {
    'EmployeeRecord': config.packageId,
    'CompanyProfile': config.packageId,
    'JPYCAsset': config.packageId,
    'PayslipRecord': config.packageId
  }
}
