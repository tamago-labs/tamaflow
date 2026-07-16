// PayslipsPage — employee table + settlement selection + AI template generation + P2P send.
//
// Flow:
//   1. Select employee + settlements
//   2. Open drawer → choose style → click Generate
//   3. AI streams template (thinking + content)
//   4. Template filled with numbers → preview rendered markdown
//   5. Click Send → P2P + on-ledger

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Send, FileText, Loader2, Check, Wand2, Settings } from 'lucide-react'
import Drawer from '../Drawer'
import PayslipTemplateModal from '../payslips/PayslipTemplateModal'
import { useFlows } from '../../context/FlowContext'
import { useEmployees } from '../../context/EmployeeContext'
import { useCompany } from '../../context/CompanyContext'
import { bridge } from '../../lib/bridge'
import type { RouteSummary } from '../../ai/types'

const STYLES = [
  { id: 'standard', label: 'Standard', description: 'Clean international format' },
  { id: 'japanese', label: 'Japanese (給与明細書)', description: 'Japanese payroll with 惱/控除/差引' },
  { id: 'detailed', label: 'Detailed', description: 'Full itemized breakdown' }
]

export function PayslipsPage() {
  const { onProgress, onChange, listAllRoutes } = useFlows()
  const { employees: localEmployees } = useEmployees()
  const { profile: companyProfile } = useCompany()

  const [allRoutes, setAllRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set())
  const [payslipStyle, setPayslipStyle] = useState('standard')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  // Legacy drawer state — kept for backward compat, will be removed in a follow-up
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerStyle, setDrawerStyle] = useState('standard')
  const [filledTemplate, setFilledTemplate] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load routes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const list = await listAllRoutes()
        if (!cancelled) setAllRoutes(list)
      } catch (e) {
        console.error('[PayslipsPage] reload failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [listAllRoutes])

  useEffect(() => {
    const offProgress = onProgress(() => { void reload() })
    const offChange = onChange(() => { void reload() })
    return () => { offProgress?.(); offChange?.() }
  }, [onProgress, onChange])

  const reload = useCallback(async () => {
    try {
      const list = await listAllRoutes()
      setAllRoutes(list)
    } catch (e) {
      console.error('[PayslipsPage] reload failed:', e)
    }
  }, [listAllRoutes])

  // Group routes by employee
  const routesByEmployee = useMemo(() => {
    const map = new Map<string, RouteSummary[]>()
    for (const r of allRoutes) {
      if (r.status !== 'settled') continue
      const existing = map.get(r.employeeId) || []
      existing.push(r)
      map.set(r.employeeId, existing)
    }
    return map
  }, [allRoutes])

  const employeeById = useMemo(() => {
    const map = new Map<string, typeof localEmployees[0]>()
    for (const e of localEmployees) map.set(e.id, e)
    return map
  }, [localEmployees])

  const employeesWithRoutes = useMemo(() => {
    return localEmployees.filter((e) => routesByEmployee.has(e.id))
  }, [localEmployees, routesByEmployee])

  const expandedRoutes = useMemo(() => {
    if (!expandedEmployee) return []
    return (routesByEmployee.get(expandedEmployee) || [])
      .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())
  }, [expandedEmployee, routesByEmployee])

  // Aggregate selected settlements
  const aggregateSettlement = useCallback(() => {
    if (selectedRoutes.size === 0 || !expandedEmployee) return null
    const selected = expandedRoutes.filter((r) => selectedRoutes.has(r.id))
    if (selected.length === 0) return null

    const emp = employeeById.get(expandedEmployee)
    let totalGross = 0; let totalWithholding = 0; let totalTax = 0; let totalSS = 0; let totalNet = 0
    for (const r of selected) {
      totalGross += parseFloat(r.grossPay) || 0
      totalWithholding += parseFloat(r.withholdingAmount || '0') || 0
      totalTax += parseFloat(r.taxAmount || '0') || 0
      totalSS += parseFloat(r.socialSecurityAmount || '0') || 0
      totalNet += parseFloat(r.netPay || '0') || 0
    }

    return {
      employeeId: expandedEmployee,
      displayName: emp?.displayName || expandedEmployee,
      grossPay: String(totalGross),
      withholdingAmount: String(totalWithholding),
      taxAmount: String(totalTax),
      socialSecurityAmount: String(totalSS),
      netPay: String(totalNet),
      payCurrency: selected[0].payCurrency,
      period: `${selected.length} settlement(s)`,
      createdAt: selected[0].createdAt
    }
  }, [selectedRoutes, expandedRoutes, expandedEmployee, employeeById])

  // Legacy handlers — stubbed out (old streaming flow removed)
  // The per-route send flow now lives in GeneratePayslipDrawer
  const handleGenerate = useCallback(async () => {
    // No-op: old streaming generation removed
  }, [])

  const handleSend = useCallback(async () => {
    // No-op: old P2P send removed. Per-route send is in GeneratePayslipDrawer.
  }, [])

  const openDrawer = () => {
    setDrawerStyle(payslipStyle)
    setFilledTemplate(null)
    setStreamingContent('')
    setStreamingThinking('')
    setSent(false)
    setError(null)
    setDrawerOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Payslips</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTemplateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-700 hover:bg-gray-50 transition"
          >
            <Settings size={12} />
            Templates
          </button>
          <select
            value={payslipStyle}
            onChange={(e) => setPayslipStyle(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 font-mono text-[11px] text-gray-700"
          >
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {/* Column header */}
        {employeesWithRoutes.length > 0 && (
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="w-6" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Employee</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Role</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Settled</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Total Gross</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && employeesWithRoutes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400">
              <FileText size={20} />
            </div>
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No settled payments yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Run a payroll flow first to generate payslips from settlement data.</p>
          </div>
        )}

        {/* Employee rows */}
        {employeesWithRoutes.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {employeesWithRoutes.map((emp) => {
              const routes = routesByEmployee.get(emp.id) || []
              const totalGross = routes.reduce((sum, r) => sum + (parseFloat(r.grossPay) || 0), 0)
              const isExpanded = expandedEmployee === emp.id

              return (
                <li key={emp.id}>
                  <div
                    className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => { setExpandedEmployee(isExpanded ? null : emp.id); setSelectedRoutes(new Set()) }}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="min-w-0">
                      <p className="m-0 truncate font-sans text-sm font-medium text-gray-900">{emp.displayName}</p>
                      <p className="m-0 truncate font-mono text-[10px] text-gray-400">{emp.email || emp.id}</p>
                    </div>
                    <span className="font-mono text-xs text-gray-700">{emp.role || '—'}</span>
                    <span className="font-mono text-xs text-gray-700">{routes.length}</span>
                    <span className="font-mono text-xs font-medium text-gray-900">
                      {emp.payCurrency || 'USD'} {totalGross.toLocaleString()}
                    </span>
                  </div>

                  {/* Expanded: settlement selection + generate button */}
                  {isExpanded && (
                    <div className="border-t border-blue-100 bg-blue-50/50 px-4 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                          Select settlements ({selectedRoutes.size}/{expandedRoutes.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedRoutes.size === expandedRoutes.length) {
                              setSelectedRoutes(new Set())
                            } else {
                              setSelectedRoutes(new Set(expandedRoutes.map((r) => r.id)))
                            }
                          }}
                          className="cursor-pointer border-0 bg-transparent font-mono text-[10px] uppercase tracking-wider2 text-blue-600 hover:text-blue-800"
                        >
                          {selectedRoutes.size === expandedRoutes.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {expandedRoutes.map((r) => (
                          <label
                            key={r.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                              selectedRoutes.has(r.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRoutes.has(r.id)}
                              onChange={() => {
                                setSelectedRoutes((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(r.id)) next.delete(r.id)
                                  else next.add(r.id)
                                  return next
                                })
                              }}
                              className="accent-blue-600"
                            />
                            <div className="flex-1">
                              <span className="font-sans text-xs text-gray-900">
                                {new Date(r.completedAt ?? r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="ml-2 font-mono text-[10px] text-gray-400">{r.flowId}</span>
                            </div>
                            <span className="font-mono text-xs text-gray-900">{r.payCurrency} {(parseFloat(r.grossPay) || 0).toLocaleString()}</span>
                          </label>
                        ))}
                      </div>

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={openDrawer}
                        disabled={selectedRoutes.size === 0}
                        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Wand2 size={12} />
                        Generate Payslip
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Payslip Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Payslip Preview"
        subtitle={`${STYLES.find((s) => s.id === drawerStyle)?.label || 'Standard'} — ${expandedEmployee ? employeeById.get(expandedEmployee)?.displayName : ''}`}
        width="640px"
      >
        <div className="space-y-4">
          {/* Style selector */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
              Template Style
            </label>
            <div className="flex gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDrawerStyle(s.id)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    drawerStyle === s.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {!filledTemplate && !isStreaming && (
            <motion.button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 py-3 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold uppercase tracking-wider2 hover:opacity-90 disabled:opacity-50"
            >
              <Wand2 size={14} />
              Generate Payslip
            </motion.button>
          )}

          {/* Streaming thinking */}
          {isStreaming && streamingThinking && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-amber-800">
                  AI Thinking
                </span>
              </div>
              <pre className="m-0 whitespace-pre-wrap font-mono text-[11px] text-amber-900 max-h-32 overflow-y-auto">
                {streamingThinking}
              </pre>
            </div>
          )}

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-blue-800">
                  Generating Template
                </span>
              </div>
              <pre className="m-0 whitespace-pre-wrap font-mono text-xs text-gray-700 max-h-64 overflow-y-auto">
                {streamingContent}
              </pre>
            </div>
          )}

          {/* Loading state */}
          {generating && !isStreaming && (
            <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-4">
              <Loader2 size={16} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-600">Generating template...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Filled template preview — rendered markdown */}
          {filledTemplate && !isStreaming && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                  Filled Payslip
                </span>
              </div>
              <div className="rounded-md border border-gray-200 bg-white overflow-hidden" style={{ height: 400 }}>
                <iframe
                  srcDoc={filledTemplate ?? ''}
                  title='Payslip preview'
                  sandbox='allow-same-origin'
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Send button */}
          {filledTemplate && !isStreaming && (
            <div className="flex gap-2">
              <motion.button
                type="button"
                onClick={handleSend}
                disabled={sending || sent}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 py-3 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold uppercase tracking-wider2 hover:opacity-90 disabled:opacity-50"
              >
                {sent ? <><Check size={14} /> Sent</> : sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send via P2P</>}
              </motion.button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="py-3 px-5 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light"
              >
                Close
              </button>
            </div>
          )}

          {/* Sent confirmation */}
          {sent && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 flex items-center gap-2">
              <Check size={14} className="text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-800">Payslip sent via P2P and registered on-ledger.</span>
            </div>
          )}
        </div>
      </Drawer>
      <PayslipTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />
    </div>
  )
}
