import { Users } from 'lucide-react'
import PlaceholderPage from './PlaceholderPage'

export function EmployeesPage() {
  return (
    <PlaceholderPage
      title='Employees'
      description='Your roster. Roster CSV / PDF import, 5N ID verification status, and per-employee pay templates land here.'
      icon={Users}
    />
  )
}

export default EmployeesPage
