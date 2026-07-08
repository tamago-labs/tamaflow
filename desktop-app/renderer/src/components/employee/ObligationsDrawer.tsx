// ObligationsDrawer — edit tax and social security obligations for an employee.

import { useState } from 'react'
import Drawer from '../Drawer'
import { useEmployees } from '../../context/EmployeeContext'
import type { Employee, TaxObligation, CurrencyCode } from '../../ai/types'

const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'JPY', 'THB']
const TERMS = [
  { value: 'per_year', label: 'Per Year' },
  { value: 'per_month', label: 'Per Month' }
]

interface ObligationsDrawerProps {
  open: boolean
  onClose: () => void
  employee: Employee | null
}

export function ObligationsDrawer({ open, onClose, employee }: ObligationsDrawerProps) {
  const { update } = useEmployees()

  const [taxAmount, setTaxAmount] = useState(employee?.taxObligation?.amount ?? '')
  const [taxCurrency, setTaxCurrency] = useState<CurrencyCode>(employee?.taxObligation?.currency ?? 'USD')
  const [taxTerm, setTaxTerm] = useState<'per_year' | 'per_month'>(employee?.taxObligation?.term ?? 'per_year')

  const [ssAmount, setSsAmount] = useState(employee?.socialSecurity?.amount ?? '')
  const [ssCurrency, setSsCurrency] = useState<CurrencyCode>(employee?.socialSecurity?.currency ?? 'USD')
  const [ssTerm, setSsTerm] = useState<'per_year' | 'per_month'>(employee?.socialSecurity?.term ?? 'per_month')

  const [saving, setSaving] = useState(false)

  // Reset form when drawer opens with new employee
  useState(() => {
    if (open && employee) {
      setTaxAmount(employee.taxObligation?.amount ?? '')
      setTaxCurrency(employee.taxObligation?.currency ?? 'USD')
      setTaxTerm(employee.taxObligation?.term ?? 'per_year')
      setSsAmount(employee.socialSecurity?.amount ?? '')
      setSsCurrency(employee.socialSecurity?.currency ?? 'USD')
      setSsTerm(employee.socialSecurity?.term ?? 'per_month')
    }
  })

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      const taxObligation: TaxObligation | undefined = taxAmount.trim()
        ? { amount: taxAmount.trim(), currency: taxCurrency, term: taxTerm }
        : undefined
      const socialSecurity: TaxObligation | undefined = ssAmount.trim()
        ? { amount: ssAmount.trim(), currency: ssCurrency, term: ssTerm }
        : undefined

      await update(employee.id, { taxObligation, socialSecurity })
      onClose()
    } catch (e) {
      console.error('[ObligationsDrawer] save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Obligations"
      subtitle={employee?.displayName ?? 'Employee obligations'}
    >
      <div className="space-y-6">
        {/* Tax Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-3">Tax Withholding</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Amount</label>
              <input
                type="text"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Currency</label>
              <select
                value={taxCurrency}
                onChange={(e) => setTaxCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Term</label>
              <select
                value={taxTerm}
                onChange={(e) => setTaxTerm(e.target.value as 'per_year' | 'per_month')}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 m-0">
            Annual tax withholding amount. Will be prorated based on pay frequency.
          </p>
        </div>

        {/* Social Security Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-3">Social Security</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Amount</label>
              <input
                type="text"
                value={ssAmount}
                onChange={(e) => setSsAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Currency</label>
              <select
                value={ssCurrency}
                onChange={(e) => setSsCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Term</label>
              <select
                value={ssTerm}
                onChange={(e) => setSsTerm(e.target.value as 'per_year' | 'per_month')}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 m-0">
            Monthly social security contribution. Will be prorated based on pay frequency.
          </p>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Obligations'}</button>
        </div>
      </div>
    </Drawer>
  )
}

export default ObligationsDrawer
