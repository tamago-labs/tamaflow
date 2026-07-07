import { CalendarCheck } from 'lucide-react'

export function AttendancePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <CalendarCheck size={32} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-medium text-gray-900 m-0 mb-2">Coming Soon</h2>
          <p className="text-sm text-gray-500 m-0 max-w-md">
            Track employee attendance, check-ins, and work hours. 
            This feature will integrate with the P2P sync to provide 
            real-time attendance data across your teamspace.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AttendancePage
