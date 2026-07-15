// Contract IDs and template IDs for TamaFlow smart contracts.
// Single source of truth — all files import from here.

const PACKAGE_ID = '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48'

module.exports = {
  // Package ID (shared across all templates)
  PACKAGE_ID,

  // Full template IDs
  TEMPLATES: {
    COMPANY_PROFILE: `${PACKAGE_ID}:TamaFlow.Company.CompanyProfile:CompanyProfile`,
    EMPLOYEE_RECORD: `${PACKAGE_ID}:TamaFlow.Company.EmployeeRecord:EmployeeRecord`,
    JPYC_ASSET: `${PACKAGE_ID}:TamaFlow.JPYC.Asset:JPYCAsset`,
    PAYSIP_RECORD: `${PACKAGE_ID}:TamaFlow.Company.PayslipRecord:PayslipRecord`,
  },

  // Deployed contract IDs
  CONTRACTS: {
    COMPANY: '00ff8857228d7f5f372ee72716f1e0ef30d958e6a1bdd49c1c3ab43f73d5a8a491ca121220d7df1d1bc05edadc3ba23f39700482694fa67dd29740f1741010ac674f4aba31',
  },
}
