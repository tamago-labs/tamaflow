// Contract IDs and template IDs for TamaFlow smart contracts.
// Single source of truth — all CLI files import from here.

const PACKAGE_ID = '4b54a4a5de912eca2ddfcf7126efe2c95a76a82bc1e61eda26b5260db05bbc48'

module.exports = {
  PACKAGE_ID,

  TEMPLATES: {
    COMPANY_PROFILE: `${PACKAGE_ID}:TamaFlow.Company.CompanyProfile:CompanyProfile`,
    EMPLOYEE_RECORD: `${PACKAGE_ID}:TamaFlow.Company.EmployeeRecord:EmployeeRecord`,
    JPYC_ASSET: `${PACKAGE_ID}:TamaFlow.JPYC.Asset:JPYCAsset`,
    PAYSIP_RECORD: `${PACKAGE_ID}:TamaFlow.Company.PayslipRecord:PayslipRecord`,
  },

  CONTRACTS: {
    COMPANY: '00ff8857228d7f5f372ee72716f1e0ef30d958e6a1bdd49c1c3ab43f73d5a8a491ca121220d7df1d1bc05edadc3ba23f39700482694fa67dd29740f1741010ac674f4aba31',
  },

  // KNOWN_PACKAGES for template ID resolution
  KNOWN_PACKAGES: {
    'EmployeeRecord': PACKAGE_ID,
    'CompanyProfile': PACKAGE_ID,
    'JPYCAsset': PACKAGE_ID,
    'PayslipRecord': PACKAGE_ID,
  },
}
