import { useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analyticsApi'
import { Alert } from '../feedback/Skeleton'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const statuses = [
  { key: 'present', label: 'Present', color: '#16a34a' },
  { key: 'late', label: 'Late', color: '#f97316' },
  { key: 'absent', label: 'Absent', color: '#ef4444' },
  { key: 'on_leave', label: 'On Leave', color: '#3b82f6' },
]
const ranges = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

function DonutChart({ totals }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const total = statuses.reduce((sum, status) => sum + (totals?.[status.key] || 0), 0)
  const segments = statuses.map((status, index) => {
    const value = totals?.[status.key] || 0
    const length = total ? (value / total) * circumference : 0
    const offset = statuses.slice(0, index).reduce((sum, previous) => sum + ((totals?.[previous.key] || 0) / (total || 1)) * circumference, 0)
    return { status, value, length, offset }
  })

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <svg className="h-44 w-44 shrink-0" viewBox="0 0 140 140" role="img" aria-label="Attendance status distribution">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {segments.map(({ status, value, length, offset }) => (
            <circle
              key={status.key}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={status.color}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${status.label}: ${value}`}</title>
            </circle>
        ))}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-900 text-2xl font-semibold">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="fill-slate-500 text-[9px]">employee days</text>
      </svg>
      <ul className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-1">
        {statuses.map((status) => (
          <li key={status.key} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
            <span className="text-slate-600">{status.label}</span>
            <strong className="ml-auto pl-2 tabular-nums text-slate-900">{totals?.[status.key] || 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendChart({ rows, range }) {
  const width = 720
  const height = 300
  const padding = { top: 18, right: 16, bottom: 44, left: 42 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const series = range === 'day' ? statuses.slice(0, 2) : statuses
  const maxValue = Math.max(1, ...rows.flatMap((row) => series.map((status) => row[status.key] || 0)))
  const x = (index) => padding.left + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth)
  const y = (value) => padding.top + plotHeight - (value / maxValue) * plotHeight
  const labelStep = Math.max(1, Math.ceil(rows.length / 6))

  return (
    <div className="overflow-x-auto">
      <svg className="min-w-[560px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={range === 'day' ? 'Hourly attendance check-ins' : 'Daily attendance trend'}>
        {[0, 1, 2, 3].map((tick) => {
          const value = (maxValue * tick) / 3
          const yPos = y(value)
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeDasharray="3 4" />
              <text x={padding.left - 8} y={yPos + 4} textAnchor="end" className="fill-slate-500 text-[10px]">{Math.round(value)}</text>
            </g>
          )
        })}
        {series.map((status) => {
          const points = rows.map((row, index) => `${x(index)},${y(row[status.key] || 0)}`).join(' ')
          return (
            <g key={status.key}>
              <polyline points={points} fill="none" stroke={status.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {rows.map((row, index) => (
                <circle key={`${status.key}-${row.label}`} cx={x(index)} cy={y(row[status.key] || 0)} r="3" fill={status.color}>
                  <title>{`${row.label} · ${status.label}: ${row[status.key] || 0}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {rows.map((row, index) => (index % labelStep === 0 || index === rows.length - 1 ? (
          <text key={row.label} x={x(index)} y={height - 14} textAnchor="middle" className="fill-slate-500 text-[10px]">{range === 'day' ? row.label : row.label.slice(5)}</text>
        ) : null))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {series.map((status) => (
          <span key={status.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />{status.label}
          </span>
        ))}
        <span className="ml-auto text-slate-400">{range === 'day' ? 'Check-ins per hour' : 'Employee days per date'}</span>
      </div>
    </div>
  )
}

export function AttendanceAnalytics() {
  const [range, setRange] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setData(null)
    setError('')
    analyticsApi.attendanceSummary(range)
      .then((result) => { if (active) setData(result) })
      .catch(() => { if (active) setError('Could not load attendance analytics') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range])

  return (
    <section className="space-y-4" aria-labelledby="attendance-analytics-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="attendance-analytics-title" className="text-lg font-semibold text-slate-900">Attendance Analytics</h2>
          <p className="text-xs text-slate-500">{data ? `${data.from} to ${data.to}` : 'Choose a timeframe to explore attendance.'}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" aria-label="Attendance timeframe">
          {ranges.map((item) => (
            <Button key={item.key} type="button" className="px-3 py-1.5" variant={range === item.key ? 'primary' : 'ghost'} aria-pressed={range === item.key} onClick={() => setRange(item.key)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Attendance Breakdown</h3>
          {loading && !data ? <p className="py-16 text-center text-sm text-slate-500">Loading attendance…</p> : <DonutChart totals={data?.totals} />}
        </Card>
        <Card>
          <h3 className="mb-2 font-semibold text-slate-800">{range === 'day' ? 'Hourly Check-in Trend' : 'Attendance Trend'}</h3>
          {loading && !data ? <p className="py-16 text-center text-sm text-slate-500">Loading attendance…</p> : <TrendChart rows={data?.trend || []} range={range} />}
        </Card>
      </div>
    </section>
  )
}
