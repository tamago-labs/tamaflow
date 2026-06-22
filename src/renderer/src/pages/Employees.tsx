import PageHeader from '../components/PageHeader'
import { Plus } from 'lucide-react'

/**
 * Employees placeholder — top-level list of employees. The plan is for
 * each row to link to a per-employee payslip detail later.
 */
export default function Employees() {
  return (
    <div>
      <PageHeader
        label="People"
        title="Employees"
        subtitle="Manage the people you pay. Add employees manually or import a roster to seed a new flow."
        actions={
          <button
            type="button"
            className="flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            <Plus size={12} />
            Add Employee
          </button>
        }
      />

      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-border bg-brand-light">
              <th className="text-left font-mono text-[10px] tracking-wider2 text-brand-muted uppercase py-3 px-4 font-semibold">
                Name
              </th>
              <th className="text-left font-mono text-[10px] tracking-wider2 text-brand-muted uppercase py-3 px-4 font-semibold">
                Country
              </th>
              <th className="text-left font-mono text-[10px] tracking-wider2 text-brand-muted uppercase py-3 px-4 font-semibold">
                Currency
              </th>
              <th className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase py-3 px-4 font-semibold">
                Last Paid
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="py-10 text-center font-sans text-sm text-brand-muted">
                No employees yet. Add one to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
