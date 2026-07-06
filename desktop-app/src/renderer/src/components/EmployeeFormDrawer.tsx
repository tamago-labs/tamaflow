import { useState } from 'react'
import Drawer from './Drawer'
import EmployeeForm from './EmployeeForm'
import { useEmployees } from '../context/EmployeeContext'
import type { Employee } from '../../../preload/index.d'

/**
 * Right-side slide-in drawer that hosts the `EmployeeForm` for both
 * create and edit flows. The drawer keeps the underlying list visible
 * to the left so the user retains context — handy when editing an
 * existing row.
 *
 * Owns the `open` / `onClose` interface; calls `useEmployees().add()`
 * for create or `.update()` for edit. Closes on success.
 */
interface EmployeeFormDrawerProps {
  open: boolean
  onClose: () => void
  /** Existing employee (edit mode). Omit to create a new row. */
  initial?: Employee
}

export default function EmployeeFormDrawer({
  open,
  onClose,
  initial
}: EmployeeFormDrawerProps) {
  const { add, update } = useEmployees()
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!initial

  const handleSubmit = async (employee: Employee) => {
    setSubmitting(true)
    try {
      if (isEdit && initial?.id) {
        await update(initial.id, employee)
      } else {
        await add(employee)
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      subtitle={isEdit ? initial.displayName : 'New roster entry'}
    >
      <EmployeeForm
        initial={initial}
        submitLabel={isEdit ? 'Save Changes' : 'Add Employee'}
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitting={submitting}
      />
    </Drawer>
  )
}