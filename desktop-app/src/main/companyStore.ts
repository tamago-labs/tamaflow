import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import type {
  CompanyProfile,
  CompanyFile,
  CountryCode,
  CurrencyCode,
  LegalEntityType
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
    // createdAt / updatedAt are optional on input (save() will stamp them).
    const createdAt = typeof p.createdAt === 'string' ? p.createdAt : ''
    const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : ''
    return {
      companyName,
      country,
      baseCurrency,
      legalEntityType,
      settlementCurrency: 'CC',
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

export const companyStore = new CompanyStore()
