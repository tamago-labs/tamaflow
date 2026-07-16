"use client"

// PayslipManager — full-page 3-panel payslip template manager.
// Replaces PayslipsPage + PayslipTemplateModal.
//
// Left sidebar (240px):  template list (Default Template hardcoded + user templates)
// Center (flex-1):       view mode = HTML preview | edit mode = tabs (Preview/Source) + AI
// Right pane (360px):    view = sent payslips | creation = HTML preview

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Wand2, Loader2, Eye, Edit3 } from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'
import { useRoom } from '../../hooks/useRoom'
import { useAI } from '../../hooks/useAI'
import { bridge } from '../../lib/bridge'
import { DEFAULT_PAYSLIP_HTML, DEFAULT_PAYSLIP_PLACEHOLDERS } from '../../lib/defaultPayslipTemplate'
import { fillHtml } from '../../lib/fillHtml'
import type { PayslipTemplate, PaymentTemplate } from '../../ai/types'

const B = '#e0e0f0'
const NAVY = '#0a0a5c'
const MUTED = '#888'

const AI_PRESETS = [
  { label: 'Standard', prompt: 'Generate a clean professional payslip template with standard layout: header, employee info, earnings, deductions, net pay, and footer.' },
  { label: 'Japanese (給与明細書)', prompt: 'Generate a Japanese-style payslip (給与明細書) with 支給/控除/差引 sections.' },
  { label: 'Detailed', prompt: 'Generate a highly detailed payslip with itemized earnings, separate tax deductions per type, social security breakdown, and net pay calculation using tables.' },
]

const PAYSLIP_FIELDS = [
  { key: 'companyName', label: 'Company name', category: 'info' as const },
  { key: 'employeeName', label: 'Employee name', category: 'info' as const },
  { key: 'period', label: 'Period', category: 'info' as const },
  { key: 'country', label: 'Country', category: 'info' as const },
  { key: 'currency', label: 'Currency', category: 'info' as const },
  { key: 'grossPay', label: 'Gross pay', category: 'pay' as const },
  { key: 'netPay', label: 'Net pay', category: 'pay' as const },
  { key: 'taxAmount', label: 'Tax', category: 'deduction' as const },
  { key: 'socialSecurity', label: 'Social security', category: 'deduction' as const },
  { key: 'withholding', label: 'Withholding', category: 'deduction' as const },
  { key: 'fxRate', label: 'FX rate', category: 'extra' as const },
  { key: 'memo', label: 'Memo', category: 'extra' as const },
  { key: 'txHash', label: 'Transaction hash', category: 'extra' as const },
]

const inputS: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #d0d0e8', borderRadius: 4, fontFamily: 'ui-sans-serif, sans-serif', fontSize: 12, color: NAVY, outline: 'none', boxSizing: 'border-box' as const }
const B2 = '#e0e0f0'

export default function PayslipManager() {
  const { profile, save: saveProfile } = useCompany()
  const { payslips: roomPayslips } = useRoom()
  const ai = useAI()

  const paymentTemplates: PaymentTemplate[] = (profile as any)?.paymentTemplates ?? []
  const payslipTemplates: PayslipTemplate[] = (profile as any)?.payslipTemplates ?? []
  const companyName = (profile as any)?.companyName ?? ''

  // Debug: verify payment templates are loaded
  useEffect(() => {
    console.log('[PayslipManager] paymentTemplates:', paymentTemplates.length, paymentTemplates.map(t => t.name))
  }, [paymentTemplates])

  // ── State ─────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null)
  const [editTab, setEditTab] = useState<'preview' | 'source'>('preview')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit state
  const [draftName, setDraftName] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [bindingTemplateId, setBindingTemplateId] = useState<string>('')
  const [aiSelectedFields, setAiSelectedFields] = useState<Set<string>>(new Set(['companyName', 'employeeName', 'period', 'currency', 'grossPay', 'netPay', 'taxAmount', 'socialSecurity', 'withholding']))
  const streamingRef = useRef(false)

  const selected = useMemo(() => {
    if (!selectedId || selectedId === '__direct__') return null
    return payslipTemplates.find((t) => t.id === selectedId) ?? null
  }, [selectedId, payslipTemplates])

  // ── Streaming subscriptions ─────────────────────────────────
  useEffect(() => {
    const off1 = bridge.payslip.onThinking((d) => setStreamingThinking((p) => p + d.text))
    const off2 = bridge.payslip.onToken((d) => setStreamingContent((p) => p + d.text))
    const off3 = bridge.payslip.onDone((d) => {
      const cleaned = d.content
        .replace(/^\s*```html\s*\n?/i, '')
        .replace(/\n?\s*```\s*$/i, '')
        .trim()
      console.log('[PayslipManager] AI content stripped, length:', cleaned.length, 'starts with:', cleaned.slice(0, 50))
      setDraftHtml(cleaned)
      setIsStreaming(false)
      streamingRef.current = false
      setEditTab('source')
    })
    const off4 = bridge.payslip.onError((d) => { setAiError(d.error); setIsStreaming(false); streamingRef.current = false })
    return () => { off1(); off2(); off3(); off4() }
  }, [])

  // ── Status message during streaming ─────────────────────────
  const streamStatus = useMemo(() => {
    if (!isStreaming) return null
    if (streamingThinking && !streamingContent) return 'Thinking…'
    if (streamingContent) return 'Generating content…'
    return 'Starting…'
  }, [isStreaming, streamingThinking, streamingContent])

  // ── Preview HTML (for right column + view mode) ──────────
  const previewHtml = useMemo(() => {
    const html = isCreating ? (streamingContent || draftHtml || '') : (selected?.html || (selectedId ? DEFAULT_PAYSLIP_HTML : ''))
    if (!html) return ''
    return fillHtml(html, { companyName, period: new Date().toLocaleString('en', { month: 'long', year: 'numeric' }), employeeName: 'Sample Employee', country: 'Japan', currency: 'JPY', grossPay: '500000', netPay: '450000', fxRate: '', memo: '', txHash: '0xabc123...', taxAmount: '50000', socialSecurity: '0', withholding: '50000' })
  }, [isCreating, streamingContent, draftHtml, selected, selectedId, companyName])

  // ── Sent payslips ─────────────────────────────────────────
  const templatePayslips = useMemo(() => {
    if (!selectedId || selectedId === '__direct__') return roomPayslips.filter((p: any) => !p.templateId)
    return roomPayslips.filter((p: any) => p.templateId === selectedId)
  }, [roomPayslips, selectedId])

  // ── Handlers ──────────────────────────────────────────────
  function handleStartCreate() {
    setSelectedId(null)
    setIsCreating(true)
    setIsEditing(true)
    setDraftName('New Template')
    setDraftHtml('')
    setStreamingContent('')
    setStreamingThinking('')
    setAiPrompt('')
    setAiError(null)
    setBindingTemplateId('')
    setEditTab('source')
    setSaveError(null)
  }

  function handleSelectTemplate(id: string) {
    setSelectedId(id)
    setIsCreating(false)
    setIsEditing(false)
    setStreamingContent('')
    setStreamingThinking('')
    setSaveError(null)
  }

  function handleStartEdit() {
    if (!selected) return
    setDraftName(selected.name)
    setDraftHtml(selected.html)
    setBindingTemplateId(selected.paymentTemplateId || '')
    setIsEditing(true)
    setStreamingContent('')
    setStreamingThinking('')
    setAiError(null)
    setEditTab('source')
    setSaveError(null)
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)
    setStreamingThinking('')
    setStreamingContent('')
    setAiError(null)
    try {
      await bridge.payslip.generate({ prompt: aiPrompt, fields: Array.from(aiSelectedFields), useRealExample: false, currentHtml: draftHtml || undefined })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed')
      setIsStreaming(false)
      streamingRef.current = false
    }
  }

  async function handleSave() {
    if (!draftName.trim()) { setSaveError('Please enter a template name'); return }
    if (!profile) { setSaveError('Profile not loaded — refresh the page'); return }
    if (!draftHtml.trim()) { setSaveError('Template has no content — generate or paste HTML first'); return }
    setSaveError(null)
    const now = new Date().toISOString()
    try {
      if (isCreating) {
        const id = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
        const newTemplate: PayslipTemplate = { id, name: draftName.trim(), html: draftHtml, defaultPlaceholders: DEFAULT_PAYSLIP_PLACEHOLDERS, paymentTemplateId: bindingTemplateId || undefined, createdAt: now, updatedAt: now }
        console.log('[PayslipManager] Saving new template:', id, 'name:', newTemplate.name, 'html length:', draftHtml.length)
        console.log('[PayslipManager] Profile keys:', Object.keys(profile))
        await saveProfile({ ...profile, payslipTemplates: [...payslipTemplates, newTemplate] } as any)
        console.log('[PayslipManager] Save succeeded')
        setSelectedId(id)
      } else if (selected) {
        const updated = payslipTemplates.map((t) => t.id === selected.id ? { ...t, name: draftName.trim() || t.name, html: draftHtml, paymentTemplateId: bindingTemplateId || undefined, updatedAt: now } : t)
        await saveProfile({ ...profile, payslipTemplates: updated } as any)
      }
      setIsEditing(false)
      setIsCreating(false)
    } catch (err) {
      console.error('[PayslipManager] Save FAILED:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save template')
    }
  }

  function handleDelete(id: string) {
    saveProfile({ ...profile, payslipTemplates: payslipTemplates.filter((t) => t.id !== id) } as any)
    if (selectedId === id) { setSelectedId(null); setIsEditing(false) }
  }

  // ── Right column ──────────────────────────────────────────
  function renderRightPanel() {
    // View mode: show sent payslips
    if (!isCreating) {
      return (<>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${B2}` }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, fontWeight: 600 }}>Sent payslips ({templatePayslips.length})</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {templatePayslips.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: MUTED }}>No payslips sent with this template.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templatePayslips.map((p: any) => (
                <div key={p.id} style={{ padding: '8px 10px', background: '#fff', border: `1px solid ${B2}`, borderRadius: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 11, fontWeight: 600, color: NAVY }}>{p.employeeName || p.employee || 'Unknown'}</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: MUTED }}>{p.sentAt ? new Date(p.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: NAVY }}>{p.currency} {parseFloat(p.grossPay || '0').toLocaleString()}</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: MUTED }}>Net: {p.currency} {parseFloat(p.netPay || '0').toLocaleString()}</span>
                  </div>
                  {p.html && (
                    <>
                      <button type='button' onClick={() => setExpandedPayslip(expandedPayslip === p.id ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1A1AE8', padding: 0, marginTop: 4 }}>
                        <Eye size={10} /> {expandedPayslip === p.id ? 'Hide HTML' : 'View HTML'}
                      </button>
                      {expandedPayslip === p.id && (
                        <div style={{ marginTop: 6, border: `1px solid ${B2}`, borderRadius: 4, overflow: 'hidden' }}>
                          <iframe srcDoc={p.html} title={`Payslip ${p.id}`} style={{ width: '100%', height: 320, border: 'none' }} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </>)
    }

    // Creation + streaming: show raw content
    if (isStreaming) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${B2}` }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, fontWeight: 600 }}>Content</span>
          </div>
          <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
            {streamingContent ? (
              <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.5, color: NAVY, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{streamingContent}</pre>
            ) : (
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: MUTED, fontStyle: 'italic' }}>Waiting for content…</div>
            )}
          </div>
        </div>
      )
    }

    // Creation + done: Preview/Source + Save/Cancel
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${B2}` }}>
          <button type='button' onClick={() => setEditTab('preview')} style={{ padding: '8px 12px', border: 'none', borderBottom: editTab === 'preview' ? '2px solid #1A1AE8' : '2px solid transparent', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 600, color: editTab === 'preview' ? '#1A1AE8' : MUTED, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview</button>
          <button type='button' onClick={() => setEditTab('source')} style={{ padding: '8px 12px', border: 'none', borderBottom: editTab === 'source' ? '2px solid #1A1AE8' : '2px solid transparent', background: 'transparent', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 600, color: editTab === 'source' ? '#1A1AE8' : MUTED, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Source</button>
        </div>
        {editTab === 'preview' ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {previewHtml ? (
              <div style={{ flex: 1, border: `1px solid ${B2}`, margin: 8, borderRadius: 4, overflow: 'hidden' }}>
                <iframe srcDoc={previewHtml} title='New template preview' style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: MUTED }}>Generate HTML to see preview</div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, padding: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <textarea value={draftHtml} onChange={(e) => setDraftHtml(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: `1px solid ${B2}`, borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.5, resize: 'vertical' as const, whiteSpace: 'pre' as const, tabSize: 2, flex: 1, minHeight: 0, color: NAVY, outline: 'none', boxSizing: 'border-box' as const }} spellCheck={false} />
          </div>
        )}
        {saveError && <div style={{ padding: '4px 12px', background: 'rgba(200,48,48,0.06)', borderTop: `1px solid ${B2}`, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#c83030' }}>{saveError}</div>}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${B2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fafafa' }}>
          <button type='button' onClick={() => { setIsEditing(false); if (isCreating) { setIsCreating(false); setSelectedId(null) } }} style={{ padding: '5px 12px', background: '#fff', color: NAVY, border: `1px solid ${B2}`, borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button type='button' onClick={handleSave} disabled={!draftName.trim()} style={{ padding: '5px 12px', background: draftName.trim() ? '#1A1AE8' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: draftName.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 64px)', background: '#fff' }}>
      {/* ─── Left: Sidebar ──────────────────────────────────── */}
      <div style={{ width: 240, borderRight: `1px solid ${B2}`, background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${B2}` }}>
          <button type='button' onClick={handleStartCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', background: '#fff', border: `1px dashed ${B2}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>
            <Plus size={12} /> New template
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div onClick={() => handleSelectTemplate('__direct__')} style={{ padding: '10px 12px', cursor: 'pointer', background: selectedId === '__direct__' ? '#eef2ff' : 'transparent', borderLeft: selectedId === '__direct__' ? '3px solid #1A1AE8' : '3px solid transparent' }}>
            <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 12, fontWeight: 600, color: NAVY }}>Default Template</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: MUTED, marginTop: 2 }}>Simple payslip template</div>
          </div>
          {payslipTemplates.map((t) => (
            <div key={t.id} onClick={() => handleSelectTemplate(t.id)} style={{ padding: '10px 12px', cursor: 'pointer', background: selectedId === t.id ? '#eef2ff' : 'transparent', borderLeft: selectedId === t.id ? '3px solid #1A1AE8' : '3px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 12, fontWeight: 600, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  {t.paymentTemplateId && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#1A1AE8', marginTop: 2 }}>Bound to payment card</div>}
                </div>
                <button type='button' onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }} style={{ flexShrink: 0, padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED }} title='Delete'>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {payslipTemplates.length === 0 && <div style={{ padding: '20px 12px', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: MUTED }}>No templates yet.</div>}
        </div>
      </div>

      {/* ─── Center: View / Edit ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
        {(!selectedId && !isCreating) ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 8 }}>Select a template</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: MUTED }}>Choose from the sidebar or create a new one</div>
            </div>
          </div>
        ) : isEditing ? (
          /* ── Edit mode ─────────────────────────────────────── */
          <>
            {/* Template name + binding */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${B2}`, display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type='text' value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder='Template name' style={{ ...inputS, fontWeight: 600, fontSize: 13, flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: MUTED }}>Bind to:</label>
                <select value={bindingTemplateId} onChange={(e) => setBindingTemplateId(e.target.value)} style={{ padding: '4px 6px', border: `1px solid ${B2}`, borderRadius: 4, fontSize: 11, fontFamily: 'ui-sans-serif, sans-serif', color: NAVY }}>
                  <option value=''>None</option>
                  <option value='direct'>Direct Payment</option>
                  {paymentTemplates.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>
            </div>

            {/* AI Assist — full height in center */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${B2}`, background: '#fafafa', flexShrink: 0 }}>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>AI Assist</div>
                {aiError && <div style={{ marginBottom: 4, padding: '4px 8px', background: 'rgba(200,48,48,0.06)', border: '1px dashed #c83030', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#c83030' }}>{aiError}</div>}

                {/* Preset buttons */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 6, opacity: ai.isReady ? 1 : 0.5 }}>
                  {AI_PRESETS.map((preset) => (
                    <button key={preset.label} type='button' onClick={() => setAiPrompt(preset.prompt)} disabled={!ai.isReady} style={{ padding: '3px 8px', background: aiPrompt === preset.prompt ? '#eef2ff' : '#fff', border: `1px solid ${aiPrompt === preset.prompt ? '#1A1AE8' : B2}`, borderRadius: 3, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: aiPrompt === preset.prompt ? '#1A1AE8' : MUTED, cursor: ai.isReady ? 'pointer' : 'not-allowed' }}>
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Available fields config */}
                <div style={{ marginBottom: 6, opacity: ai.isReady ? 1 : 0.5 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: 4 }}>Available fields — select what to include</div>
                  {(['info', 'pay', 'deduction', 'extra'] as const).map((cat) => (
                    <div key={cat} style={{ display: 'flex', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      {PAYSLIP_FIELDS.filter((f) => f.category === cat).map((f) => (
                        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'ui-monospace, monospace', fontSize: 9, color: NAVY, cursor: ai.isReady ? 'pointer' : 'not-allowed' }}>
                          <input type='checkbox' checked={aiSelectedFields.has(f.key)} disabled={!ai.isReady} onChange={(e) => { const next = new Set(aiSelectedFields); if (e.target.checked) next.add(f.key); else next.delete(f.key); setAiSelectedFields(next) }} style={{ margin: 0, width: 10, height: 10 }} />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Prompt + Generate */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type='text' value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isStreaming && ai.isReady) handleAiGenerate() }} placeholder='Describe what to generate or refine' disabled={isStreaming || !ai.isReady} style={{ ...inputS, flex: 1, fontSize: 11, opacity: ai.isReady ? 1 : 0.5 }} />
                  <button type='button' onClick={handleAiGenerate} disabled={isStreaming || !aiPrompt.trim() || !ai.isReady} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', background: isStreaming || !ai.isReady ? '#999' : '#1A1AE8', color: '#fff', border: 'none', borderRadius: 4, cursor: isStreaming || !ai.isReady ? 'not-allowed' : 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0, opacity: ai.isReady ? 1 : 0.6 }}>
                    {isStreaming ? <Loader2 size={12} className='animate-spin' /> : <Wand2 size={12} />}
                    {isStreaming ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Streaming status — below AI panel, takes remaining space */}
              <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                {streamStatus ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className='animate-pulse' style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A1AE8' }} />
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#1A1AE8', fontWeight: 600 }}>{streamStatus}</span>
                    </div>
                    {streamingThinking && (
                      <div style={{ padding: '8px 10px', background: 'rgba(26,26,232,0.04)', border: `1px solid ${B2}`, borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: NAVY, lineHeight: 1.5, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                        {streamingThinking}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    {!ai.isReady ? (
                      <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 12, color: '#c83030' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>No AI model loaded</div>
                        <div style={{ fontSize: 11, color: MUTED }}>Load a model from Settings → AI to enable generation</div>
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 13, color: MUTED }}>Configure AI options above and click Generate</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ── View mode ─────────────────────────────────────── */
          <>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 14, fontWeight: 600, color: NAVY }}>{selected?.name || 'Default Template'}</div>
                {selected?.paymentTemplateId && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#1A1AE8', marginTop: 2 }}>Bound to: {paymentTemplates.find((p) => p.id === selected.paymentTemplateId)?.name || selected.paymentTemplateId}</div>}
              </div>
              <button type='button' onClick={handleStartEdit} disabled={selectedId === '__direct__'} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: selectedId === '__direct__' ? '#ccc' : '#1A1AE8', color: '#fff', border: 'none', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: selectedId === '__direct__' ? 'not-allowed' : 'pointer', opacity: selectedId === '__direct__' ? 0.5 : 1 }}>
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', border: `1px solid ${B2}`, margin: 16, borderRadius: 6, overflow: 'hidden' }}>
                <iframe srcDoc={previewHtml} title={selected?.name || 'Default Template'} style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Right: Sent payslips or Preview ──────────────── */}
      <div style={{ width: 360, borderLeft: `1px solid ${B2}`, background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {renderRightPanel()}
      </div>
    </div>
  )
}
