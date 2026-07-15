import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { bridge } from '../lib/bridge'

interface BlockInfo {
  blockStart: string
  blockEnd: string
  status: string
}

interface Employee {
  contractId: string
  employer: string
  employee: string
  companyName: string
  displayName: string
  role: string
  blocks: Record<string, BlockInfo>
  points: number
  offset: number
}

interface AttendanceBlock {
  blockStart: string
  blockEnd: string
  status: string
  employee: string
  companyName: string
}

interface HeatmapEntry {
  day: string
  hour: string
  count: number
}

interface ContractsContextValue {
  jpycBalance: number
  employees: Employee[]
  allBlocks: AttendanceBlock[]
  totalCheckInHours: number
  heatmapData: HeatmapEntry[]
  loading: boolean
  error: string | null
  fetchBalance: (partyId: string) => Promise<void>
  fetchEmployees: (partyId: string) => Promise<void>
  refresh: () => Promise<void>
}

const ContractsContext = createContext<ContractsContextValue | null>(null)

// Compute heatmap data from blocks
function computeHeatmap(blocks: AttendanceBlock[]): HeatmapEntry[] {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const HOURS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24']
  const result: HeatmapEntry[] = []

  for (const day of DAYS) {
    for (const hour of HOURS) {
      result.push({ day, hour, count: 0 })
    }
  }

  for (const block of blocks) {
    if (block.status !== 'Confirmed' && block.status !== 'Open') continue
    const start = new Date(block.blockStart)
    const dayIdx = (start.getDay() + 6) % 7 // Mon=0, Sun=6
    if (dayIdx >= 5) continue // Skip weekends
    const day = DAYS[dayIdx]
    const hourIdx = Math.floor(start.getHours() / 4)
    const hour = HOURS[Math.min(hourIdx, 5)]
    const entry = result.find(e => e.day === day && e.hour === hour)
    if (entry) entry.count++
  }

  return result
}

// Compute total check-in hours from all confirmed/open blocks
function computeTotalHours(blocks: AttendanceBlock[]): number {
  let totalMs = 0
  for (const block of blocks) {
    if (block.status !== 'Confirmed' && block.status !== 'Open') continue
    const start = new Date(block.blockStart)
    const end = new Date(block.blockEnd)
    totalMs += end.getTime() - start.getTime()
  }
  return Math.round(totalMs / 3600000 * 10) / 10
}

export function ContractsProvider({ children }: { children: ReactNode }) {
  const [jpycBalance, setJpycBalance] = useState(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partyId, setPartyId] = useState<string | null>(null)
  const mounted = useRef(true)

  // Compute attendance data from employees
  const allBlocks = useMemo(() => {
    const blocks: AttendanceBlock[] = []
    for (const emp of employees) {
      for (const block of Object.values(emp.blocks)) {
        blocks.push({
          ...block,
          employee: emp.displayName,
          companyName: emp.companyName
        })
      }
    }
    return blocks
  }, [employees])

  const totalCheckInHours = useMemo(() => computeTotalHours(allBlocks), [allBlocks])
  const heatmapData = useMemo(() => computeHeatmap(allBlocks), [allBlocks])

  const fetchBalance = useCallback(async (id: string) => {
    if (!mounted.current) return
    setLoading(true)
    setError(null)
    try {
      const balance = await bridge.contracts.getJPYCBalance(id)
      if (!mounted.current) return
      setJpycBalance(balance)
      setPartyId(id)
    } catch (e) {
      console.error('[Contracts] Failed to fetch balance:', e)
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : 'Failed to fetch balance')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  const fetchEmployees = useCallback(async (id: string) => {
    if (!mounted.current) return
    setLoading(true)
    setError(null)
    try {
      const emps = await bridge.contracts.getEmployees(id)
      if (!mounted.current) return
      setEmployees(emps as Employee[])
      setPartyId(id)
    } catch (e) {
      console.error('[Contracts] Failed to fetch employees:', e)
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : 'Failed to fetch employees')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (partyId) {
      await fetchBalance(partyId)
      await fetchEmployees(partyId)
    }
  }, [partyId, fetchBalance, fetchEmployees])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const value = useMemo(() => ({
    jpycBalance, employees, allBlocks, totalCheckInHours, heatmapData,
    loading, error, fetchBalance, fetchEmployees, refresh
  }), [jpycBalance, employees, allBlocks, totalCheckInHours, heatmapData, loading, error, fetchBalance, fetchEmployees, refresh])

  return (
    <ContractsContext.Provider value={value}>
      {children}
    </ContractsContext.Provider>
  )
}

export function useContracts(): ContractsContextValue {
  const ctx = useContext(ContractsContext)
  if (!ctx) {
    throw new Error('useContracts must be used within a ContractsProvider')
  }
  return ctx
}
