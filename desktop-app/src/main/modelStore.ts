import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'

/**
 * User-managed model registry persisted at `userData/models.json`.
 *
 * Pre-seeds the curated QWEN model library from the @qvac/sdk registry
 * (1.7B Q4 for low-spec machines, 4B Q4_K_M for high-spec machines) and
 * migrates any legacy `*.gguf` files already in `userData` as
 * `sourceKind: 'file'` entries so users do not have to re-import.
 *
 * Three source kinds are supported:
 *   - 'registry': an opaque `registry://` id that resolves to a named
 *     export of @qvac/sdk (e.g. QWEN3_1_7B_INST_Q4). The qvac service
 *     layer looks these up in a static map and passes the resolved
 *     model object to `loadModel`.
 *   - 'https' / 'http': a remote URL the SDK will download into the
 *     qvac cache and then load.
 *   - 'file': an absolute local path the SDK will load directly.
 */

export type ModelSourceKind = 'http' | 'https' | 'registry' | 'file'

export interface ModelEntry {
  id: string
  name: string
  source: string
  sourceKind: ModelSourceKind
  size?: number
  quantization?: string
  params?: string
  description?: string
  createdAt: string
  builtin?: boolean
}

export interface ModelRegistryFile {
  version: 1
  models: ModelEntry[]
  lastSelectedModelId: string | null
}

const REGISTRY_FILE = 'models.json'

/**
 * Curated QWEN builtin presets. These are the only models the app
 * ships with — users can add custom file/URL entries alongside via
 * "Add custom model" in the picker.
 *
 * `source` uses the `registry://` scheme; the qvac service layer
 * maps the id to the matching export from `@qvac/sdk` at load time.
 */
const BUILTIN_PRESETS: Array<Omit<ModelEntry, 'id' | 'createdAt'>> = [
  {
    name: 'QWEN 1.7B',
    source: 'registry://qwen3-1.7b-instruct-q4',
    sourceKind: 'registry',
    quantization: 'Q4',
    params: '1.7B',
    size: 1.28 * 1024 * 1024 * 1024, 
    description: 'Compact dual-mode reasoning model. Runs easily on low-spec laptops and mobile devices with 4-8 GB RAM.',
    builtin: true,
  },
  {
    name: 'QWEN 4B',
    source: 'registry://qwen3-4b-instruct-q4-k-m',
    sourceKind: 'registry',
    quantization: 'Q4_K_M',
    params: '4B',
    size: 2.5 * 1024 * 1024 * 1024, // Size is perfectly correct (2.50 GB)
    description: 'Higher-quality balanced model. Runs comfortably on standard 8 GB RAM laptops; discrete GPU optional for acceleration.',
    builtin: true,
  },
]

export function deriveSourceKind(src: string): ModelSourceKind {
  if (src.startsWith('registry://')) return 'registry'
  if (src.startsWith('https://')) return 'https'
  if (src.startsWith('http://')) return 'http'
  // Absolute path on Windows (C:\...) or POSIX (/...) → file
  if (src.length >= 2 && (src[1] === ':' || src.startsWith('/') || src.startsWith('\\\\'))) {
    return 'file'
  }
  // Fallback: treat as a URL
  return 'https'
}

function newId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

class ModelStore {
  private filePath: string
  private state: ModelRegistryFile = { version: 1, models: [], lastSelectedModelId: null }

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = join(userDataPath, REGISTRY_FILE)
    this.load()
    this.scanExistingGguf()
    this.preSeedIfEmpty()
    this.save()
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(data) as ModelRegistryFile
        if (parsed && Array.isArray(parsed.models)) {
          this.state = {
            version: 1,
            models: parsed.models,
            lastSelectedModelId: parsed.lastSelectedModelId ?? null,
          }
        }
      }
    } catch (error) {
      console.error('[ModelStore] Failed to load registry:', error)
      this.state = { version: 1, models: [], lastSelectedModelId: null }
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (error) {
      console.error('[ModelStore] Failed to save registry:', error)
    }
  }

  private preSeedIfEmpty(): void {
    if (this.state.models.length > 0) return
    const now = new Date().toISOString()
    // Default `lastSelectedModelId` to the 1.7B (low-spec) entry so
    // first-time users on small machines get the right default.
    let firstEntryId: string | null = null
    for (const preset of BUILTIN_PRESETS) {
      const entry: ModelEntry = {
        id: newId(),
        ...preset,
        createdAt: now,
      }
      this.state.models.push(entry)
      if (firstEntryId === null) firstEntryId = entry.id
    }
    if (firstEntryId !== null) {
      this.state.lastSelectedModelId = firstEntryId
    }
  }

  private scanExistingGguf(): void {
    try {
      const userDataPath = app.getPath('userData')
      const files = readdirSync(userDataPath)
      const ggufFiles = files.filter((f) => f.toLowerCase().endsWith('.gguf'))

      for (const filename of ggufFiles) {
        const absPath = join(userDataPath, filename)
        let stat
        try {
          stat = statSync(absPath)
          if (!stat.isFile()) continue
        } catch {
          continue
        }

        // Skip if a local-file entry with this exact path already exists.
        const exists = this.state.models.some(
          (m) => m.sourceKind === 'file' && m.source === absPath,
        )
        if (exists) continue

        const entry: ModelEntry = {
          id: newId(),
          name: filename.replace(/\.gguf$/i, ''),
          source: absPath,
          sourceKind: 'file',
          size: stat.size,
          quantization: 'Q4_K_M',
          params: '1.7B',
          description: 'Local GGUF file detected in userData',
          createdAt: new Date().toISOString(),
          builtin: false,
        }
        this.state.models.push(entry)
      }

      // Ensure lastSelectedModelId still points at an existing entry.
      if (
        this.state.lastSelectedModelId &&
        !this.state.models.some((m) => m.id === this.state.lastSelectedModelId)
      ) {
        this.state.lastSelectedModelId = this.state.models[0]?.id ?? null
      }
    } catch (error) {
      console.error('[ModelStore] Failed to scan userData for .gguf files:', error)
    }
  }

  getAll(): ModelEntry[] {
    return [...this.state.models]
  }

  getById(id: string): ModelEntry | undefined {
    return this.state.models.find((m) => m.id === id)
  }

  add(
    input: Omit<
      ModelEntry,
      'id' | 'createdAt' | 'sourceKind' | 'size'
    > & {
      sourceKind?: ModelSourceKind
      size?: number
    },
  ): ModelEntry {
    const sourceKind = input.sourceKind ?? deriveSourceKind(input.source)
    const entry: ModelEntry = {
      id: newId(),
      name: input.name,
      source: input.source,
      sourceKind,
      size: input.size,
      quantization: input.quantization,
      params: input.params,
      description: input.description,
      createdAt: new Date().toISOString(),
      builtin: input.builtin ?? false,
    }
    this.state.models.push(entry)
    this.save()
    return entry
  }

  remove(id: string): boolean {
    const entry = this.getById(id)
    if (!entry) return false
    if (entry.builtin) return false
    this.state.models = this.state.models.filter((m) => m.id !== id)
    if (this.state.lastSelectedModelId === id) {
      this.state.lastSelectedModelId = this.state.models[0]?.id ?? null
    }
    this.save()
    return true
  }

  setLastSelected(id: string | null): void {
    if (id !== null && !this.getById(id)) return
    this.state.lastSelectedModelId = id
    this.save()
  }

  getLastSelected(): ModelEntry | null {
    if (!this.state.lastSelectedModelId) return null
    return this.getById(this.state.lastSelectedModelId) ?? null
  }
}

export const modelStore = new ModelStore()
