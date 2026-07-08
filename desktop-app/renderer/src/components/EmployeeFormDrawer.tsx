import { useState } from 'react'
import Drawer from './Drawer'
import EmployeeForm from './EmployeeForm'
import { ObligationsDrawer } from './employee/ObligationsDrawer'
import { useEmployees } from '../context/EmployeeContext'
import type { Employee } from '../../ai/types'

interface EmployeeFormDrawerProps {
  open: boolean
  onClose: () => void
  initial?: Employee
}

export default function EmployeeFormDrawer({ open, onClose, initial }: EmployeeFormDrawerProps) {
  const { add, update } = useEmployees()
  const [obligationsOpen, setObligationsOpen] = useState(false)

  const isEdit = !!initial

  async function handleSubmit(data: Employee) {
    if (isEdit && initial) {
      await update(initial.id, data)
    } else {
      await add(data)
    }
    onClose()
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
      >
        <EmployeeForm
          initial={initial}
          submitLabel={isEdit ? 'Save Changes' : 'Add Employee'}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />

        {/* Obligations button - only show when editing */}
        {isEdit && initial && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setObligationsOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 transition"
            >
              <span>📋</span>
              Tax Obligations
              {initial.taxObligation && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Tax set</span>}
              {initial.socialSecurity && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">SS set</span>}
            </button>
          </div>
        )}
      </Drawer>

      {/* Obligations Drawer */}
      <ObligationsDrawer
        open={obligationsOpen}
        onClose={() => setObligationsOpen(false)}
        employee={initial ?? null}
      />
    </>
  )
}
