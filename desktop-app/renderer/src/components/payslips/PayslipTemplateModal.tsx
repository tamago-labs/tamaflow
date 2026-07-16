"use client"

import { useEffect, useMemo, useState } from 'react'
import { BaseModal } from '../BaseModal'
import { useCompany } from '../../context/CompanyContext'
import { useEmployees } from '../../context/EmployeeContext'
import { useFlows } from '../../context/FlowContext'
import { useWallet } from '../../context/WalletContext'
import { bridge } from '../../lib/bridge'
import { DEFAULT_PAYSIP_HTML, DEFAULT_PAYSIP_PLACEHOLDERS } from '../../lib/defaultPayslipTemplate'
import { Plus, Trash2, Wand2, Loader2 } from 'lucide-react'
import { BORDER, MUTED, NAVY, monoFont, sansFont } from '../../flow/theme'

interface PayslipTemplateModalProps {
  open: boolean
  onClose: () => void
}

type PaymentTemplate = {
  id: string
  name: string
  withholdingRate: string
  defaultMemo: string
  html: string
  defaultPlaceholders: string[]
  createdAt: string
  updatedAt: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid #d0d0e8',
  borderRadius: 4,
  fontFamily: sansFont,
  fontSize: 12,
  color: NAVY,
  outline: 'none',
  boxSizing: 'border-box',
}

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: monoFont,
  fontSize: 11,
  lineHeight: 1.5,
  resize: 'vertical',
  minHeight: 200,
  whiteSpace: 'pre',
  tabSize: 2,
}

export default function PayslipTemplateModal({ open, onClose }: PayslipTemplateModalProps) {
  const { profile, save: saveProfile } = useCompany()
  const { employees } = useEmployees()
  const { flows } = useFlows()
  const { status: walletStatus } = useWallet()

  const templates: PaymentTemplate[] = (profile as any)?.paymentTemplates ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [isAiRunning, setIsAiRunning] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  const selected = useMemo(() => {
    if (!selectedId) return null
    return templates.find((t) => t.id === selectedId) ?? null
  }, [selectedId, templates])

  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    setShowAdd(false)
    setNewTemplateName('')
    setAiPrompt('')
    setAiError(null)
    setIsAiRunning(false)
  }, [open])

  useEffect(() => {
    if (!selected) {
      setDraftName('')
      setDraftHtml('')
      return
    }
    setDraftName(selected.name)
    setDraftHtml(selected.html || DEFAULT_PAYSIP_HTML)
  }, [selected])

  const placeholders = useMemo(() => {
    const matches = draftHtml.match(/\{\{[a-zA-Z]+\}\}/g) ?? []
    return [...new Set(matches)].sort()
  }, [draftHtml])

  function handleAddNew() {
    if (!newTemplateName.trim()) return
    const id = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const newTemplate: PaymentTemplate = {
      id,
      name: newTemplateName.trim(),
      withholdingRate: '',
      defaultMemo: '',
      html: DEFAULT_PAYSIP_HTML,
      defaultPlaceholders: DEFAULT_PAYSIP_PLACEHOLDERS,
      createdAt: now,
      updatedAt: now,
    }
    const updated = [...templates, newTemplate]
    saveProfile({ ...profile, paymentTemplates: updated } as any)
    setSelectedId(id)
    setShowAdd(false)
    setNewTemplateName('')
  }

  function handleSave() {
    if (!selected) return
    const updated = templates.map((t) =>
      t.id === selected.id
        ? { ...t, name: draftName.trim() || t.name, html: draftHtml, updatedAt: new Date().toISOString() }
        : t
    )
    saveProfile({ ...profile, paymentTemplates: updated } as any)
  }

  function handleDelete(id: string) {
    const updated = templates.filter((t) => t.id !== id)
    saveProfile({ ...profile, paymentTemplates: updated } as any)
    if (selectedId === id) setSelectedId(null)
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setIsAiRunning(true)
    setAiError(null)
    try {
      const result = await bridge.payslip.generateTemplate({
        prompt: aiPrompt,
        currentHtml: draftHtml || undefined,
      })
      if (result.success && result.html) {
        setDraftHtml(result.html)
      } else {
        setAiError(result.error || 'AI generation failed')
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setIsAiRunning(false)
    }
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <button
        type='button'
        onClick={onClose}
        style={{
          padding: '6px 14px',
          background: '#fff',
          color: NAVY,
          border: '1px solid ' + BORDER,
          borderRadius: 4,
          fontFamily: monoFont,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Close
      </button>
      {selected && (
        <button
          type='button'
          onClick={handleSave}
          style={{
            padding: '6px 14px',
            background: '#1A1AE8',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontFamily: monoFont,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      )}
    </div>
  )

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title='Payslip Templates'
      subtitle='Manage HTML payslip templates bound to payment cards'
      variant='canvas'
      className='!max-w-4xl'
      footer={footer}
    >
      <div style={{ display: 'flex', gap: 0, minHeight: 480, border: '1px solid ' + BORDER, borderRadius: 6, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 240, borderRight: '1px solid ' + BORDER, background: '#fafafa', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + BORDER }}>
            {!showAdd ? (
              <button
                type='button'
                onClick={() => setShowAdd(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  background: '#fff',
                  border: '1px dashed ' + BORDER,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: MUTED,
                }}
              >
                <Plus size={12} />
                Add template
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type='text'
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') setShowAdd(false) }}
                  placeholder='Template name'
                  autoFocus
                  style={{ ...inputStyle, fontSize: 11 }}
                />
                <button
                  type='button'
                  onClick={handleAddNew}
                  disabled={!newTemplateName.trim()}
                  style={{ padding: '0 8px', background: '#1A1AE8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: monoFont }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {templates.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontFamily: monoFont, fontSize: 10, color: MUTED }}>
                No templates yet. Add one to get started.
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: selectedId === t.id ? '#eef2ff' : 'transparent',
                    borderLeft: selectedId === t.id ? '3px solid #1A1AE8' : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: sansFont, fontSize: 12, fontWeight: 600, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.name}
                      </div>
                      <div style={{ fontFamily: monoFont, fontSize: 9, color: MUTED, marginTop: 2 }}>
                        {t.withholdingRate ? `${Math.round(Number(t.withholdingRate) * 100)}% WHT` : 'No deductions'}
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                      style={{ flexShrink: 0, padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED }}
                      title='Delete template'
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: monoFont, fontSize: 12, color: MUTED }}>
              Select a template from the sidebar to edit
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Template name + placeholders */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + BORDER, display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type='text'
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 600, fontSize: 13, flex: 1 }}
                  placeholder='Template name'
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {placeholders.slice(0, 6).map((p) => (
                    <span key={p} style={{ fontFamily: monoFont, fontSize: 9, padding: '2px 6px', background: '#f0f0ff', border: '1px solid ' + BORDER, borderRadius: 3, color: MUTED }}>
                      {p}
                    </span>
                  ))}
                  {placeholders.length > 6 && (
                    <span style={{ fontFamily: monoFont, fontSize: 9, color: MUTED }}>+{placeholders.length - 6}</span>
                  )}
                </div>
              </div>

              {/* HTML editor */}
              <div style={{ flex: 1, padding: '12px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 4 }}>
                  HTML Template
                </label>
                <textarea
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  style={{ ...monoInputStyle, flex: 1, minHeight: 0 }}
                  spellCheck={false}
                />
              </div>

              {/* AI assist panel */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid ' + BORDER, background: '#fafafa' }}>
                <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>
                  AI Assist
                </div>
                {aiError && (
                  <div style={{ marginBottom: 6, padding: '6px 8px', background: 'rgba(200,48,48,0.06)', border: '1px dashed #c83030', borderRadius: 4, fontFamily: monoFont, fontSize: 10, color: '#c83030' }}>
                    {aiError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type='text'
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isAiRunning) handleAiGenerate() }}
                    placeholder='Describe what to generate or refine (e.g. "Japanese payslip with tax breakdown")'
                    disabled={isAiRunning}
                    style={{ ...inputStyle, flex: 1, fontSize: 11 }}
                  />
                  <button
                    type='button'
                    onClick={handleAiGenerate}
                    disabled={isAiRunning || !aiPrompt.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '0 12px',
                      background: isAiRunning ? '#999' : '#1A1AE8',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: isAiRunning ? 'not-allowed' : 'pointer',
                      fontFamily: monoFont,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {isAiRunning ? <Loader2 size={12} className='animate-spin' /> : <Wand2 size={12} />}
                    {isAiRunning ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  )
}
