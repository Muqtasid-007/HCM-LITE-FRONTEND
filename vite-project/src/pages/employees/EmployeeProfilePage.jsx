import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { employeeApi } from '../../api/employeeApi'
import { leaveApi } from '../../api/leaveApi'
import { payrollApi } from '../../api/payrollApi'
import { Alert, EmptyState, Loader } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { isStaff, useAuth } from '../../context/AuthContext'
import { formatDateTime, formatPkr, formatTime, statusTone, unitName } from '../../utils/format'
import { apiErrorText } from '../../utils/validation'

export function EmployeeProfilePage() {
  const { id } = useParams()
  const { user, units, policy } = useAuth()
  const toast = useToast()
  const tz = policy?.timezone || 'Asia/Karachi'
  const own = id === 'me' || String(user?.employeeId) === String(id)
  const allowed = isStaff(user) || own

  const [data, setData] = useState(null)
  const [balance, setBalance] = useState(null)
  const [error, setError] = useState('')
  const [self, setSelf] = useState({ phone: '', address: '' })
  const [savingSelf, setSavingSelf] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    if (!allowed) return
    employeeApi
      .get(id)
      .then((payload) => {
        setData(payload)
        setSelf({ phone: payload.employee?.phone || '', address: payload.employee?.address || '' })
        const targetId = payload.employee?._id || id
        const year = Number(new Date().getFullYear())
        return leaveApi.balances(targetId, year)
      })
      .then(setBalance)
      .catch((err) => setError(apiErrorText(err, 'Could not load employee profile')))
  }, [id, allowed])

  if (!allowed) return <Navigate to="/dashboard" replace />
  if (!data && !error) return <Loader label="Loading employee profile" />
  if (error) return <Alert>{error}</Alert>

  const employee = data.employee
  const latestSalary = employee.salaryHistory?.at(-1)

  async function saveSelf(event) {
    event.preventDefault()
    setSavingSelf(true)
    try {
      await employeeApi.patch(employee._id, { phone: self.phone.trim(), address: self.address.trim() })
      toast.success('Contact information updated')
      setData((current) => ({
        ...current,
        employee: { ...current.employee, phone: self.phone.trim(), address: self.address.trim() },
      }))
    } catch (err) {
      toast.error(apiErrorText(err, 'Could not update contact info'))
    } finally {
      setSavingSelf(false)
    }
  }

  async function downloadSlip(runId, employeeId) {
    setDownloadingId(`${runId}-${employeeId}`)
    try {
      await payrollApi.downloadPdf(runId, employeeId)
      toast.success('Payslip downloaded')
    } catch (err) {
      toast.error(apiErrorText(err, 'Download failed'))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{employee.name}</h1>
            <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            Code: <span className="font-semibold text-slate-700">{employee.code}</span> · Email: {employee.email}
          </p>
        </div>
        <div className="flex gap-2">
          {isStaff(user) ? (
            <Link to="/employees">
              <Button variant="outline">Directory</Button>
            </Link>
          ) : null}
          {user?.role === 'HR' ? (
            <Link to={`/employees/${employee._id}/edit`}>
              <Button>Edit profile</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Top Details & Leave Balance */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Employment Overview</h2>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><dt className="text-slate-500">Department</dt><dd className="font-medium">{unitName(units, employee.departmentId)}</dd></div>
            <div><dt className="text-slate-500">Designation</dt><dd className="font-medium">{unitName(units, employee.designationId)}</dd></div>
            <div><dt className="text-slate-500">Joining Date</dt><dd className="font-medium">{employee.joiningDate}</dd></div>
            <div><dt className="text-slate-500">Current Basic Salary</dt><dd className="font-semibold text-emerald-700">{formatPkr(latestSalary?.basicMinor)}</dd></div>
            <div><dt className="text-slate-500">Gender</dt><dd className="font-medium capitalize">{employee.gender || 'Unspecified'}</dd></div>
            <div><dt className="text-slate-500">Emergency Contact</dt><dd className="font-medium">{employee.emergencyContact || '—'}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{employee.phone || '—'}</dd></div>
            <div><dt className="text-slate-500">Address</dt><dd className="font-medium">{employee.address || '—'}</dd></div>
            {employee.exitDate ? (
              <div><dt className="text-slate-500">Exit Date</dt><dd className="font-medium text-rose-700">{employee.exitDate}</dd></div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Annual Leave Balances</h2>
          <div className="space-y-2">
            {(balance?.types || []).length === 0 ? (
              <p className="text-sm text-slate-500">No leave policies recorded.</p>
            ) : (
              (balance?.types || []).map((item) => (
                <div key={item.type} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0">
                  <span className="capitalize font-medium text-slate-700">{item.type}</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900">
                      {item.remaining == null ? 'Unlimited' : `${item.remaining} left`}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Used {item.used} of {item.quota ?? '∞'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Self-service Contact Updates */}
      {own ? (
        <Card>
          <h2 className="mb-1 text-base font-semibold text-slate-900">Self-service: Update Contact Details</h2>
          <p className="mb-3 text-xs text-slate-500">
            Employees and linked HR members can update their own residential address and telephone number directly.
          </p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveSelf}>
            <Input label="Phone" value={self.phone} onChange={(e) => setSelf({ ...self, phone: e.target.value })} />
            <Input label="Address" value={self.address} onChange={(e) => setSelf({ ...self, address: e.target.value })} />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={savingSelf}>Save contact info</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Career Timelines (Status & Salary Versions) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Employment Status History</h2>
          <Table
            rows={employee.employmentHistory || []}
            empty="No history recorded"
            columns={[
              { key: 'effectiveDate', header: 'Effective Date' },
              { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            ]}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Salary Versions History</h2>
          <Table
            rows={employee.salaryHistory || []}
            empty="No salary revisions"
            columns={[
              { key: 'effectiveDate', header: 'Effective Date' },
              { key: 'basicMinor', header: 'Basic Salary', render: (row) => formatPkr(row.basicMinor) },
            ]}
          />
        </Card>
      </div>

      {/* Attendance History (Latest 31) */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Attendance (Latest 31)</h2>
          <Badge tone="slate">{(data.attendance || []).length} rows</Badge>
        </div>
        <Table
          rows={data.attendance || []}
          empty="No attendance records recorded yet"
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            { key: 'checkIn', header: 'Check In', render: (row) => formatTime(row.checkIn, tz) },
            { key: 'checkOut', header: 'Check Out', render: (row) => formatTime(row.checkOut, tz) },
            { key: 'late', header: 'Late Flag', render: (row) => (row.late ? <Badge tone="amber">Late</Badge> : 'On-time') },
            { key: 'minutes', header: 'Minutes', render: (row) => (row.minutes ? `${row.minutes}m` : '—') },
          ]}
        />
      </Card>

      {/* Leave History (Latest 20) */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Leave Requests (Latest 20)</h2>
          <Badge tone="slate">{(data.leaves || []).length} requests</Badge>
        </div>
        <Table
          rows={data.leaves || []}
          empty="No leave requests filed"
          columns={[
            { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
            { key: 'start', header: 'Start Date' },
            { key: 'end', header: 'End Date' },
            { key: 'days', header: 'Days', render: (row) => row.days?.length || 0 },
            { key: 'state', header: 'State', render: (row) => <Badge tone={statusTone(row.state)}>{row.state}</Badge> },
            { key: 'reason', header: 'Reason' },
            { key: 'comment', header: 'HR Note', render: (row) => row.comment || '—' },
          ]}
        />
      </Card>

      {/* Published Payslips */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Published Monthly Payslips</h2>
          <Badge tone="emerald">{(data.payslips || []).length} slips</Badge>
        </div>
        {(data.payslips || []).length === 0 ? (
          <EmptyState title="No published payslips yet" body="Monthly payslips will appear once finalized by Admin." />
        ) : (
          <Table
            rows={data.payslips || []}
            rowKey="runId"
            columns={[
              { key: 'month', header: 'Month', render: (row) => <span className="font-semibold text-slate-800">{row.month}</span> },
              { key: 'grossMinor', header: 'Gross', render: (row) => formatPkr(row.grossMinor) },
              { key: 'deductionsMinor', header: 'Deductions', render: (row) => formatPkr(row.deductionsMinor) },
              { key: 'taxMinor', header: 'Tax', render: (row) => formatPkr(row.taxMinor) },
              { key: 'netMinor', header: 'Net Pay', render: (row) => <span className="font-semibold text-emerald-700">{formatPkr(row.netMinor)}</span> },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <div className="flex gap-2">
                    <Link
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                      to={`/payroll/payslips/${row.runId}/${employee._id}`}
                    >
                      View Breakdown
                    </Link>
                    <Button
                      variant="outline"
                      loading={downloadingId === `${row.runId}-${employee._id}`}
                      onClick={() => downloadSlip(row.runId, employee._id)}
                    >
                      PDF
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <p className="text-xs text-slate-400">Profile synchronized {formatDateTime(new Date().toISOString(), tz)}</p>
    </div>
  )
}
