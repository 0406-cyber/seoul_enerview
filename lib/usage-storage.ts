import type { UsageCarbonDetails } from "@/lib/carbon-categories"

export type UsageRecord = {
  date: string
  elec_kwh: number
  gas_m3: number
  co2_kg: number
} & Partial<UsageCarbonDetails>

const key = (username: string) => `eco_usage_${username}`

export function loadUsageHistory(username: string): UsageRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key(username))
    if (!raw) return []
    const parsed = JSON.parse(raw) as UsageRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendUsageLocal(username: string, row: UsageRecord): UsageRecord[] {
  const prev = loadUsageHistory(username)
  const next = [...prev, row]
  localStorage.setItem(key(username), JSON.stringify(next))
  return next
}
