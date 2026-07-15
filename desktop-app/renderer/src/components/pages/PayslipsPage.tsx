// PayslipsPage — employee table + settlement selection + AI payslip generation + P2P send.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Send, FileText, Loader2, Check } from 'lucide-react'
import { useFlows } from '../../context/FlowContext'
import { useEmployees } from '../../context/EmployeeContext'
import { useCompany } from '../../context/CompanyContext'
import { bridge } from '../../lib/bridge'
import { CONTRACTS } from '../../lib/contracts-ids'
import type { RouteSummary } from '../../ai/types'

interface PayslipStyle {
  id: string
  label: string
  description: string
}

const STYLES: PayslipStyle[] = [
  { id: 'standard', label: 'Standard', description: 'Clean international format' },
  { id: 'japanese', label: 'Japanese (給与明細書)', description: 'Japanese payroll format with 惱/控除/差引' },
  { id: 'detailed', label: 'Detailed', description: 'Itemized with full tax breakdowns' }
]

export function PayslipsPage() {
  const { employees: localEmployees } = useEmployees()
  const { listAllRoutes } = useFlows()
  const { profile: companyProfile } = useCompany()

  const [allRoutes, setAllRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set())
  const [payslipStyle, setPayslipStyle] = useState('standard')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null)
  const [generatedPayload, setGeneratedPayload] = useState<Record<string, unknown> | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load all routes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const routes = await listAllRoutes()
        if (!cancelled) setAllRoutes(routes)
      } catch (e) {
        console.error('[PayslipsPage] Failed to load routes:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [listAllRoutes])

  // Group routes by employeeId
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

  // Employees with settlements
  const employeesWithRoutes = useMemo(() => {
    return localEmployees.filter((e) => routesByEmployee.has(e.id))
  }, [localEmployees, routesByEmployee])

  const expandedRoutes = useMemo(() => {
    if (!expandedEmployee) return []
    return (routesByEmployee.get(expandedEmployee) || [])
      .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())
  }, [expandedEmployee, routesByEmployee])

  const toggleEmployee = (id: string) => {
    setExpandedEmployee((prev) => (prev === id ? null : id))
    setSelectedRoutes(new Set())
    setGeneratedMarkdown(null)
    setGeneratedPayload(null)
    setSent(false)
    setError(null)
  }

  const toggleRoute = (id: string) => {
    setSelectedRoutes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setGeneratedMarkdown(null)
    setGeneratedPayload(null)
    setSent(false)
  }

  const toggleAllRoutes = () => {
    if (selectedRoutes.size === expandedRoutes.length) {
      setSelectedRoutes(new Set())
    } else {
      setSelectedRoutes(new Set(expandedRoutes.map((r) => r.id)))
    }
    setGeneratedMarkdown(null)
    setGeneratedPayload(null)
    setSent(false)
  }

  // Aggregate selected settlements into one payslip data object
  const aggregateSettlement = useCallback((): RouteSummary | null => {
    if (selectedRoutes.size === 0 || !expandedEmployee) return null
    const selected = expandedRoutes.filter((r) => selectedRoutes.has(r.id))
    if (selected.length === 0) return null

    let totalGross = 0; let totalWithholding = 0; let totalTax = 0; let totalSS = 0; let totalNet = 0
    for (const r of selected) {
      totalGross += parseFloat(r.grossPay) || 0
      totalWithholding += parseFloat(r.withholdingAmount || '0') || 0
      totalTax += parseFloat(r.taxAmount || '0') || 0
      totalSS += parseFloat(r.socialSecurityAmount || '0') || 0
      totalNet += parseFloat(r.netPay || '0') || 0
    }

    return {
      id: selected[0].id,
      flowId: selected[0].flowId,
      employeeId: expandedEmployee,
      grossPay: String(totalGross),
      withholdingAmount: String(totalWithholding),
      taxAmount: String(totalTax),
      socialSecurityAmount: String(totalSS),
      netPay: String(totalNet),
      payCurrency: selected[0].payCurrency,
      payeePlacementId: selected[0].payeePlacementId,
      sourcePlacementId: '',
      paymentPlacementId: '',
      amountCC: '',
      status: 'settled',
      createdAt: selected[0].createdAt,
      completedAt: selected[selected.length - 1].completedAt,
      fxRate: selected[0].fxRate,
      memo: `Payslip covering ${selected.length} payment(s)`,
      recipientPartyId: ''
    }
  }, [selectedRoutes, expandedRoutes, expandedEmployee, localEmployees])

  // Generate payslip via AI
  const handleGenerate = useCallback(async () => {
    const baseSettlement = aggregateSettlement()
    if (!baseSettlement) return

    const emp = localEmployees.find((e) => e.id === expandedEmployee)
    const settlement = {
      ...baseSettlement,
      displayName: emp?.displayName || expandedEmployee
    }

    setGenerating(true)
    setError(null)
    try {
      const result = await bridge.payslip.generate({
        settlementData: settlement as unknown as Record<string, unknown>,
        companyProfile: (companyProfile || {}) as Record<string, unknown>,
        style: payslipStyle
      })
      if (result.success && result.markdown) {
        setGeneratedMarkdown(result.markdown)
        const payloadResult = await bridge.payslip.buildPayload({
          markdown: result.markdown,
          settlementData: settlement as unknown as Record<string, unknown>,
          companyProfile: (companyProfile || {}) as Record<string, unknown>,
          style: payslipStyle
        })
        if (payloadResult.success && payloadResult.payload) {
          setGeneratedPayload(payloadResult.payload)

          // Register payslip on-ledger via CompanyProfile.CreatePayslip
          try {
            const payslipId = payloadResult.payload.id as string
            const period = new Date().toISOString().slice(0, 7)
            await bridge.contracts.createPayslip(
              CONTRACTS.COMPANY,
              expandedEmployee || '',
              payslipId,
              period
            )
            console.log('[PayslipsPage] Payslip registered on-ledger:', payslipId)
          } catch (ledgerErr) {
            console.error('[PayslipsPage] Failed to register payslip on-ledger:', ledgerErr)
            // Don't fail the whole flow — P2P send still works
          }
        }
      } else {
        setError(result.error || 'Generation failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [aggregateSettlement, payslipStyle, companyProfile, localEmployees, expandedEmployee])

  // Send payslip via P2P (to room chat — the CLI employee receives it)
  const handleSend = useCallback(async () => {
    if (!generatedPayload) return
    setSending(true)
    setError(null)
    try {
      // Send via P2P room chat
      await bridge.writeWorkerIPC('room', JSON.stringify({
        type: 'send-chat',
        text: `[payslip] ${JSON.stringify(generatedPayload)}`
      }))
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }, [generatedPayload])

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount) || 0
    return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Payslips</h1>
        <div className="flex items-center gap-3">
          {/* Style selector */}
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
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-white px-4 py-2.5">
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

        {/* Loading state */}
        {loading && employeesWithRoutes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <p className="m-0 font-sans text-sm text-gray-400">Loading payments...</p>
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
                      onClick={() => toggleEmployee(emp.id)}
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
                    <span className="font-mono text-xs font-medium text-gray-900">{formatCurrency(String(totalGross), routes[0]?.payCurrency || 'USD')}</span>
                  </div>

                  {/* Expanded: route selection + generate + preview */}
                  {isExpanded && (
                    <div className="border-t border-blue-100 bg-blue-50/50 px-4 py-4">
                      {/* Settlement selection */}
                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                            Select settlements ({selectedRoutes.size}/{expandedRoutes.length})
                          </span>
                          <button
                            type="button"
                            onClick={toggleAllRoutes}
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
                                onChange={() => toggleRoute(r.id)}
                                className="accent-blue-600"
                              />
                              <div className="flex-1">
                                <span className="font-sans text-xs text-gray-900">
                                  {new Date(r.completedAt ?? r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="ml-2 font-mono text-[10px] text-gray-400">{r.flowId}</span>
                              </div>
                              <span className="font-mono text-xs text-gray-900">{formatCurrency(r.grossPay, r.payCurrency)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={selectedRoutes.size === 0 || generating}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-[#1A1AE8] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {generating ? (
                          <><Loader2 size={12} className="animate-spin" /> Generating...</>
                        ) : (
                          <><FileText size={12} /> Generate Payslip</>
                        )}
                      </button>

                      {/* Error */}
                      {error && (
                        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                          <span className="font-mono text-[11px] text-red-600">{error}</span>
                        </div>
                      )}

                      {/* Preview */}
                      {generatedMarkdown && (
                        <div className="mt-4">
                          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                            Payslip Preview
                          </div>
                          <div className="rounded-md border border-gray-200 bg-white p-4">
                            <pre className="m-0 whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-900">
                              {generatedMarkdown}
                            </pre>
                          </div>

                          {/* Send button */}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={handleSend}
                              disabled={sending || sent}
                              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-green-600 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {sent ? (
                                <><Check size={12} /> Sent!</>
                              ) : sending ? (
                                <><Loader2 size={12} className="animate-spin" /> Sending...</>
                              ) : (
                                <><Send size={12} /> Send via P2P</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGeneratedMarkdown(null); setGeneratedPayload(null); setSent(false) }}
                              className="cursor-pointer rounded-md border border-gray-200 bg-white px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer count */}
        {employeesWithRoutes.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="font-sans text-[11px] text-gray-400">
              {employeesWithRoutes.length} employee(s) with settled payments
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PayslipsPage
