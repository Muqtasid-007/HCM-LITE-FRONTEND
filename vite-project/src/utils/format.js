export const DEFAULT_TZ = 'Asia/Karachi'
export const DEFAULT_OFFSET = '+05:00'

export function companyToday(timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function companyTomorrow(timeZone = DEFAULT_TZ) {
  const today = companyToday(timeZone)
  const [y, m, d] = today.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

export function getTimezoneOffset(timeZone = DEFAULT_TZ, dateStr = companyToday(timeZone)) {
  try {
    const date = new Date(`${dateStr}T12:00:00Z`)
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).format(date)
    const match = formatted.match(/GMT([+-]\d{2}:\d{2})/)
    if (match) return match[1]
    if (formatted.includes('GMT')) return '+00:00'
  } catch (e) {
    void e
  }
  return DEFAULT_OFFSET
}

export function companyMonth(timeZone = DEFAULT_TZ) {
  return companyToday(timeZone).slice(0, 7)
}

export function monthStart(month) {
  return `${month}-01`
}

export function monthEnd(month) {
  const [year, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

export function previousMonth(month = companyMonth()) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatPkr(minor) {
  if (minor === null || minor === undefined || minor === '') return '—'
  const value = Number(minor) / 100
  return `PKR ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-PK', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}%`
}

export function formatDateTime(iso, timeZone = DEFAULT_TZ) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatTime(iso, timeZone = DEFAULT_TZ) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function titleCase(value) {
  if (!value) return '—'
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function localDateTimeParts(iso, timeZone = DEFAULT_TZ) {
  if (!iso) return { date: '', time: '' }
  const date = new Date(iso)
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return { date: datePart, time: timePart }
}

export function toOffsetIso(date, time, offset = DEFAULT_OFFSET) {
  const hhmmss = time.length === 5 ? `${time}:00` : time
  return `${date}T${hhmmss}${offset}`
}

export function utf8ByteLength(value) {
  return new TextEncoder().encode(value || '').length
}

export function currentPolicy(company, today = companyToday()) {
  const policies = company?.policies || []
  if (!policies.length) return null
  const dated = policies
    .map((entry) => {
      if (entry?.policy && typeof entry.policy === 'object') {
        return { effectiveDate: entry.effectiveDate, ...entry.policy }
      }
      return entry
    })
    .filter((entry) => entry?.effectiveDate && entry.effectiveDate <= today)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  return dated.at(-1) || null
}

export function unitMap(units = []) {
  return Object.fromEntries((units || []).map((unit) => [unit._id || unit.id, unit]))
}

export function unitName(units, id) {
  if (!id) return '—'
  const found = (units || []).find((unit) => (unit._id || unit.id) === id)
  return found?.name || id
}

export function weekendLabel(days = []) {
  const names = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }
  return (days || []).map((d) => names[d] || d).join(', ') || '—'
}

export function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['present', 'approved', 'active', 'finalized', 'published'].includes(value)) {
    return 'emerald'
  }
  if (['late', 'pending', 'probation', 'draft', 'half_day'].includes(value)) return 'amber'
  if (['absent', 'rejected', 'exited', 'inactive', 'error'].includes(value)) return 'rose'
  if (['on_leave', 'open', 'cancelled'].includes(value)) return 'slate'
  return 'slate'
}

export function roleLabel(role) {
  return titleCase(role)
}
