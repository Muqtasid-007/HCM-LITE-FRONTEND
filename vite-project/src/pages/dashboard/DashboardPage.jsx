import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../api/analyticsApi'
import { aiApi } from '../../api/aiApi'
import { CheckInWidget } from '../../components/dashboard/CheckInWidget'
import { Alert, EmptyState, SkeletonCards } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { canCheckIn, isStaff, useAuth } from '../../context/AuthContext'
import {
  companyToday,
  formatNumber,
  formatPercent,
  formatPkr,
  formatDateTime,
  unitName,
} from '../../utils/format'
import { apiErrorText } from '../../utils/validation'

function Kpi({ label, value, hint, tone }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  )
}

export function DashboardPage() {
  const { user, units, policy } = useAuth()
  const toast = useToast()
  const tz = policy?.timezone || 'Asia/Karachi'
  const today = companyToday(tz)
  const monthStart = `${today.slice(0, 7)}-01`
  const [filters, setFilters] = useState({ from: monthStart, to: today, departmentId: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summarizing, setSummarizing] = useState(false)

  const departments = useMemo(() => units.filter((unit) => unit.kind === 'department'), [units])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const query = { from: filters.from, to: filters.to }
      if (isStaff(user) && filters.departmentId) query.departmentId = filters.departmentId
      setData(await analyticsApi.dashboard(query))
    } catch (err) {
      setError(apiErrorText(err, 'Could not load dashboard analytics'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters.from, filters.to, filters.departmentId, user?.role])

  async function loadSummary() {
    setSummarizing(true)
    try {
      const result = await aiApi.summary({
        from: filters.from,
        to: filters.to,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      })
      setSummary(result)
    } catch (err) {
      toast.error(apiErrorText(err, 'AI summary unavailable'))
    } finally {
      setSummarizing(false)
    }
  }

  const attendance = data?.attendance || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {user?.role} view · {data?.from || filters.from} to {data?.to || filters.to}
          </p>
        </div>
        {isStaff(user) ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              load()
            }}
          >
            <Input
              type="date"
              max={filters.to || today}
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <Input
              type="date"
              min={filters.from}
              max={today}
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <Select value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((unit) => (
                <option key={unit._id} value={unit._id}>
                  {unit.name}
                </option>
              ))}
            </Select>
            <Button type="submit">Filter</Button>
          </form>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {loading ? <SkeletonCards count={4} /> : null}

      {/* Admin KPIs */}
      {!loading && data && user?.role === 'Admin' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Active Headcount" value={formatNumber(data.headcount)} />
          <Kpi label="Attrition Rate" value={formatPercent(data.attritionPercent)} hint={`${data.exits || 0} exits in range`} />
          <Kpi label="Finalized Payroll" value={formatPkr(data.payroll?.grossMinor)} />
          <Kpi label="Average Gross Salary" value={formatPkr(data.averageGrossMinor)} />
        </div>
      ) : null}

      {/* HR KPIs */}
      {!loading && data && user?.role === 'HR' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Present" value={formatNumber(attendance.present)} tone="emerald" />
          <Kpi label="On Leave" value={formatNumber(attendance.on_leave)} />
          <Kpi label="Late Flags" value={formatNumber(attendance.lateFlags)} tone="amber" />
          <Kpi label="Pending Approvals" value={formatNumber(data.pendingApprovals)} tone={data.pendingApprovals > 0 ? 'amber' : 'slate'} />
        </div>
      ) : null}

      {/* Employee KPIs & Check-in */}
      {!loading && data && user?.role === 'Employee' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CheckInWidget timezone={tz} canAct={canCheckIn(user)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi
              label="Hours Worked This Range"
              value={formatNumber(data.hoursWorked, 1)}
              hint={`Weekly target: ${data.weeklyTargetHours || 40}h`}
            />
            <Kpi label="Late Arrivals" value={formatNumber(attendance.lateFlags)} tone="amber" />
            <Kpi
              label="Latest Payslip"
              value={data.lastPayslip?.month || 'None'}
              hint={data.lastPayslip ? formatPkr(data.lastPayslip.netMinor) : 'Pending publication'}
            />
            <Card>
              <p className="text-sm text-slate-500 font-medium">Leave Remaining</p>
              <ul className="mt-2 space-y-1 text-sm divide-y divide-slate-100">
                {(data.leaveBalance?.types || []).map((item) => (
                  <li key={item.type} className="flex justify-between py-1 capitalize">
                    <span>{item.type}</span>
                    <span className="font-semibold text-slate-800">
                      {item.remaining == null ? 'Unlimited' : `${item.remaining} / ${item.quota}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Linked HR Check-in Widget */}
      {user?.role === 'HR' && canCheckIn(user) ? (
        <div className="max-w-xl">
          <CheckInWidget timezone={tz} canAct />
        </div>
      ) : null}

      {/* Trend & Departmental Breakdown */}
      {!loading && data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Attendance Trend (Past 14 Days)</h2>
            <Table
              rows={(data.trend || []).slice(-14)}
              rowKey="date"
              empty="No attendance activity in this range"
              columns={[
                { key: 'date', header: 'Date', render: (row) => <span className="font-mono text-xs">{row.date}</span> },
                { key: 'present', header: 'Present', render: (row) => <span className="text-emerald-700 font-medium">{row.present}</span> },
                { key: 'late', header: 'Late', render: (row) => <span className="text-amber-700">{row.late}</span> },
                { key: 'absent', header: 'Absent', render: (row) => <span className="text-rose-700">{row.absent}</span> },
                { key: 'on_leave', header: 'On Leave', render: (row) => <span>{row.on_leave}</span> },
              ]}
            />
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Departmental Overview</h2>
            <Table
              rows={data.byDepartment || []}
              rowKey="departmentId"
              empty="No departmental statistics"
              columns={[
                { key: 'departmentId', header: 'Department', render: (row) => unitName(units, row.departmentId) },
                { key: 'headcount', header: 'Headcount' },
                { key: 'absent', header: 'Absent' },
                { key: 'absenteeismPercent', header: 'Absenteeism', render: (row) => formatPercent(row.absenteeismPercent) },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {/* Admin Audit Feed */}
      {user?.role === 'Admin' && data?.auditFeed ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Audit Activity</h2>
            <Link to="/comms" className="text-xs font-medium text-emerald-700 hover:underline">
              View all audit logs →
            </Link>
          </div>
          <Table
            rows={data.auditFeed}
            empty="No recent audit logs"
            columns={[
              { key: 'createdAt', header: 'Timestamp', render: (row) => formatDateTime(row.createdAt, tz) },
              {
                key: 'action',
                header: 'Action',
                render: (row) => (
                  <Badge tone={row.action.includes('delete') || row.action.includes('reject') ? 'rose' : 'emerald'}>
                    {row.action}
                  </Badge>
                ),
              },
              { key: 'entity', header: 'Entity' },
            ]}
          />
        </Card>
      ) : null}

      {/* Staff AI Summary */}
      {isStaff(user) ? (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Executive AI Summary</h2>
              <p className="text-xs text-slate-500">
                Generates a live, server-computed 3–5 bullet summary based strictly on the current date range and department filter.
              </p>
            </div>
            <Button variant="outline" loading={summarizing} onClick={loadSummary}>
              Generate Summary
            </Button>
          </div>

          {summary?.fallback ? (
            <Alert tone="amber">{summary.message || 'AI provider fallback triggered. Facts are from server analytical tools.'}</Alert>
          ) : null}

          {summary?.bullets ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 leading-relaxed mt-3">
              {summary.bullets.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No summary generated yet"
              body="Click 'Generate Summary' to produce an analytical overview of the selected date range."
            />
          )}

          {summary?.label ? (
            <Badge className="mt-3" tone="sky">
              {summary.label}
            </Badge>
          ) : null}
        </Card>
      ) : null}

      {/* Last Payslip Link for Employee */}
      {data?.lastPayslip && user?.role === 'Employee' ? (
        <div className="flex justify-end">
          <Link
            className="text-sm font-semibold text-emerald-700 hover:underline"
            to={`/payroll/payslips/${data.lastPayslip.runId}/${user.employeeId}`}
          >
            Open Last Payslip Breakdown ({data.lastPayslip.month}) →
          </Link>
        </div>
      ) : null}
    </div>
  )
}
