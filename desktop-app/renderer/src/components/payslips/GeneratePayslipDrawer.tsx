"use client"

import { useEffect, useMemo, useState } from 'react'
import Drawer from '../Drawer'
import { useCompany } from '../../context/CompanyContext'
import { useEmployees } from '../../context/EmployeeContext'
import { useRoom } from '../../hooks/useRoom'
import { bridge } from '../../lib/bridge'
import { CONTRACTS } from '../../lib/contracts-ids'
import { DEFAULT_PAYSIP_HTML } from '../../lib/defaultPayslipTemplate'
import type { RouteSummary, PaymentTemplate } from '../../ai/types'
import { Loader2, Send, Check, History } from 'lucide-react'

interface GeneratePayslipDrawerProps {
  open: boolean
  onClose: () => void
  route: RouteSummary | null
  onSent: () => void
}

function fillHtml(html: string, data: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '')
  }
  return result
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatPeriod(completedAt: string): string {
  try {
    const d = new Date(completedAt)
    return `${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`
  } catch {
    return ''
  }
}

export default function GeneratePayslipDrawer({ open, onClose, route, onSent }: GeneratePayslipDrawerProps) {
  const { profile: companyProfile } = useCompany()
  const { employees: rosterEmployees } = useEmployees()
  const { payslips: roomPayslips, sendPayslip } = useRoom()

  const templates: PaymentTemplate[] = (companyProfile as any)?.paymentTemplates ?? []

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__direct__')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [p2pFailed, setP2pFailed] = useState(false)

  // Resolve employee info
  const employee = useMemo(() => {
    if (!route) return null
    return rosterEmployees.find((e) => e.id === route.employeeId) ?? null
  }, [route, rosterEmployees])

  const employeePartyId = employee?.cantonPartyId ?? ''

  // Determine default template from the payment card's template binding
  // (The route doesn't store templateId on-ledger, so we default to Direct Payment)
  useEffect(() => {
    if (!open) return
    setSelectedTemplateId('__direct__')
    setSent(false)
    setError(null)
    setP2pFailed(false)
  }, [open])

  // Get send history from room payslips (filtered by route)
  const sendHistory = useMemo(() => {
    if (!route || !employeePartyId) return []
    return roomPayslips.filter((p: any) => p.routeId === route.id && p.recipient === employeePartyId)
  }, [roomPayslips, route?.id, employeePartyId])

  // Build the filled HTML for preview
  const filledHtml = useMemo(() => {
    if (!route) return ''
    const template = selectedTemplateId === '__direct__'
      ? null
      : templates.find((t) => t.id === selectedTemplateId)
    const baseHtml = template?.html || DEFAULT_PAYSIP_HTML
    return fillHtml(baseHtml, {
      companyName: companyProfile?.companyName ?? '',
      period: route.completedAt ? formatPeriod(route.completedAt) : route.createdAt.slice(0, 7),
      employeeName: employee?.displayName ?? route.employeeId,
      country: employee?.country ?? '',
      currency: route.payCurrency,
      grossPay: route.grossPay,
      netPay: route.netPay ?? route.grossPay,
      fxRate: route.fxRate ?? '',
      memo: route.memo ?? '',
      txHash: route.txHash ?? '',
      taxAmount: route.taxAmount ?? '',
      socialSecurity: route.socialSecurityAmount ?? '',
      withholding: route.withholdingAmount ?? '',
    })
  }, [route, selectedTemplateId, templates, companyProfile, employee])

  async function handleSend() {
    if (!route || !employeePartyId) return
    setSending(true)
    setError(null)
    setP2pFailed(false)
    try {
      // 1. Build the payslip data for the P2P HyperDB collection
      const payslipData = {
        id: `payslip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        recipient: employeePartyId,
        routeId: route.id,
        employeeId: route.employeeId,
        employeeName: employee?.displayName ?? '',
        period: route.completedAt ? formatPeriod(route.completedAt) : route.createdAt.slice(0, 7),
        grossPay: route.grossPay,
        netPay: route.netPay ?? route.grossPay,
        currency: route.payCurrency,
        companyName: companyProfile?.companyName ?? '',
        html: filledHtml,
        createdAt: Date.now(),
        sentAt: Date.now(),
      }

      // 2. Send via P2P HyperDB collection (Autobase syncs to all peers)
      sendPayslip(payslipData)

      // 3. Register on-ledger (existing 4-arg signature)
      try {
        await bridge.contracts.createPayslip(
          CONTRACTS.COMPANY,
          employeePartyId,
          payslipData.id,
          route.completedAt ? formatPeriod(route.completedAt) : route.createdAt.slice(0, 7),
        )
      } catch (ledgerErr) {
        console.warn('[GeneratePayslipDrawer] On-ledger registration failed (non-blocking):', ledgerErr)
      }

      // 4. Bump the route's payslip count
      await bridge.flows.routes.bumpPayslipSend(route.flowId, route.id, {
        sentAt: new Date().toISOString(),
        sendId: payslipData.id,
      })

      setSent(true)
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <button
        type='button'
        onClick={onClose}
        disabled={sending}
        style={{
          padding: '6px 14px',
          background: '#fff',
          color: '#0a0a5c',
          border: '1px solid #e0e0f0',
          borderRadius: 4,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {sent ? 'Close' : 'Cancel'}
      </button>
      {!sent && (
        <button
          type='button'
          onClick={handleSend}
          disabled={sending || !employeePartyId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: sending ? '#999' : '#1A1AE8',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: sending ? 'not-allowed' : 'pointer',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {sending ? <Loader2 size={12} className='animate-spin' /> : <Send size={12} />}
          {sending ? 'Sending…' : 'Send Payslip'}
        </button>
      )}
    </div>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={sent ? 'Payslip Sent' : 'Send Payslip'}
      subtitle={employee?.displayName ?? route?.employeeId ?? ''}
      width='640px'
      footer={footer}
    >
      {error && (
        <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(200,48,48,0.06)', border: '1px dashed #c83030', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#c83030' }}>
          {error}
        </div>
      )}

      {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={20} color='#16a34a' />
          </div>
          <div style={{ fontFamily: 'ui-sans-serif, sans-serif', fontSize: 14, fontWeight: 500, color: '#0a0a5c', textAlign: 'center' }}>
            Payslip sent successfully
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#666', textAlign: 'center' }}>
            Saved to employee drive and registered on-ledger
          </div>
          {p2pFailed && (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b45309', textAlign: 'center', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 4, padding: '6px 12px' }}>
              P2P broadcast failed — employee-cli may not receive this payslip until they reconnect
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Template selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
              Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d0d0e8',
                borderRadius: 4,
                fontFamily: 'ui-sans-serif, sans-serif',
                fontSize: 12,
                color: '#0a0a5c',
                background: '#fff',
              }}
            >
              <option value='__direct__'>Direct Payment — No deductions</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Live HTML preview */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
              Preview
            </label>
            <div style={{ border: '1px solid #e0e0f0', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
              <iframe
                srcDoc={filledHtml}
                title='Payslip preview'
                sandbox='allow-same-origin'
                style={{ width: '100%', height: 400, border: 'none' }}
              />
            </div>
          </div>

          {/* Send history */}
          {sendHistory.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <History size={12} color='#888' />
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888' }}>
                  Send history ({sendHistory.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sendHistory.map((p: any, i: number) => (
                  <div key={p.id ?? i} style={{ padding: '6px 8px', background: '#f7f7fc', border: '1px solid #e0e0f0', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#666' }}>
                      {formatDate(p.sentAt ?? '')}
                    </span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#888' }}>
                      {p.id?.slice(0, 20)}…
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
