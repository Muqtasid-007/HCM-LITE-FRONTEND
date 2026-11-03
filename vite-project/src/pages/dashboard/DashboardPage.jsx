import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../api/analyticsApi'
import { employeeApi } from '../../api/employeeApi'
import { aiApi } from '../../api/aiApi'
import { CheckInWidget } from '../../components/dashboard/CheckInWidget'
import { Modal } from '../../components/common/Modal'
import { Alert, EmptyState, SkeletonCards } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Input'
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
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [dryRun, setDryRun] = useState(null)
  const [importing, setImporting] = useState(false)

  const departments = useMemo(() => units.filter((unit) => unit.kind === 'department'), [units])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = { from: filters.from, to: filters.to }
      if ((user?.role === 'Admin' || user?.role === 'HR') && filters.departmentId) query.departmentId = filters.departmentId
      setData(await analyticsApi.dashboard(query))
    } catch (err) {
      setError(apiErrorText(err, 'Could not load dashboard analytics'))
    } finally {
      setLoading(false)
    }
  }, [filters.departmentId, filters.from, filters.to, user])

  useEffect(() => {
    load()
  }, [load])

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

  async function runImport(dry) {
    if (!csv.trim()) {
      return toast.error('Please paste or upload CSV text first')
    }
    setImporting(true)
    try {
      const result = await employeeApi.importCsv({ csv: csv.trim(), dryRun: dry })
      if (dry) {
        setDryRun(result)
        toast.success(result.valid ? 'Dry-run validation successful' : 'Dry-run found validation errors')
      } else {
        toast.success(`Imported ${result.imported} employees. Save temporary passwords now.`)
        setDryRun(result)
        await load()
      }
    } catch (err) {
      setDryRun({ errors: err.errors || [], message: apiErrorText(err) })
      toast.error(apiErrorText(err, 'Import failed'))
    } finally {
      setImporting(false)
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Active Headcount" value={formatNumber(data.headcount)} />
            <Kpi label="Attrition Rate" value={formatPercent(data.attritionPercent)} hint={`${data.exits || 0} exits in range`} />
            <Kpi label="Finalized Payroll" value={formatPkr(data.payroll?.grossMinor)} />
            <Kpi label="Average Gross Salary" value={formatPkr(data.averageGrossMinor)} />
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-emerald-600 bg-white">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Employee Management</h2>
              <p className="text-xs text-slate-500">
                Bulk import personnel via CSV, export employee directory data, or onboard new employees.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => { setImportOpen(true); setDryRun(null); }}>
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  employeeApi
                    .exportCsv(filters.departmentId ? { departmentId: filters.departmentId } : {})
                    .catch((err) => toast.error(apiErrorText(err, 'Export failed')))
                }
              >
                Export CSV
              </Button>
              <Link to="/employees/new">
                <Button>Add Employee</Button>
              </Link>
            </div>
          </Card>
        </>
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
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Daily Employee Attendance (Past 14 Days)</h2>
            <Table
              rows={data.attendanceDetails || []}
              empty="No employee attendance activity in this range"
              columns={[
                { key: 'date', header: 'Date', render: (row) => <span className="font-mono text-xs">{row.date}</span> },
                { key: 'employee', header: 'Employee Name', render: (row) => <Link className="font-medium text-emerald-700 hover:underline" to={`/employees/${row.employee._id}`}>{row.employee.name}</Link> },
                { key: 'role', header: 'Role', render: (row) => row.employee.role },
                { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'late' ? 'amber' : row.status === 'absent' ? 'rose' : row.status === 'on_leave' ? 'slate' : 'emerald'}>{row.status === 'on_leave' ? 'On Leave' : row.status.charAt(0).toUpperCase() + row.status.slice(1)}</Badge> },
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

      {/* CSV Import Modal */}
      <Modal open={importOpen} title="Import Employees via CSV" onClose={() => setImportOpen(false)}>
        <p className="mb-2 text-sm text-slate-600">
          Required headers: <span className="font-mono text-xs font-semibold text-slate-800">code,email,name,departmentId,designationId,joiningDate,basicSalary,gender</span>.
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Always run dry-run validation first. Atomically imports 1–500 rows; any single error rejects the batch entirely.
        </p>

        <Textarea
          className="font-mono text-xs"
          rows={5}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`code,email,name,departmentId,designationId,joiningDate,basicSalary,gender\nENG001,alice@example.com,Alice,0123456789abcdef01234567,0123456789abcdef01234568,2026-10-01,80000,female`}
        />

        <div className="mt-3 flex items-center justify-between">
          <input
            className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              file.text().then(setCsv)
            }}
          />
          <div className="flex gap-2">
            <Button variant="outline" loading={importing} onClick={() => runImport(true)}>
              Validate (Dry-run)
            </Button>
            <Button
              loading={importing}
              disabled={!dryRun || !dryRun.valid || (dryRun.errors || []).length > 0}
              onClick={() => runImport(false)}
            >
              Confirm Import
            </Button>
          </div>
        </div>

        {dryRun ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">
                Processed rows: {dryRun.rowCount ?? dryRun.imported ?? '—'}
              </span>
              <Badge tone={dryRun.valid || dryRun.imported != null ? 'emerald' : 'rose'}>
                {dryRun.valid || dryRun.imported != null ? 'Valid' : 'Errors found'}
              </Badge>
            </div>

            {(dryRun.errors || []).length ? (
              <div className="max-h-48 overflow-y-auto">
                <Table
                  rows={dryRun.errors}
                  rowKey="row"
                  columns={[
                    { key: 'row', header: 'CSV Row', render: (row) => `Row ${row.row}` },
                    { key: 'field', header: 'Field' },
                    { key: 'reason', header: 'Reason' },
                  ]}
                />
              </div>
            ) : dryRun.dryRun ? (
              <Alert tone="emerald">CSV validation passed without any row errors. You can proceed with import.</Alert>
            ) : null}

            {dryRun.items ? (
              <div className="space-y-3 pt-2">
                <Alert tone="amber">
                  Employees imported! Temporary passwords were generated once. Copy and store them securely before closing this dialog.
                </Alert>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const text = dryRun.items
                        .map((it) => `${it.employee?.code} | ${it.employee?.name} | ${it.user?.email || it.employee?.email} | Password: ${it.temporaryPassword}`)
                        .join('\n')
                      navigator.clipboard?.writeText(text)
                      toast.success('All credentials copied to clipboard')
                    }}
                  >
                    Copy All Credentials
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <Table
                    rows={dryRun.items}
                    rowKey={(row) => row.employee?._id || row.employee?.code}
                    columns={[
                      { key: 'code', header: 'Code', render: (row) => row.employee?.code },
                      { key: 'name', header: 'Name', render: (row) => row.employee?.name },
                      { key: 'email', header: 'Email', render: (row) => row.user?.email || row.employee?.email },
                      {
                        key: 'password',
                        header: 'Temporary Password',
                        render: (row) => (
                          <span className="font-mono font-bold text-emerald-800 select-all bg-emerald-50 px-2 py-0.5 rounded">
                            {row.temporaryPassword}
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
