import { useState, useEffect } from 'react'
import Drawer from '../Drawer'
import { useEmployees } from '../../context/EmployeeContext'
import { useContracts } from '../../context/ContractsContext'
import { useWallet } from '../../context/WalletContext'
import type { Employee } from '../../ai/types'

interface AddEmployeeDrawerProps {
  open: boolean
  onClose: () => void
}

export function AddEmployeeDrawer({ open, onClose }: AddEmployeeDrawerProps) {
  const { employees: localEmployees } = useEmployees()
  const { fetchEmployees } = useContracts()
  const { status } = useWallet()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)

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
    }
  }, [open])

  const handleSubmit = async () => {
    if (!selectedEmployee || !status?.partyId) return
    setSaving(true)
    try {
      // TODO: Exercise AddEmployee choice on CompanyProfile contract
      console.log('[AddEmployee] Creating employee record:', {
        employee: selectedEmployee.cantonPartyId,
        displayName,
        role
      })
      // After success, refresh employees list
      await fetchEmployees(status.partyId)
      onClose()
    } catch (e) {
      console.error('[AddEmployee] Failed:', e)
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
