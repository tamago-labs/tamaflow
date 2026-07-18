import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Plus, Trash2, Search, Globe, FileText, Loader2 } from 'lucide-react'
import { bridge } from '../../lib/bridge'

interface Document {
  id: string
  name: string
  source: string
  createdAt: string
  qvacIds?: string[]
}

interface SearchResult {
  id: string;
  score: number;
  content: string;
}

export default function KnowledgePage() {
  const [modelStatus, setModelStatus] = useState<'unloaded' | 'loading' | 'ready'>('unloaded')
  const [modelProgress, setModelProgress] = useState<number | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)

  // Add document state
  const [addMode, setAddMode] = useState<'text' | 'url' | null>(null)
  const [docName, setDocName] = useState('')
  const [docContent, setDocContent] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await bridge.rag.modelStatus()
      setModelStatus(status.status)
      setModelProgress(status.progress?.percentage ?? null)
    } catch (e) {
      console.error('[Knowledge] Failed to fetch status:', e)
    }
  }, [])

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await bridge.rag.list()
      setDocuments(Array.isArray(docs) ? docs : [])
    } catch (e) {
      console.error('[Knowledge] Failed to fetch documents:', e)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchDocuments()
  }, [fetchStatus, fetchDocuments])

  const handleStartModel = async () => {
    setLoading(true)
    setModelStatus('loading')
    setModelProgress(null)
    try {
      await bridge.rag.loadModel()
      setModelStatus('ready')
      setModelProgress(null)
    } catch (e) {
      console.error('[Knowledge] Failed to load model:', e)
      setModelStatus('unloaded')
    } finally {
      setLoading(false)
    }
  }

  const handleStopModel = async () => {
    setLoading(true)
    try {
      await bridge.rag.unloadModel()
      setModelStatus('unloaded')
      setModelProgress(null)
    } catch (e) {
      console.error('[Knowledge] Failed to unload model:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchUrl = async () => {
    if (!docUrl.trim()) return
    setFetchingUrl(true)
    setUrlPreview(null)
    try {
      const result = await bridge.rag.fetchUrl({ url: docUrl.trim() })
      if (result.success) {
        setUrlPreview(result.content)
        if (!docName.trim()) {
          try {
            setDocName(new URL(docUrl).hostname)
          } catch {
            setDocName('Website')
          }
        }
      } else {
        alert(result.error || 'Failed to fetch URL')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to fetch URL')
    } finally {
      setFetchingUrl(false)
    }
  }

  const handleIngest = async () => {
    if (!docName.trim()) return
    const content = addMode === 'url' ? urlPreview : docContent
    if (!content?.trim()) return

    setSaving(true)
    try {
      const result = await bridge.rag.ingest({
        name: docName.trim(),
        content,
        source: addMode || 'text'
      })
      if (result.success) {
        setAddMode(null)
        setDocName('')
        setDocContent('')
        setDocUrl('')
        setUrlPreview(null)
        fetchDocuments()
      } else {
        alert(result.error || 'Failed to ingest document')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to ingest document')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document and its embeddings?')) return
    try {
      await bridge.rag.delete({ id })
      fetchDocuments()
    } catch (e) {
      console.error('[Knowledge] Failed to delete:', e)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const result = await bridge.rag.search({ query: searchQuery.trim(), topK: 5 })
      if (result.success) {
        setSearchResults(result.results || [])
      } else {
        alert(result.error || 'Search failed')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Knowledge Base</h1>
        <div className="flex items-center gap-2">
          {modelStatus === 'ready' ? (
            <button
              type="button"
              onClick={handleStopModel}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
              Stop Service
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartModel}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Start Service
            </button>
          )}
        </div>
      </div>

      {/* Model status */}
      <div className="mb-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full ${modelStatus === 'ready' ? 'bg-green-500' : modelStatus === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'}`} />
        <div>
          <span className="text-sm font-medium text-gray-900">
            {modelStatus === 'ready' ? 'Embedding model ready' : modelStatus === 'loading' ? 'Loading embedding model…' : 'Embedding model stopped'}
          </span>
          <span className="ml-2 text-xs text-gray-400 font-mono">GTE-Large FP16</span>
          {modelProgress !== null && (
            <span className="ml-2 text-xs text-gray-500">{Math.round(modelProgress)}%</span>
          )}
          {modelStatus === 'loading' && (
            <p className="mt-1 text-xs text-amber-600">First-time loading may take 5–10 minutes depending on your connection.</p>
          )}
        </div>
      </div>

      {/* Add document buttons */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setAddMode(addMode === 'text' ? null : 'text'); setUrlPreview(null); setDocUrl(''); setDocContent(''); setDocName('') }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition"
        >
          <Plus size={14} /> Add Text
        </button>
        <button
          type="button"
          onClick={() => { setAddMode(addMode === 'url' ? null : 'url'); setUrlPreview(null); setDocUrl(''); setDocContent(''); setDocName('') }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition"
        >
          <Globe size={14} /> Add URL
        </button>
      </div>

      {/* Add document form */}
      {addMode && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Document Name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Document name"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {addMode === 'text' ? (
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Content</label>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Paste or type document content..."
                rows={8}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none resize-y"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleFetchUrl}
                  disabled={fetchingUrl || !docUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {fetchingUrl ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                  Fetch
                </button>
              </div>
              {urlPreview && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-xs text-gray-500 m-0 mb-2">Preview ({urlPreview.length} characters)</p>
                  <p className="text-xs text-gray-700 m-0 max-h-32 overflow-y-auto whitespace-pre-wrap">{urlPreview.slice(0, 500)}{urlPreview.length > 500 ? '…' : ''}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setAddMode(null); setDocName(''); setDocContent(''); setDocUrl(''); setUrlPreview(null) }}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleIngest}
              disabled={saving || !docName.trim() || !(addMode === 'url' ? urlPreview : docContent)?.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] disabled:opacity-50 transition"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Ingesting…' : 'Add Document'}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Documents ({documents.length})</span>
        </div>
        {documents.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No documents yet</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                    {doc.source === 'url' ? <Globe size={14} /> : <FileText size={14} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                    <div className="font-mono text-[10px] text-gray-400">{doc.source} · {new Date(doc.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Search test */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Search Test</span>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Enter search query..."
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] disabled:opacity-50 transition"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((r, i) => (
              <div key={r.id || i} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700">
                    {(r.score * 100).toFixed(1)}%
                  </span>
                </div>
                  <p className="text-xs text-gray-700 m-0 whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && !searching && searchQuery && (
          <p className="text-xs text-gray-400 m-0 text-center py-4">No results found</p>
        )}
      </div>
    </div>
  )
}
