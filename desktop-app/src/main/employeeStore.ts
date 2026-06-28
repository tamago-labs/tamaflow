import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import type {
  Employee,
  EmployeeFile,
  EmployeeType,
  PayFrequency,
  EmployeeStatus,
  CurrencyCode
} from '../preload/index.d'

/**
 * Employee roster persisted at `userData/employees.json`.
 *
 * Mirrors `CompanyStore` shape (singleton, atomic write via `.tmp` +
 * `rename`, closed-allowlist validators that throw on schema mismatch)
 * but the envelope is a list rather than a single profile.
 *
 * - **Atomic write** — same rationale as CompanyStore: a torn JSON here
 *   would silently lose the roster on the next load.
 * - **Strict validation** — incoming lists (and imported JSON) are run
 *   through `validate()` against the same allowlists as the renderer.
 * - **Not secret** — employee PII is non-confidential business record.
 *   No `safeStorage` wrapping.
 */
const REGISTRY_FILE = 'employees.json'

const VALID_TYPES: ReadonlySet<EmployeeType> = new Set<EmployeeType>([
  'employee',
  'contractor',
  'other'
])
const VALID_FREQUENCIES: ReadonlySet<PayFrequency> = new Set<PayFrequency>([
  'monthly',
  'biweekly',
  'weekly',
  'hourly',
  'one-off'
])
const VALID_STATUSES: ReadonlySet<EmployeeStatus> = new Set<EmployeeStatus>([
  'active',
  'paused',
  'terminated'
])
const VALID_CURRENCIES: ReadonlySet<CurrencyCode> = new Set<CurrencyCode>([
  'JPY',
  'THB',
  'USD',
  'EUR'
])

/** Generate a stable id (`e_<base36 ts>_<base36 rand>`).
 *  Mirrors `ModelStore.newId()` shape. */
function newId(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^e_[a-z0-9]+_[a-z0-9]+$/

/** Validate a decimal-string amount (positive, up to 2 decimals). */
function validateAmount(value: string, fieldName: string): void {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`${fieldName} must be a positive number with up to 2 decimals (got: "${value}")`)
  }
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${fieldName} must be greater than zero (got: "${value}")`)
  }
}

/** Validate an ISO-8601 date string (YYYY-MM-DD or full ISO). */
function validateDate(value: string, fieldName: string): void {
  // Accept either YYYY-MM-DD or full ISO-8601.
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    throw new Error(`${fieldName} must be an ISO-8601 date (got: "${value}")`)
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} is not a valid date (got: "${value}")`)
  }
}

export class EmployeeStore {
  private filePath: string
  /** In-memory cache. `null` only before first load attempt or after reset. */
  private state: EmployeeFile | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = join(userDataPath, REGISTRY_FILE)
    this.load()
  }

  /**
   * Read the persisted file. ENOENT → null (no roster yet). Parse
   * errors → null AND the file is left untouched so the user can
   * inspect or repair it; recovery is via `reset()`.
   */
  private load(): void {
    if (!existsSync(this.filePath)) {
      this.state = null
      return
    }
    try {
      const data = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(data) as unknown
      const employees = EmployeeStore.validateEnvelope(parsed)
      this.state = { version: 1, employees }
    } catch (err) {
      console.error('[EmployeeStore] Failed to load roster:', err)
      this.state = null
    }
  }

  /** Returns the on-disk file (or `null` if not set up). */
  get(): EmployeeFile | null {
    return this.state
  }

  /**
   * Validate and persist the full list. Stamps `createdAt` on rows
   * with no id (or a fresh one if missing), `updatedAt` on every row.
   * Existing rows keep their original `id` and `createdAt`.
   */
  save(employees: Employee[]): EmployeeFile {
    const now = new Date().toISOString()
    const validated: Employee[] = employees.map((raw) => {
      const v = EmployeeStore.validateEmployee(raw)
      const id = v.id || newId()
      return {
        ...v,
        id,
        createdAt: v.createdAt || now,
        updatedAt: now
      }
    })
    const file: EmployeeFile = { version: 1, employees: validated }
    this.atomicWrite(file)
    this.state = file
    return file
  }

  /** Remove a single employee by id. Returns the post-removal file. */
  remove(id: string): EmployeeFile | null {
    if (!this.state) return null
    const next = this.state.employees.filter((e) => e.id !== id)
    if (next.length === this.state.employees.length) {
      // No-op; the id was missing. Still save to keep invariant simple.
      return this.state
    }
    const file: EmployeeFile = { version: 1, employees: next }
    this.atomicWrite(file)
    this.state = file
    return file
  }

  /** Delete the on-disk file. Used by the recovery hatch. */
  reset(): void {
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath)
      }
    } catch (err) {
      console.error('[EmployeeStore] Failed to delete roster:', err)
    }
    this.state = null
  }

  /**
   * Validate an untrusted object (typically from an imported JSON file)
   * and return a typed `Employee[]`. Throws on any schema mismatch so
   * the renderer can surface the error to the user.
   */
  static validate(input: unknown): Employee[] {
    return EmployeeStore.validateEnvelope(input)
  }

  /** Unwrap `{ version, employees }` and validate the list. */
  private static validateEnvelope(input: unknown): Employee[] {
    if (!input || typeof input !== 'object') {
      throw new Error('Employee roster must be a JSON object')
    }
    const obj = input as Record<string, unknown>
    if (obj.version !== 1) {
      throw new Error(`Unsupported file version: ${String(obj.version)}`)
    }
    if (!Array.isArray(obj.employees)) {
      throw new Error('Missing or non-array `employees` field')
    }
    return obj.employees.map((e, idx) => {
      try {
        return EmployeeStore.validateEmployee(e as unknown)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Employee #${idx + 1}: ${msg}`)
      }
    })
  }

  /** Validate a single employee object (no envelope unwrapping). */
  private static validateEmployee(input: unknown): Employee {
    if (!input || typeof input !== 'object') {
      throw new Error('Employee must be an object')
    }
    const e = input as Record<string, unknown>

    // id (optional on input; store generates when missing)
    let id = ''
    if (typeof e.id === 'string' && e.id.length > 0) {
      if (!ID_REGEX.test(e.id)) {
        throw new Error(`Invalid employee id format: "${e.id}"`)
      }
      id = e.id
    }

    // displayName — required, 1-200 chars
    const displayName = String(e.displayName ?? '').trim()
    if (!displayName) throw new Error('Display name is required')
    if (displayName.length > 200) {
      throw new Error('Display name must be 200 characters or fewer')
    }

    // email — optional, RFC-lite
    let email: string | undefined
    if (typeof e.email === 'string' && e.email.trim().length > 0) {
      const v = e.email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        throw new Error(`Invalid email: "${v}"`)
      }
      email = v
    }

    // type — closed allowlist
    const type = e.type as EmployeeType
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Invalid employee type: ${String(e.type)}`)
    }

    // role — optional, <=100 chars
    let role: string | undefined
    if (typeof e.role === 'string' && e.role.trim().length > 0) {
      const v = e.role.trim()
      if (v.length > 100) {
        throw new Error('Role must be 100 characters or fewer')
      }
      role = v
    }

    // employmentLocation was removed in the simplification; legacy rows
    // that still have it are accepted but the field is dropped. The
    // compute layer derives the inside/outside branch from a country
    // comparison at runtime — see `shared/flowPaths.ts`.

    // country — REQUIRED on every row. Open-ended ISO 3166-1 alpha-2.
    // The renderer ships a full ISO list for the picker; this is the
    // last-line-of-defence check (non-empty, <=64 chars).
    let country: string | undefined
    if (typeof e.country === 'string' && e.country.trim().length > 0) {
      const v = e.country.trim()
      if (v.length > 64) {
        throw new Error('Country must be 64 characters or fewer')
      }
      country = v
    }
    if (!country) {
      throw new Error('Country is required')
    }

    // payCurrency — REQUIRED on every row. Closed allowlist.
    let payCurrency: CurrencyCode | undefined
    if (typeof e.payCurrency === 'string') {
      if (!VALID_CURRENCIES.has(e.payCurrency as CurrencyCode)) {
        throw new Error(`Invalid pay currency: ${String(e.payCurrency)}`)
      }
      payCurrency = e.payCurrency as CurrencyCode
    }
    if (!payCurrency) {
      throw new Error('Compensation currency is required')
    }

    // payFrequency — closed allowlist
    const payFrequency = e.payFrequency as PayFrequency
    if (!VALID_FREQUENCIES.has(payFrequency)) {
      throw new Error(`Invalid pay frequency: ${String(e.payFrequency)}`)
    }

    // salaryAmount — optional unless !hourly
    let salaryAmount: string | undefined
    if (typeof e.salaryAmount === 'string' && e.salaryAmount.trim().length > 0) {
      salaryAmount = e.salaryAmount.trim()
      if (payFrequency !== 'hourly') {
        validateAmount(salaryAmount, 'Salary')
      }
    } else if (payFrequency !== 'hourly' && payFrequency !== 'one-off') {
      throw new Error('Salary is required for monthly/biweekly/weekly pay frequency')
    }

    // hourlyRate — optional unless hourly
    let hourlyRate: string | undefined
    if (typeof e.hourlyRate === 'string' && e.hourlyRate.trim().length > 0) {
      hourlyRate = e.hourlyRate.trim()
      if (payFrequency === 'hourly') {
        validateAmount(hourlyRate, 'Hourly rate')
      }
    } else if (payFrequency === 'hourly') {
      throw new Error('Hourly rate is required for hourly pay frequency')
    }

    // cantonPartyId — optional, basic format check
    let cantonPartyId: string | undefined
    if (typeof e.cantonPartyId === 'string' && e.cantonPartyId.trim().length > 0) {
      const v = e.cantonPartyId.trim()
      if (v.length < 10) {
        throw new Error('Canton partyId must be at least 10 characters')
      }
      if (/\s/.test(v) || /[\x00-\x1f]/.test(v)) {
        throw new Error('Canton partyId must not contain whitespace or control characters')
      }
      cantonPartyId = v
    }

    // status — closed allowlist
    const status = e.status as EmployeeStatus
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${String(e.status)}`)
    }

    // startDate — optional ISO
    let startDate: string | undefined
    if (typeof e.startDate === 'string' && e.startDate.trim().length > 0) {
      startDate = e.startDate.trim()
      validateDate(startDate, 'Start date')
    }

    // endDate — optional ISO; required when terminated
    let endDate: string | undefined
    if (typeof e.endDate === 'string' && e.endDate.trim().length > 0) {
      endDate = e.endDate.trim()
      validateDate(endDate, 'End date')
    } else if (status === 'terminated') {
      throw new Error('End date is required when status is "terminated"')
    }
    if (startDate && endDate && Date.parse(endDate) <= Date.parse(startDate)) {
      throw new Error('End date must be after start date')
    }

    // note — optional, <=500 chars
    let note: string | undefined
    if (typeof e.note === 'string' && e.note.trim().length > 0) {
      const v = e.note.trim()
      if (v.length > 500) {
        throw new Error('Note must be 500 characters or fewer')
      }
      note = v
    }

    // createdAt / updatedAt optional on input (save() stamps them)
    const createdAt = typeof e.createdAt === 'string' ? e.createdAt : ''
    const updatedAt = typeof e.updatedAt === 'string' ? e.updatedAt : ''

    return {
      id,
      displayName,
      email,
      type,
      role,
      country: country!,
      payCurrency: payCurrency!,
      salaryAmount,
      payFrequency,
      hourlyRate,
      cantonPartyId,
      status,
      startDate,
      endDate,
      note,
      createdAt,
      updatedAt
    }
  }

  /** Write atomically via `.tmp` + `rename`. */
  private atomicWrite(file: EmployeeFile): void {
    const tmpPath = `${this.filePath}.tmp`
    writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    renameSync(tmpPath, this.filePath)
  }
}

export const employeeStore = new EmployeeStore()