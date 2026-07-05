import { CircleDollarSign } from 'lucide-react'
import PlaceholderPage from './PlaceholderPage'

export function SettlementsPage() {
  return (
    <PlaceholderPage
      title='Settlements'
      description='Every payroll run you’ve submitted to Canton, with tx hash + per-route status. Filter by cycle, employee, or template.'
      icon={CircleDollarSign}
    />
  )
}

export default SettlementsPage
