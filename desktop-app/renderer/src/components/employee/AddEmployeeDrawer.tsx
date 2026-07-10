import { useState, useEffect } from 'react'
import Drawer from '../Drawer'
import { useEmployees } from '../../context/EmployeeContext'
import { useContracts } from '../../context/ContractsContext'
import { useWallet } from '../../context/WalletContext'
import { bridge } from '../../lib/bridge'
import type { Employee } from '../../ai/types'

interface AddEmployeeDrawerProps {
  open: boolean
  onClose: () => void
}

// CompanyProfile contract ID from Testnet deployment
const COMPANY_CONTRACT_ID = '00e15b031a7f4f2baf8fea8d7834add1fb975fbc7ac73b696ee516820c99032ae3ca121220718b4a6f61be1c215454a97352a659d3dcf3321f440511ef7b851e344b7d2839'

export function AddEmployeeDrawer({ open, onClose }: AddEmployeeDrawerProps) {
  const { employees: localEmployees } = useEmployees()
  const { fetchEmployees } = useContracts()
  const { status } = useWallet()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the selected employee from local storage
  const selectedEmployee = localEmployees.find((e) => e.id === selectedEmployeeId)

  // Auto-fill when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      setDisplayName(selectedEmployee.displayName)
      setRole(selectedEmployee.role || '')
    }
  }, [selectedEmployee])

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedEmployeeId('')
      setDisplayName('')
      setRole('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!selectedEmployee || !status?.partyId) return
    setSaving(true)
    setError(null)
    try {
      await bridge.contracts.addEmployee(
        COMPANY_CONTRACT_ID,
        selectedEmployee.cantonPartyId || '',
        displayName,
        role
      )
      await fetchEmployees(status.partyId)
      onClose()
    } catch (e) {
      console.error('[AddEmployee] Failed:', e)
      setError('This employee wallet was created externally and is not registered on the Canton network. Please ask the employee to register their wallet through the desktop app to allocate a party on the validator.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add Employee"
      footer={
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedEmployee || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="m-0 text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Employee Dropdown */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select employee…</option>
            {localEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.displayName} ({emp.id})
              </option>
            ))}
          </select>
        </div>

        {/* Party ID (auto-filled) */}
        {selectedEmployee && (
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Party ID</label>
            <input
              type="text"
              value={selectedEmployee.cantonPartyId || ''}
              readOnly
              className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500"
            />
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter display name"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Enter role"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </Drawer>
  )
}
