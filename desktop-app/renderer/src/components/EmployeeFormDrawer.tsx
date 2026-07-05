import Drawer from './Drawer'
import EmployeeForm from './EmployeeForm'
import { useEmployees } from '../context/EmployeeContext'
import type { Employee } from '../../ai/types'

interface EmployeeFormDrawerProps {
  open: boolean
  onClose: () => void
  initial?: Employee
}

export default function EmployeeFormDrawer({ open, onClose, initial }: EmployeeFormDrawerProps) {
  const { add, update } = useEmployees()

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
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      subtitle={initial?.displayName ?? 'New roster entry'}
    >
      <EmployeeForm
        initial={initial}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </Drawer>
  )
}
