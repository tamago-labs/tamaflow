// Knowledge Base (RAG) storage module. Manages document ingestion,
// search, and embedding model lifecycle using QVAC's built-in RAG functions.

const {
  loadModel,
  unloadModel,
  GTE_LARGE_FP16,
  ragIngest,
  ragSearch,
  ragDeleteEmbeddings
} = require('@qvac/sdk')
const cheerio = require('cheerio')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const WORKSPACE = 'tamaflow-knowledge-base'
const METADATA_DIR = path.join(app.getPath('userData'), 'knowledge-base')
const METADATA_FILE = path.join(METADATA_DIR, 'documents.json')

let embeddingModelId = null
let modelStatus = 'unloaded' // 'unloaded' | 'loading' | 'ready'
let modelProgress = null

// ─── Metadata Management ───────────────────────────────────────

function ensureMetadataDir() {
  if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true })
  }
}

function loadMetadata() {
  ensureMetadataDir()
  if (!fs.existsSync(METADATA_FILE)) {
    return []
  }
  try {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveMetadata(documents) {
  ensureMetadataDir()
  fs.writeFileSync(METADATA_FILE, JSON.stringify(documents, null, 2))
}

// ─── Embedding Model ───────────────────────────────────────────

async function ensureEmbeddingModel(onProgress) {
  if (embeddingModelId && modelStatus === 'ready') {
    return embeddingModelId
  }

  modelStatus = 'loading'
  modelProgress = null
  try {
    embeddingModelId = await loadModel({
      modelSrc: GTE_LARGE_FP16,
      modelType: 'embeddings',
      onProgress: (p) => {
        modelProgress = p
        if (onProgress) onProgress(p)
      }
    })
    modelStatus = 'ready'
    modelProgress = null
    return embeddingModelId
  } catch (err) {
    modelStatus = 'unloaded'
    modelProgress = null
    throw err
  }
}

async function unloadEmbeddingModel() {
  if (embeddingModelId) {
    try {
      await unloadModel({ modelId: embeddingModelId })
    } catch {
      // Ignore unload errors
    }
    embeddingModelId = null
    modelStatus = 'unloaded'
    modelProgress = null
  }
}

function getModelStatus() {
  return { status: modelStatus, progress: modelProgress }
}

// ─── URL Content Extraction ────────────────────────────────────

function fetchUrlContent(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          resolve({
            success: false,
            error: `Redirected (${res.statusCode}). The URL may be blocked.`
          })
          return
        }
        if (res.statusCode !== 200) {
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}. The server may be blocking requests.`
          })
          return
        }

        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          const $ = cheerio.load(data)
          $('script, style, noscript, iframe').remove()
          const text = $('body').text().replace(/\s+/g, ' ').trim()

          if (!text) {
            resolve({ success: false, error: 'No text content found on this page.' })
            return
          }

          resolve({ success: true, content: text })
        })
      })
      .on('error', (err) => {
        resolve({ success: false, error: `Failed to connect: ${err.message}` })
      })
  })
}

// ─── Document Operations ───────────────────────────────────────

async function ingestDocument(name, content, source = 'text') {
  const modelId = await ensureEmbeddingModel()
  if (!modelId) return { success: false, error: 'Failed to load embedding model' }

  try {
    const result = await ragIngest({
      modelId,
      workspace: WORKSPACE,
      documents: [content],
      chunk: true,
      chunkOpts: { chunkSize: 256, chunkOverlap: 50 }
    })

    const qvacIds = result.processed
      .filter((p) => p.status === 'fulfilled' && p.id)
      .map((p) => p.id)

    const metadata = loadMetadata()
    metadata.push({
      id: Date.now().toString(),
      name,
      source,
      createdAt: new Date().toISOString(),
      qvacIds
    })
    saveMetadata(metadata)

    return { success: true, processed: result.processed.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function searchDocuments(query, topK = 5) {
  const modelId = await ensureEmbeddingModel()
  if (!modelId) return { success: false, error: 'Failed to load embedding model' }

  try {
    const results = await ragSearch({
      modelId,
      workspace: WORKSPACE,
      query,
      topK
    })
    return { success: true, results }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function listDocuments() {
  return loadMetadata()
}

async function deleteDocument(id) {
  const metadata = loadMetadata()
  const docIndex = metadata.findIndex((doc) => doc.id === id)
  if (docIndex === -1) {
    return { success: false, error: 'Document not found' }
  }

  const doc = metadata[docIndex]

  if (doc.qvacIds && doc.qvacIds.length > 0) {
    try {
      const modelId = await ensureEmbeddingModel()
      await ragDeleteEmbeddings({
        modelId,
        workspace: WORKSPACE,
        ids: doc.qvacIds
      })
    } catch (err) {
      console.error('[ragStore] Failed to delete QVAC embeddings:', err.message)
    }
  }

  metadata.splice(docIndex, 1)
  saveMetadata(metadata)
  return { success: true }
}

// ─── Exports ───────────────────────────────────────────────────

module.exports = {
  ensureEmbeddingModel,
  unloadEmbeddingModel,
  getModelStatus,
  ingestDocument,
  searchDocuments,
  listDocuments,
  deleteDocument,
  fetchUrlContent
}
