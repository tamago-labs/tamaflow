import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import type {
  CompanyProfile,
  CompanyFile,
  CountryCode,
  CurrencyCode,
  LegalEntityType,
  PaymentTemplate,
} from '../preload/index.d'

/**
 * Employer company profile persisted at `userData/company.json`.
 *
 * Mirrors the `ModelStore` shape (singleton class, versioned envelope,
 * plain JSON) but with two important differences:
 *
 *   - **Atomic write**: writes to `<file>.tmp` then `rename`s. A corrupt
 *     `company.json` wedges the boot gate, so a torn write is worse
 *     than `ModelStore`'s plain `writeFileSync`. (Models can recover
 *     from a torn JSON by re-seeding the builtins; the company profile
 *     has no equivalent fallback.)
 *
 *   - **Strict validation**: incoming profiles (and imported JSON) are
 *     run through `validate()` against a closed allowlist of countries,
 *     currencies, and legal-entity types. The renderer also enforces
 *     the same shape, but the main process is the last line of defence
 *     against malformed imports.
 *
 * Company metadata is **not secret** — no `safeStorage` wrapping.
 */
const REGISTRY_FILE = 'company.json'

const VALID_COUNTRIES: ReadonlySet<CountryCode> = new Set<CountryCode>(['JP', 'TH', 'US-DE', 'VG'])
const VALID_CURRENCIES: ReadonlySet<CurrencyCode> = new Set<CurrencyCode>([
  'JPY',
  'THB',
  'USD',
  'EUR'
])
const VALID_LEGAL: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'corporation',
  'limited_company',
  'partnership',
  'non_profit',
  'other'
])

/**
 * Validate a decimal-string rate (e.g. "0.22" for 22%). Accepts either
 * a non-empty decimal string in [0, 1] or an empty string (meaning
 * "rule disabled"). Anything else is rejected.
 */
function validateRate(value: unknown, field: string): string {
  if (value === undefined || value === null) return ''
  const s = String(value).trim()
  if (s === '') return ''
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`${field} must be a decimal like "0.22" (got: "${s}")`)
  }
  const num = Number(s)
  if (!Number.isFinite(num) || num < 0 || num > 1) {
    throw new Error(`${field} must be between 0 and 1 (got: "${s}")`)
  }
  return s
}

/**
 * Normalize a single payment template from a partial input. Fills
 * missing fields, generates a fresh `id` + timestamps when absent
 * (server-side — never trust client-provided ids), caps memo length,
 * validates both rate fields.
 */
function normalizePaymentTemplate(raw: unknown, now: string): PaymentTemplate {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name =
    typeof r.name === 'string'
      ? r.name.trim().slice(0, 60)
      : ''
  const withholdingRate = validateRate(r.withholdingRate, `Template "${name}" withholding rate`)
  const socialSecurityRate = validateRate(r.socialSecurityRate, `Template "${name}" social security rate`)
  const defaultMemoRaw = typeof r.defaultMemo === 'string' ? r.defaultMemo.trim() : ''
  const defaultMemo = defaultMemoRaw.length > 0 ? defaultMemoRaw.slice(0, 200) : ''
  if (!defaultMemo) {
    throw new Error(`Template "${name}" requires a default memo (1–200 chars)`)
  }
  const id = typeof r.id === 'string' && r.id.trim().length > 0 ? r.id.trim() : freshTemplateId()
  const createdAt = typeof r.createdAt === 'string' && r.createdAt.trim().length > 0 ? r.createdAt : now
  const updatedAt = typeof r.updatedAt === 'string' && r.updatedAt.trim().length > 0 ? r.updatedAt : now
  return {
    id,
    name,
    withholdingRate,
    socialSecurityRate,
    defaultMemo,
    createdAt,
    updatedAt,
  }
}

/**
 * Normalize the full `paymentTemplates` array. Missing / non-array →
 * empty list. Throws if any entry fails validation (caller surfaces
 * to the user via the Settings save error path).
 */
function normalizePaymentTemplates(input: unknown, now: string): PaymentTemplate[] {
  if (!Array.isArray(input)) return []
  return input.map((t) => normalizePaymentTemplate(t, now))
}

/** Stable id generator for new payment templates. Mirrors
 *  `FlowBuilder.freshId` — prefixed for readability in logs. */
function freshTemplateId(): string {
  if (typeof randomUUID === 'function') {
    return 'tpl_' + randomUUID().replace(/-/g, '')
  }
  return 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

export class CompanyStore {
  private filePath: string
  /** In-memory cache of the on-disk file. `null` only before first load attempt. */
  private state: CompanyFile | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = join(userDataPath, REGISTRY_FILE)
    this.load()
  }

  /**
   * Read the persisted file. ENOENT → null (no profile yet). Parse
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
      const profile = CompanyStore.validateEnvelope(parsed)
      this.state = { version: 1, profile }
    } catch (err) {
      console.error('[CompanyStore] Failed to load profile:', err)
      this.state = null
    }
  }

  /** Returns the on-disk profile (or `null` if not set up). */
  get(): CompanyFile | null {
    return this.state
  }

  /**
   * Validate and persist a new profile. Preserves `createdAt` if the
   * incoming profile already has one (i.e. when editing an existing
   * profile); otherwise stamps it now. Always refreshes `updatedAt`.
   */
  save(profile: CompanyProfile): CompanyFile {
    const validated = CompanyStore.validateProfile(profile)
    const now = new Date().toISOString()
    const next: CompanyProfile = {
      ...validated,
      createdAt: validated.createdAt || now,
      updatedAt: now
    }
    const file: CompanyFile = { version: 1, profile: next }
    this.atomicWrite(file)
    this.state = file
    return file
  }

  /** Delete the on-disk file. Used by the gate's recovery hatch. */
  reset(): void {
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath)
      }
    } catch (err) {
      console.error('[CompanyStore] Failed to delete profile:', err)
    }
    this.state = null
  }

  /**
   * Validate an untrusted object (typically from an imported JSON file)
   * and return a typed `CompanyProfile`. Throws on any schema mismatch
   * so the renderer can surface the error to the user.
   */
  static validate(input: unknown): CompanyProfile {
    const profile = CompanyStore.validateEnvelope(input)
    return profile
  }

  /** Unwrap `{ version, profile }` and validate the profile. */
  private static validateEnvelope(input: unknown): CompanyProfile {
    if (!input || typeof input !== 'object') {
      throw new Error('Company profile must be a JSON object')
    }
    const obj = input as Record<string, unknown>
    if (obj.version !== 1) {
      throw new Error(`Unsupported file version: ${String(obj.version)}`)
    }
    if (!obj.profile || typeof obj.profile !== 'object') {
      throw new Error('Missing `profile` field')
    }
    return CompanyStore.validateProfile(obj.profile)
  }

  /** Validate a profile object directly (no envelope unwrapping). */
  private static validateProfile(input: unknown): CompanyProfile {
    if (!input || typeof input !== 'object') {
      throw new Error('Profile must be an object')
    }
    const p = input as Record<string, unknown>
    const companyName = String(p.companyName ?? '').trim()
    if (!companyName) {
      throw new Error('Company name is required')
    }
    if (companyName.length > 200) {
      throw new Error('Company name must be 200 characters or fewer')
    }
    const country = p.country as CountryCode
    if (!VALID_COUNTRIES.has(country)) {
      throw new Error(`Invalid country: ${String(p.country)}`)
    }
    const baseCurrency = p.baseCurrency as CurrencyCode
    if (!VALID_CURRENCIES.has(baseCurrency)) {
      throw new Error(`Invalid base currency: ${String(p.baseCurrency)}`)
    }
    const legalEntityType = p.legalEntityType as LegalEntityType
    if (!VALID_LEGAL.has(legalEntityType)) {
      throw new Error(`Invalid legal entity type: ${String(p.legalEntityType)}`)
    }
    if (p.settlementCurrency !== 'CC') {
      throw new Error(`Settlement currency must be "CC" (got: ${String(p.settlementCurrency)})`)
    }
    // fiscalYearStart — required MM month string (e.g. "01" = January,
    // "04" = April-start). Falls back to "01" if missing for backward
    // compatibility with profiles written before this field existed.
    let fiscalYearStart = '01'
    if (typeof p.fiscalYearStart === 'string' && p.fiscalYearStart.trim().length > 0) {
      const v = p.fiscalYearStart.trim()
      // New shape: MM. Legacy shape: MM-DD (still accepted, normalised to MM).
      const mm = /^(0[1-9]|1[0-2])$/.test(v)
        ? v
        : /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)
          ? v.split('-')[0]
          : null
      if (!mm) {
        throw new Error(
          `Fiscal year start must be a month string MM (got: "${v}")`
        )
      }
      fiscalYearStart = mm
    }
    // createdAt / updatedAt are optional on input (save() will stamp them).
    const createdAt = typeof p.createdAt === 'string' ? p.createdAt : ''
    const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : ''
    // User-defined payment templates — each becomes a palette tile on
    // the flow canvas. Missing/legacy → empty list (Direct Payment is
    // always present in the palette regardless). Throws if any entry
    // fails validation.
    const now = new Date().toISOString()
    const paymentTemplates = normalizePaymentTemplates(p.paymentTemplates, now)
    // Optional global default memo for Direct Payment cards (which
    // have no template). Empty by default — see
    // `PaymentFields.memo` for the per-card fallback chain.
    const directPaymentDefaultMemo =
      typeof p.directPaymentDefaultMemo === 'string'
        ? p.directPaymentDefaultMemo.trim().slice(0, 200)
        : ''
    return {
      companyName,
      country,
      baseCurrency,
      legalEntityType,
      settlementCurrency: 'CC',
      fiscalYearStart,
      paymentTemplates,
      directPaymentDefaultMemo,
      createdAt,
      updatedAt
    }
  }

  /** Write atomically via `.tmp` + `rename`. */
  private atomicWrite(file: CompanyFile): void {
    const tmpPath = `${this.filePath}.tmp`
    writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    renameSync(tmpPath, this.filePath)
  }
}

export { validateRate, normalizePaymentTemplate, normalizePaymentTemplates, freshTemplateId }

export const companyStore = new CompanyStore()
