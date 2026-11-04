import { useEffect, useMemo, useState } from 'react'
import { Doughnut, Line } from 'react-chartjs-2'
import { analyticsApi } from '../../api/analyticsApi'
import '../../lib/chartSetup'
import { Alert } from '../feedback/Skeleton'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const periods = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const statuses = [
  { key: 'present', label: 'Present', color: '#10b981' },
  { key: 'late', label: 'Late', color: '#f59e0b' },
  { key: 'absent', label: 'Absent', color: '#f43f5e' },
  { key: 'on_leave', label: 'On Leave', color: '#0ea5e9' },
]

const hexToRgba = (hex, alpha) => {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function chartTheme() {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    dark,
    text: dark ? '#cbd5e1' : '#475569',
    muted: dark ? '#94a3b8' : '#64748b',
    grid: dark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(226, 232, 240, 0.9)',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
  }
}

export function AttendanceAnalytics() {
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(chartTheme)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setTheme(chartTheme())
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    analyticsApi.attendanceSummary(period)
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (active) setError('Could not load attendance analytics')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [period])

  const totals = data?.totals || { present: 0, late: 0, absent: 0, on_leave: 0 }
  const totalCount = statuses.reduce((sum, status) => sum + (totals[status.key] || 0), 0)
  const trendRows = data?.trend || []

  const doughnutData = useMemo(() => ({
    labels: statuses.map((status) => status.label),
    datasets: [{
      data: statuses.map((status) => totals[status.key] || 0),
      backgroundColor: statuses.map((status) => status.color),
      borderColor: theme.dark ? '#0f172a' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }), [theme.dark, totals.absent, totals.late, totals.on_leave, totals.present])

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.text,
        bodyColor: theme.text,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (item) => {
            const value = Number(item.raw) || 0
            const percent = totalCount ? Math.round((value / totalCount) * 100) : 0
            return ` ${item.label}: ${value} (${percent}%)`
          },
        },
      },
    },
  }), [theme, totalCount])

  const lineData = useMemo(() => ({
    labels: trendRows.map((row) => (period === 'day' ? row.label : String(row.label || row.date || '').slice(5))),
    datasets: statuses.map((status) => ({
      label: status.label,
      data: trendRows.map((row) => row[status.key] || 0),
      borderColor: status.color,
      backgroundColor: hexToRgba(status.color, 0.12),
      pointBackgroundColor: status.color,
      pointBorderColor: theme.dark ? '#0f172a' : '#ffffff',
      pointRadius: trendRows.length > 20 ? 2 : 3.5,
      pointHoverRadius: 5,
      borderWidth: 2.25,
      tension: 0.35,
      fill: false,
    })),
  }), [period, theme.dark, trendRows])

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: theme.text,
          boxWidth: 10,
          usePointStyle: true,
          padding: 16,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.text,
        bodyColor: theme.text,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: theme.grid, drawBorder: false },
        ticks: { color: theme.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        ticks: { color: theme.muted, precision: 0 },
        grid: { color: theme.grid, drawBorder: false },
      },
    },
  }), [theme])

  return (
    <section className="space-y-4" aria-labelledby="attendance-analytics-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="attendance-analytics-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Attendance Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data ? `${data.from} to ${data.to}` : 'Choose a timeframe to explore attendance.'}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Attendance timeframe">
          {periods.map((item) => (
            <Button
              key={item.key}
              type="button"
              className="px-3 py-1.5"
              variant={period === item.key ? 'primary' : 'ghost'}
              aria-pressed={period === item.key}
              onClick={() => setPeriod(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative min-h-[22rem] dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">Attendance Breakdown</h3>
          {loading && !data ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading attendance…</p>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
              <div className="relative h-52 w-52 shrink-0">
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{totalCount}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">employee days</span>
                </div>
              </div>
              <ul className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-1">
                {statuses.map((status) => (
                  <li key={status.key} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-slate-600 dark:text-slate-300">{status.label}</span>
                    <strong className="ml-auto pl-2 tabular-nums text-slate-900 dark:text-slate-100">{totals[status.key] || 0}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {loading && data ? <span className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden /> : null}
        </Card>

        <Card className="relative min-h-[22rem] dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">
            {period === 'day' ? 'Hourly Check-in Trend' : 'Attendance Trend'}
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {period === 'day' ? 'Check-ins per hour' : 'Employee days per date'}
          </p>
          {loading && !data ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading attendance…</p>
          ) : (
            <div className="h-64 w-full">
              <Line data={lineData} options={lineOptions} />
            </div>
          )}
          {loading && data ? <span className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden /> : null}
        </Card>
      </div>
    </section>
  )
}
