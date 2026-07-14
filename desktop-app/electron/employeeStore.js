// Employee roster persisted at userData/employees.json.
//
// Atomic write via .tmp + rename. Strict validation with closed
// allowlists. Same pattern as modelStore.js.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const REGISTRY_FILE = 'employees.json'

const VALID_TYPES = new Set(['employee', 'contractor', 'other'])
const VALID_FREQUENCIES = new Set(['monthly', 'biweekly', 'weekly', 'hourly', 'one-off'])
const VALID_STATUSES = new Set(['active', 'paused', 'terminated'])
const VALID_CURRENCIES = new Set(['JPY', 'THB', 'USD', 'EUR'])

function newId() {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^e_[a-z0-9]+_[a-z0-9]+$/

function validateAmount(value, fieldName) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`${fieldName} must be a positive number with up to 2 decimals`)
  }
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${fieldName} must be greater than zero`)
  }
}

function validateDate(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    throw new Error(`${fieldName} must be an ISO-8601 date`)
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} is not a valid date`)
  }
}

function validateEmployee(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Employee must be an object')
  }
  const e = input

  let id = ''
  if (typeof e.id === 'string' && e.id.length > 0) {
    if (!ID_REGEX.test(e.id)) {
      throw new Error(`Invalid employee id format: "${e.id}"`)
    }
    id = e.id
  }

  const displayName = String(e.displayName || '').trim()
  if (!displayName) throw new Error('Display name is required')
  if (displayName.length > 200) throw new Error('Display name must be 200 characters or fewer')

  let email
  if (typeof e.email === 'string' && e.email.trim().length > 0) {
    const v = e.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new Error(`Invalid email: "${v}"`)
    }
    email = v
  }

  const type = e.type
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid employee type: ${String(e.type)}`)
  }

  let role
  if (typeof e.role === 'string' && e.role.trim().length > 0) {
    const v = e.role.trim()
    if (v.length > 100) throw new Error('Role must be 100 characters or fewer')
    role = v
  }

  let country
  if (typeof e.country === 'string' && e.country.trim().length > 0) {
    const v = e.country.trim()
    if (v.length > 64) throw new Error('Country must be 64 characters or fewer')
    country = v
  }
  if (!country) throw new Error('Country is required')

  let payCurrency
  if (typeof e.payCurrency === 'string') {
    if (!VALID_CURRENCIES.has(e.payCurrency)) {
      throw new Error(`Invalid pay currency: ${String(e.payCurrency)}`)
    }
    payCurrency = e.payCurrency
  }
  if (!payCurrency) throw new Error('Compensation currency is required')

  const payFrequency = e.payFrequency
  if (!VALID_FREQUENCIES.has(payFrequency)) {
    throw new Error(`Invalid pay frequency: ${String(e.payFrequency)}`)
  }

  let salaryAmount
  if (typeof e.salaryAmount === 'string' && e.salaryAmount.trim().length > 0) {
    salaryAmount = e.salaryAmount.trim()
    if (payFrequency !== 'hourly') validateAmount(salaryAmount, 'Salary')
  } else if (payFrequency !== 'hourly' && payFrequency !== 'one-off') {
    throw new Error('Salary is required for monthly/biweekly/weekly pay frequency')
  }

  let hourlyRate
  if (typeof e.hourlyRate === 'string' && e.hourlyRate.trim().length > 0) {
    hourlyRate = e.hourlyRate.trim()
    if (payFrequency === 'hourly') validateAmount(hourlyRate, 'Hourly rate')
  } else if (payFrequency === 'hourly') {
    throw new Error('Hourly rate is required for hourly pay frequency')
  }

  let cantonPartyId
  if (typeof e.cantonPartyId === 'string' && e.cantonPartyId.trim().length > 0) {
    const v = e.cantonPartyId.trim()
    if (v.length < 10) throw new Error('Canton partyId must be at least 10 characters')
    if (/\s/.test(v) || /[\x00-\x1f]/.test(v)) {
      throw new Error('Canton partyId must not contain whitespace or control characters')
    }
    cantonPartyId = v
  }

  const status = e.status
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${String(e.status)}`)
  }

  let startDate
  if (typeof e.startDate === 'string' && e.startDate.trim().length > 0) {
    startDate = e.startDate.trim()
    validateDate(startDate, 'Start date')
  }

  let endDate
  if (typeof e.endDate === 'string' && e.endDate.trim().length > 0) {
    endDate = e.endDate.trim()
    validateDate(endDate, 'End date')
  } else if (status === 'terminated') {
    throw new Error('End date is required when status is "terminated"')
  }
  if (startDate && endDate && Date.parse(endDate) <= Date.parse(startDate)) {
    throw new Error('End date must be after start date')
  }

  let note
  if (typeof e.note === 'string' && e.note.trim().length > 0) {
    const v = e.note.trim()
    if (v.length > 500) throw new Error('Note must be 500 characters or fewer')
    note = v
  }

  const createdAt = typeof e.createdAt === 'string' ? e.createdAt : ''
  const updatedAt = typeof e.updatedAt === 'string' ? e.updatedAt : ''

  // Preserve taxObligation and socialSecurity
  const taxObligation = e.taxObligation || undefined
  const socialSecurity = e.socialSecurity || undefined

  return {
    id,
    displayName,
    email,
    type,
    role,
    country,
    payCurrency,
    salaryAmount,
    payFrequency,
    hourlyRate,
    cantonPartyId,
    status,
    startDate,
    endDate,
    note,
    taxObligation,
    socialSecurity,
    createdAt,
    updatedAt
  }
}

function validateEnvelope(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Employee roster must be a JSON object')
  }
  const obj = input
  if (obj.version !== 1) {
    throw new Error(`Unsupported file version: ${String(obj.version)}`)
  }
  if (!Array.isArray(obj.employees)) {
    throw new Error('Missing or non-array `employees` field')
  }
  return obj.employees.map((e, idx) => {
    try {
      return validateEmployee(e)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Employee #${idx + 1}: ${msg}`)
    }
  })
}

class EmployeeStore {
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
      const employees = validateEnvelope(parsed)
      this.state = { version: 1, employees }
    } catch (err) {
      console.error('[EmployeeStore] Failed to load roster:', err)
      this.state = null
    }
  }

  get() {
    return this.state
  }

  save(employees) {
    const now = new Date().toISOString()
    const validated = employees.map((raw) => {
      const v = validateEmployee(raw)
      const id = v.id || newId()
      return {
        ...v,
        id,
        createdAt: v.createdAt || now,
        updatedAt: now
      }
    })
    const file = { version: 1, employees: validated }
    this._atomicWrite(file)
    this.state = file
    return file
  }

  remove(id) {
    if (!this.state) return null
    const next = this.state.employees.filter((e) => e.id !== id)
    if (next.length === this.state.employees.length) return this.state
    const file = { version: 1, employees: next }
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
      console.error('[EmployeeStore] Failed to delete roster:', err)
    }
    this.state = null
  }

  static validate(input) {
    return validateEnvelope(input)
  }

  _atomicWrite(file) {
    const tmpPath = `${this.filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    fs.renameSync(tmpPath, this.filePath)
  }
}

module.exports = { EmployeeStore }
