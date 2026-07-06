import { app, BrowserWindow } from 'electron'
import { join, basename as pathBasename } from 'path'
import { existsSync, writeFileSync, mkdirSync, promises as fsPromises } from 'fs'
import {
  QWEN3_1_7B_INST_Q4,
  QWEN3_4B_INST_Q4_K_M,
  loadModel,
  unloadModel,
  downloadAsset,
  cancel,
  ModelType,
  InferenceCancelledError,
  ContextOverflowError,
  WorkerCrashedError,
  WorkerShutdownError,
} from '@qvac/sdk'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'

/**
 * Single chokepoint around the QVAC SDK. Owns:
 *  - the SDK config (cacheDirectory)
 *  - the in-flight requestId (for cancellation)
 *  - the currently-loaded modelId
 *  - normalized progress emission (models:progress)
 *  - error mapping → { code, message, retryable } for the renderer
 *
 * Source kinds:
 *  - 'registry' → looked up in REGISTRY_SOURCES below, the resolved
 *    SDK constant is passed to loadModel.
 *  - 'file'     → loaded directly from the absolute path.
 *  - 'https'/'http' → downloaded into the qvac cache, then loaded.
 */

// ───────────────────────────── module state ─────────────────────────────

let mainWindowRef: BrowserWindow | null = null
let currentRequestId: string | null = null
let currentModelId: string | null = null
let currentEntry: ModelEntry | null = null
let currentLoadedAt: number | null = null

/**
 * Map of `registry://<id>` source strings to the matching @qvac/sdk
 * named export. Keep this in lockstep with the builtin presets in
 * `modelStore.ts` (and any future registry entries).
 */
const REGISTRY_SOURCES: Record<string, unknown> = {
  'qwen3-1.7b-instruct-q4': QWEN3_1_7B_INST_Q4,
  'qwen3-4b-instruct-q4-k-m': QWEN3_4B_INST_Q4_K_M,
}

function resolveRegistrySource(source: string): unknown {
  if (!source.startsWith('registry://')) {
    throw {
      code: 'UNKNOWN_REGISTRY',
      message: `Registry id is missing the "registry://" prefix: ${source}`,
      retryable: false,
    }
  }
  const id = source.slice('registry://'.length)
  const resolved = REGISTRY_SOURCES[id]
  if (!resolved) {
    throw {
      code: 'UNKNOWN_REGISTRY',
      message: `Unknown registry id: ${id}. Available: ${Object.keys(REGISTRY_SOURCES).join(', ')}`,
      retryable: false,
    }
  }
  return resolved
}

// ───────────────────────────── config bootstrap ─────────────────────────

/**
 * Writes `userData/qvac.config.json` so the SDK's Node resolver picks it
 * up via QVAC_CONFIG_PATH. Must be called BEFORE any loadModel/downloadAsset
 * call so the worker writes its cache where we can inspect it.
 */
export function ensureQvacConfig(): void {
  if (process.env.QVAC_CONFIG_PATH) return
  const userDataPath = app.getPath('userData')
  const cacheDir = join(userDataPath, 'qvac-cache')
  mkdirSync(cacheDir, { recursive: true })
  const cfgPath = join(userDataPath, 'qvac.config.json')
  const cfg = { cacheDirectory: cacheDir }
  try {
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8')
    process.env.QVAC_CONFIG_PATH = cfgPath
    console.log('[qvac] Wrote config to', cfgPath)
  } catch (error) {
    console.error('[qvac] Failed to write qvac.config.json:', error)
  }
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window
}

// ───────────────────────────── progress emission ─────────────────────────

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload)
  }
}

function emitProgress(
  phase: 'downloading' | 'loading',
  p: { downloaded: number; total: number; percentage: number; requestId?: string },
): void {
  send('models:progress', { phase, ...p })
}

// ───────────────────────────── cache-file utility ──────────────────────

/**
 * Compute the basename of an HTTP(S) source URL, matching how the QVAC
 * SDK constructs cache filenames. `generateShortHash` is not exported
 * from the SDK, so we discover cache files by `endsWith` on the basename
 * only.
 */
function basenameOfSource(source: string): string {
  if (!/^https?:\/\//i.test(source)) return ''
  try {
    return pathBasename(new URL(source).pathname) || ''
  } catch {
    return ''
  }
}

/**
 * Find every file in `<userData>/qvac-cache/` whose name ends with
 * `_<basename(entry.source)>` and unlink it. Used both by auto-recovery
 * (after a retryable download error in downloadThenLoad) and by the
 * manual `resetCache` IPC. Returns the absolute paths that were deleted.
 */
export async function findAndUnlinkCacheFile(
  entry: ModelEntry,
): Promise<string[]> {
  const basename = basenameOfSource(entry.source)
  if (!basename) return []
  const cacheDir = join(app.getPath('userData'), 'qvac-cache')
  let names: string[]
  try {
    names = await fsPromises.readdir(cacheDir)
  } catch (err) {
    console.warn('[qvac] resetCache: cache dir unreadable:', cacheDir, err)
    return []
  }
  const suffix = `_${basename}`
  const deleted: string[] = []
  for (const name of names) {
    if (!name.endsWith(suffix)) continue
    const abs = join(cacheDir, name)
    try {
      await fsPromises.unlink(abs)
      deleted.push(abs)
      console.log('[qvac] Deleted cache file:', abs)
    } catch (err) {
      // EBUSY/EPERM on Windows if the worker still holds a handle —
      // log and continue. Auto-recovery will retry on the next launch.
      console.warn('[qvac] Failed to delete cache file:', abs, err)
    }
  }
  return deleted
}

/**
 * Public manual-reset entry point. Used by the `models:resetCache` IPC.
 */
export async function resetCache(
  entry: ModelEntry,
): Promise<{ success: boolean; deleted: string[]; error?: string }> {
  if (entry.sourceKind === 'file' || entry.sourceKind === 'registry') {
    return { success: false, deleted: [], error: 'Cannot reset local/registry entry' }
  }
  try {
    const deleted = await findAndUnlinkCacheFile(entry)
    console.log(`[qvac] resetCache: removed ${deleted.length} file(s) for ${entry.id}`)
    return { success: true, deleted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[qvac] resetCache failed:', message)
    return { success: false, deleted: [], error: message }
  }
}

// ───────────────────────────── error mapping ─────────────────────────────

/**
 * The QVAC SDK declares many specific error classes
 * (`ModelLoadFailedError`, `DownloadAssetFailedError`, etc.) but only a small
 * subset is re-exported from the package root. We look them up by stable
 * class name to avoid coupling to deep import paths that may move between
 * SDK versions.
 */
function errorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const n = (err as { name: unknown }).name
    if (typeof n === 'string') return n
  }
  return ''
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return ''
}

export function mapError(err: unknown): { code: string; message: string; retryable: boolean } {
  if (err instanceof InferenceCancelledError) {
    return { code: 'CANCELLED', message: 'Cancelled', retryable: false }
  }
  if (err instanceof ContextOverflowError) {
    return {
      code: 'CONTEXT_OVERFLOW',
      message: 'Conversation too long for the current context size.',
      retryable: false,
    }
  }
  if (err instanceof WorkerCrashedError || err instanceof WorkerShutdownError) {
    return {
      code: 'WORKER_DIED',
      message: 'Inference engine crashed. Reload to retry.',
      retryable: true,
    }
  }

  const name = errorName(err)
  const message = errorMessage(err)

  if (name === 'DownloadCancelledError') {
    return { code: 'CANCELLED', message: 'Download cancelled', retryable: false }
  }
  if (name === 'ModelFileNotFoundError' || name === 'ModelFileNotFoundInDirError') {
    const path = (err as { modelPath?: string })?.modelPath
    return {
      code: 'FILE_NOT_FOUND',
      message: `File not found: ${path ?? ''}`.trim(),
      retryable: false,
    }
  }
  if (name === 'ModelFileLocateFailedError') {
    const meta = err as { modelType?: string; modelPath?: string }
    return {
      code: 'LOCATE_FAILED',
      message: `Could not locate ${meta.modelType ?? 'model'} at ${meta.modelPath ?? ''}`.trim(),
      retryable: false,
    }
  }
  if (name === 'ChecksumValidationFailedError') {
    const fileName = (err as { fileName?: string })?.fileName
    return {
      code: 'CHECKSUM_FAILED',
      message: `Checksum failed: ${fileName ?? 'file'}. The download will be re-attempted.`,
      retryable: true,
    }
  }
  if (name === 'PartialDownloadOfflineError') {
    return {
      code: 'PARTIAL_OFFLINE',
      message: 'Saved partial download. Reconnect to the internet to resume.',
      retryable: true,
    }
  }
  if (name === 'HTTPError') {
    return { code: 'HTTP_ERROR', message: message || 'HTTP error during download', retryable: true }
  }
  if (name === 'DownloadAssetFailedError') {
    return {
      code: 'DOWNLOAD_FAILED',
      message: 'Download failed: check your connection or the URL.',
      retryable: true,
    }
  }
  if (name === 'ModelLoadFailedError') {
    return { code: 'LOAD_FAILED', message: message || 'Model load failed', retryable: true }
  }
  if (err && typeof err === 'object' && 'code' in err) {
    // Already mapped by an earlier layer (e.g. resolveRegistrySource).
    const e = err as { code: string; message?: string; retryable?: boolean }
    return { code: e.code, message: e.message ?? message, retryable: e.retryable ?? false }
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message || 'Unknown error', retryable: true }
  }
  return { code: 'UNKNOWN', message: 'Unknown error', retryable: true }
}

// ───────────────────────────── public API ────────────────────────────────

export async function ensureModel(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  // Publish the entry as the in-flight selection up-front so buildStatus()
  // (and the renderer's `activeId` lookup) can attribute the upcoming
  // progress events to a specific row in the model list.
  currentEntry = entry
  currentModelId = null
  currentLoadedAt = null
  if (entry.sourceKind === 'file') {
    if (!existsSync(entry.source)) {
      currentEntry = null
      throw {
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${entry.source}`,
        retryable: false,
      }
    }
    return await loadLocal(entry)
  }
  if (entry.sourceKind === 'registry') {
    return await loadRegistry(entry)
  }
  return await downloadThenLoad(entry)
}

async function loadRegistry(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  // The resolved value is a `ModelDescriptor` (e.g. the
  // `QWEN3_1_7B_INST_Q4` named export). We pass it through to
  // `loadModel` which infers the right engine/modelType from the
  // descriptor at runtime.
  //
  // The SDK exposes several `loadModel` overloads, each narrowing
  // the `modelConfig` shape based on the descriptor. TypeScript can't
  // pick a single branch from a `Record<string, unknown>` lookup, so
  // we cast the descriptor to `any` at this seam. Runtime dispatch
  // is correct because the descriptor itself carries the engine tag.
  const modelSrc = resolveRegistrySource(entry.source) as any
  const op = loadModel({
    modelSrc,
    onProgress: (p: { downloaded: number; total: number; percentage: number }) =>
      emitProgress('loading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: op.requestId,
      }),
  } as any)
  currentRequestId = op.requestId
  try {
    const modelId = await op
    currentRequestId = null
    currentModelId = modelId
    currentEntry = entry
    currentLoadedAt = Date.now()
    emitProgress('loading', {
      downloaded: 1,
      total: 1,
      percentage: 100,
      requestId: op.requestId,
    })
    console.log('[qvac] Registry model loaded:', modelId, '(', entry.source, ')')
    return { modelId, fromCache: false }
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
}

async function loadLocal(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  const op = loadModel({
    modelSrc: entry.source,
    modelType: ModelType.llamacppCompletion,
    modelConfig: buildModelConfig(),
    onProgress: (p) =>
      emitProgress('loading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: op.requestId,
      }),
  })
  currentRequestId = op.requestId
  try {
    const modelId = await op
    currentRequestId = null
    currentModelId = modelId
    currentEntry = entry
    currentLoadedAt = Date.now()
    emitProgress('loading', {
      downloaded: 1,
      total: 1,
      percentage: 100,
      requestId: op.requestId,
    })
    console.log('[qvac] Local model loaded:', modelId, '(', entry.source, ')')
    return { modelId, fromCache: false }
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
}

async function downloadThenLoad(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  // 1) Download (resume is automatic when QVAC's cacheDirectory already
  //    has a partial file for the same URL).
  const downloadOp = downloadAsset({
    assetSrc: entry.source,
    onProgress: (p) =>
      emitProgress('downloading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: downloadOp.requestId,
      }),
  })
  currentRequestId = downloadOp.requestId
  try {
    await downloadOp
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
  currentRequestId = null

  // 2) Load by passing the same URL; the SDK reuses the cached asset
  //    by its source identifier.
  const loadOp = loadModel({
    modelSrc: entry.source,
    modelType: ModelType.llamacppCompletion,
    modelConfig: buildModelConfig(),
    onProgress: (p) =>
      emitProgress('loading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: loadOp.requestId,
      }),
  })
  currentRequestId = loadOp.requestId
  try {
    const modelId = await loadOp
    currentRequestId = null
    currentModelId = modelId
    currentEntry = entry
    currentLoadedAt = Date.now()
    emitProgress('loading', {
      downloaded: 1,
      total: 1,
      percentage: 100,
      requestId: loadOp.requestId,
    })
    console.log('[qvac] URL model loaded:', modelId, '(', entry.source, ')')
    return { modelId, fromCache: false }
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
}

export async function cancelCurrentRequest(opts: { clearCache?: boolean } = {}): Promise<void> {
  if (!currentRequestId) return
  const id = currentRequestId
  currentRequestId = null
  try {
    await cancel({ requestId: id, clearCache: opts.clearCache })
  } catch (err) {
    if (!(err instanceof InferenceCancelledError)) {
      console.warn('[qvac] cancel failed:', err)
    }
  }
}

export async function unloadCurrent(modelId: string): Promise<void> {
  try {
    await unloadModel({ modelId })
    if (currentModelId === modelId) {
      currentModelId = null
      currentEntry = null
      currentLoadedAt = null
    }
  } catch (e) {
    console.warn('[qvac] unload failed:', e)
  }
}

export function getActiveModelId(): string | null {
  return currentModelId
}

/**
 * Returns the currently-loaded model entry (or null).
 */
export function getActiveEntry(): ModelEntry | null {
  return currentEntry
}

function buildModelConfig(): Record<string, unknown> {
  return {
    ctx_size: 8192,
    tools: false,
  }
}

export function buildStatus(): {
  active: {
    id: string | null
    name: string
    source: string
    sourceKind: ModelSourceKind | null
    loaded: boolean
    requestId: string | null
    loadedAt: number | null
  }
  lastSelectedId: string | null
  available: ReturnType<typeof modelStore.getAll>
} {
  return {
    active: {
      id: currentEntry?.id ?? null,
      name: currentEntry?.name ?? '',
      source: currentEntry?.source ?? '',
      sourceKind: currentEntry?.sourceKind ?? null,
      loaded: currentModelId !== null,
      requestId: currentRequestId,
      loadedAt: currentLoadedAt,
    },
    lastSelectedId: modelStore.getLastSelected()?.id ?? null,
    available: modelStore.getAll(),
  }
}

// ─── Streaming state (for AI chat relay + peer state broadcast) ──

let streamingNowFlag = false

export function setStreamingNow(value: boolean): void {
  streamingNowFlag = !!value
}

export function isStreamingNow(): boolean {
  return streamingNowFlag
}

export function getLocalAiStateSnapshot(): {
  modelId: string | null
  modelName: string | null
  loadedAt: number | null
  accepting: boolean
} {
  const accepting = currentModelId !== null && !streamingNowFlag
  return {
    modelId: currentEntry?.id ?? null,
    modelName: currentEntry?.name ?? null,
    loadedAt: currentLoadedAt,
    accepting
  }
}
