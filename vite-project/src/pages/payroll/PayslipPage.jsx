import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { payrollApi } from '../../api/payrollApi'
import { Alert, Loader } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Table } from '../../components/ui/Table'
import { isStaff, useAuth } from '../../context/AuthContext'
import { formatPkr, titleCase, statusTone } from '../../utils/format'
import { apiErrorText } from '../../utils/validation'

export function PayslipPage() {
  const { runId, employeeId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const own = String(user?.employeeId) === String(employeeId)
  const allowed = isStaff(user) || own
  const [slip, setSlip] = useState(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!allowed) return
    payrollApi
      .getPayslip(runId, employeeId)
      .then(setSlip)
      .catch((err) => setError(apiErrorText(err, 'Payslip not available')))
  }, [runId, employeeId, allowed])

  if (!allowed) return <Navigate to="/dashboard" replace />
  if (!slip && !error) return <Loader label="Loading payslip details" />
  if (error) return <Alert>{error}</Alert>

  async function handleDownload() {
    setDownloading(true)
    try {
      await payrollApi.downloadPdf(runId, employeeId)
      toast.success('Downloaded payslip PDF')
    } catch (err) {
      toast.error(apiErrorText(err, 'Download failed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{slip.companyName}</span>
            <Badge tone={statusTone(slip.state)}>{slip.state}</Badge>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Payslip · {slip.month}</h1>
          <p className="text-sm text-slate-600">
            {slip.employeeName} · {slip.employeeCode} · Currency: {slip.currency}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/payroll">
            <Button variant="outline">Back to Payroll</Button>
          </Link>
          <Button loading={downloading} onClick={handleDownload}>
            Download PDF
          </Button>
        </div>
      </div>

      {/* Salary & Net Pay Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">Basic Pay (Prorated)</p>
          <p className="text-lg font-semibold text-slate-900">{formatPkr(slip.basicMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">House Rent Allowance (40%)</p>
          <p className="text-lg font-semibold text-slate-900">{formatPkr(slip.hraMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Medical Allowance (10%)</p>
          <p className="text-lg font-semibold text-slate-900">{formatPkr(slip.medicalMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Gross Monthly Earnings</p>
          <p className="text-lg font-semibold text-slate-900">{formatPkr(slip.grossMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Absence / Unpaid Deductions</p>
          <p className="text-lg font-semibold text-rose-700">{formatPkr(slip.deductionsMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Income Tax (Apportioned)</p>
          <p className="text-lg font-semibold text-rose-700">{formatPkr(slip.taxMinor)}</p>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <p className="text-xs font-semibold text-emerald-800">Net Take-Home Pay</p>
          <p className="text-2xl font-bold text-emerald-900">{formatPkr(slip.netMinor)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Workdays / Eligible Days</p>
          <p className="text-lg font-semibold text-slate-900">{slip.workingDays} / {slip.eligibleDays}</p>
          <p className="text-xs text-slate-500">Absent: {slip.absentDays} · Unpaid: {slip.unpaidDays} · Half: {slip.halfDays}</p>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Daily Calculation Breakdown</h2>
          <span className="text-xs text-slate-500">Based on date-effective policy and salary version</span>
        </div>
        <Table
          rows={slip.breakdown || []}
          rowKey="date"
          empty="No daily calculation snapshots"
          columns={[
            { key: 'date', header: 'Date', render: (row) => <span className="font-mono text-sm">{row.date}</span> },
            {
              key: 'reason',
              header: 'Day Status',
              render: (row) => {
                const tones = {
                  payable: 'emerald',
                  paid_leave: 'emerald',
                  unpaid_leave: 'rose',
                  absent: 'rose',
                  half_day: 'amber',
                }
                return <Badge tone={tones[row.reason] || 'slate'}>{titleCase(row.reason)}</Badge>
              },
            },
            { key: 'grossMonthlyMinor', header: 'Applicable Gross', render: (row) => formatPkr(row.grossMonthlyMinor) },
            { key: 'perDayMinor', header: 'Per-Day Rate', render: (row) => formatPkr(row.perDayMinor) },
            { key: 'deductionFactor', header: 'Deduction Factor', render: (row) => row.deductionFactor > 0 ? `${row.deductionFactor * 100}%` : '0%' },
            { key: 'policyEffectiveDate', header: 'Policy Effective', render: (row) => row.policyEffectiveDate || '—' },
          ]}
        />
      </Card>

      <p className="text-xs text-slate-400">
        Amounts use challenge rules and are not statutory tax advice. Saved payroll snapshots are immutable once finalized.
      </p>
    </div>
  )
}
