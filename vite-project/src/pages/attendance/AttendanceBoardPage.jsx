import { useEffect, useMemo, useState } from 'react'
import { attendanceApi } from '../../api/attendanceApi'
import { leaveApi } from '../../api/leaveApi'
import { employeeApi } from '../../api/employeeApi'
import { Modal } from '../../components/common/Modal'
import { Alert, EmptyState } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Textarea } from '../../components/ui/Input'
import { Pagination, Table } from '../../components/ui/Table'
import { canCheckIn, isStaff, useAuth } from '../../context/AuthContext'
import { CheckInWidget } from '../../components/dashboard/CheckInWidget'
import { collectionFrom } from '../../utils/params'
import { companyToday, formatTime, getTimezoneOffset, monthEnd, monthStart, statusTone, toOffsetIso } from '../../utils/format'
import { apiErrorText, fieldErrors } from '../../utils/validation'

export function AttendanceBoardPage() {
  const { user, policy } = useAuth()
  const toast = useToast()
  const tz = policy?.timezone || 'Asia/Karachi'
  const staff = isStaff(user)
  const today = companyToday(tz)
  const [date, setDate] = useState(today)
  const [board, setBoard] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [names, setNames] = useState({})
  const [corrections, setCorrections] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [leaves, setLeaves] = useState([])
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ date: today, checkIn: '09:00', checkOut: '18:00', reason: '' })
  const [submittingCorrection, setSubmittingCorrection] = useState(false)
  
  // Decision modal state
  const [decisionTarget, setDecisionTarget] = useState(null)
  const [decisionComment, setDecisionComment] = useState('')
  const [deciding, setDeciding] = useState(false)

  const month = date.slice(0, 7)
  const [calendar, setCalendar] = useState([])

  async function loadBoard() {
    const data = await attendanceApi.list({ from: date, to: date, page: 1, limit: 100 })
    setBoard(collectionFrom(data))
    if (staff) {
      try {
        const directory = await employeeApi.list({ page: 1, limit: 100 })
        setNames(Object.fromEntries((directory.items || []).map((e) => [String(e._id), e.name])))
      } catch {}
      try {
        const leaveData = await leaveApi.list({ from: date, to: date, state: 'approved', limit: 100 })
        setLeaves(leaveData.items || [])
      } catch {}
    }
  }

  async function loadCorrections(page = 1) {
    const data = await attendanceApi.listCorrections({
      page,
      limit: 20,
      ...(staff ? {} : {}),
    })
    setCorrections(collectionFrom(data))
  }

  async function loadCalendar() {
    if (staff && !canCheckIn(user)) return
    const data = await attendanceApi.list({ from: monthStart(month), to: monthEnd(month), limit: 100 })
    setCalendar(data.items || [])
  }

  useEffect(() => {
    Promise.all([loadBoard(), loadCorrections(), loadCalendar()]).catch((err) => setError(apiErrorText(err)))
  }, [date, user?.role, month])

  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, open: 0, absent: 0, on_leave: leaves.length }
    for (const row of board.items) {
      if (row.status in counts) counts[row.status] += 1
      else if (row.late) counts.late += 1
    }
    return counts
  }, [board.items, leaves.length])

  async function submitCorrection(event) {
    event.preventDefault()
    const errors = fieldErrors(form, {
      date: { required: true },
      reason: { required: true },
      checkIn: { required: true },
      checkOut: { required: true },
    })
    if (Object.keys(errors).length) return toast.error(Object.values(errors)[0])
    if (form.date > today) return toast.error('Correction date cannot be in the future')
    if (form.checkOut <= form.checkIn) return toast.error('Check-out time must be after check-in time')

    const offset = getTimezoneOffset(tz, form.date)
    setSubmittingCorrection(true)
    try {
      await attendanceApi.requestCorrection({
        date: form.date,
        checkIn: toOffsetIso(form.date, form.checkIn, offset),
        checkOut: toOffsetIso(form.date, form.checkOut, offset),
        reason: form.reason.trim(),
      })
      toast.success('Correction request submitted')
      setModal(false)
      setForm({ date: today, checkIn: '09:00', checkOut: '18:00', reason: '' })
      await loadCorrections()
    } catch (err) {
      toast.error(apiErrorText(err, 'Could not submit correction request'))
    } finally {
      setSubmittingCorrection(false)
    }
  }

  async function handleDecision(decision) {
    if (!decisionTarget) return
    if (!decisionComment.trim()) {
      return toast.error('Comment is required for every decision')
    }
    setDeciding(true)
    try {
      await attendanceApi.decideCorrection(decisionTarget._id, { decision, comment: decisionComment.trim() })
      toast.success(`Correction ${decision}`)
      setDecisionTarget(null)
      setDecisionComment('')
      await Promise.all([loadCorrections(), loadBoard()])
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to save decision'))
    } finally {
      setDeciding(false)
    }
  }

  async function reconcile() {
    try {
      const [y, m, d] = today.split('-').map(Number)
      const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
      const from = monthStart(yesterday.slice(0, 7))
      const result = await attendanceApi.reconcile({ from, to: yesterday })
      toast.success(`Reconciled ${result.changed ?? 0} rows`)
      await loadBoard()
    } catch (err) {
      toast.error(apiErrorText(err, 'Reconciliation failed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{staff ? 'Attendance board' : 'My attendance'}</h1>
          <p className="text-sm text-slate-500">Server-stamped check-in/out. Corrections require both timestamps on the company-local date.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {canCheckIn(user) ? (
            <Button variant="outline" onClick={() => setModal(true)}>
              Request correction
            </Button>
          ) : null}
          {staff ? (
            <Button variant="outline" onClick={reconcile}>
              Reconcile past days
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {canCheckIn(user) ? <CheckInWidget timezone={tz} canAct /> : null}

      {staff ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Object.entries(summary).map(([key, value]) => (
            <Card key={key}>
              <p className="text-sm text-slate-500">{key.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      {staff ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Checked in on {date}</h2>
            <Badge tone="slate">{board.items.length} records</Badge>
          </div>
          <Table
            rows={board.items}
            empty="No attendance rows for this date"
            columns={[
              { key: 'employeeId', header: 'Employee', render: (row) => names[String(row.employeeId)] || String(row.employeeId) },
              { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              { key: 'checkIn', header: 'In', render: (row) => formatTime(row.checkIn, tz) },
              { key: 'checkOut', header: 'Out', render: (row) => formatTime(row.checkOut, tz) },
              { key: 'late', header: 'Late', render: (row) => (row.late ? <Badge tone="amber">Late</Badge> : 'On-time') },
              { key: 'minutes', header: 'Minutes', render: (row) => row.minutes ? `${row.minutes}m` : '—' },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 font-semibold">Calendar · {month}</h2>
          {calendar.length === 0 ? <EmptyState title="No attendance this month" /> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {calendar.map((row) => (
              <div key={row._id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium">{row.date.slice(8)}</p>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                {row.late ? <span className="ml-1 text-xs text-amber-600 font-medium">Late</span> : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{staff ? 'Correction requests' : 'My correction requests'}</h2>
          <Badge tone="slate">{corrections.total} total</Badge>
        </div>
        <Table
          rows={corrections.items}
          empty="No correction requests"
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              render: (row) => names[String(row.employeeId)] || (String(row.employeeId) === String(user?.employeeId) ? 'You' : String(row.employeeId)),
            },
            { key: 'date', header: 'Date' },
            {
              key: 'proposed',
              header: 'Proposed hours',
              render: (row) => `${formatTime(row.checkIn, tz)} – ${formatTime(row.checkOut, tz)}`,
            },
            { key: 'state', header: 'State', render: (row) => <Badge tone={statusTone(row.state)}>{row.state}</Badge> },
            { key: 'reason', header: 'Reason' },
            { key: 'comment', header: 'HR Comment', render: (row) => row.comment || '—' },
            {
              key: 'actions',
              header: '',
              render: (row) => {
                const isOwn = String(row.employeeId) === String(user?.employeeId)
                if (user?.role === 'HR' && row.state === 'pending') {
                  if (isOwn) {
                    return <span className="text-xs text-slate-400 italic">Self-service (cannot review)</span>
                  }
                  return (
                    <Button variant="outline" onClick={() => { setDecisionTarget(row); setDecisionComment(''); }}>
                      Review
                    </Button>
                  )
                }
                return null
              },
            },
          ]}
        />
        <Pagination page={corrections.page} limit={corrections.limit} total={corrections.total} onPage={loadCorrections} />
      </Card>

      {/* Request Correction Modal */}
      <Modal open={modal} title="Attendance correction request" onClose={() => setModal(false)}>
        <form className="grid gap-3" onSubmit={submitCorrection}>
          <p className="text-xs text-slate-500">
            Both proposed timestamps must fall strictly on the requested local date ({tz}). Timestamps cannot be in the future.
          </p>
          <Input label="Date" type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Check-in time (24-hour)" type="time" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          <Input label="Check-out time (24-hour)" type="time" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          <Textarea label="Reason for correction" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Explain connection failure, forgotten checkout, etc." />
          <Button type="submit" loading={submittingCorrection}>Submit request</Button>
        </form>
      </Modal>

      {/* HR Decision Review Modal */}
      <Modal open={Boolean(decisionTarget)} title="Review attendance correction" onClose={() => setDecisionTarget(null)}>
        {decisionTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
              <p><span className="text-slate-500">Employee:</span> <span className="font-medium">{names[String(decisionTarget.employeeId)] || String(decisionTarget.employeeId)}</span></p>
              <p><span className="text-slate-500">Date:</span> <span className="font-medium">{decisionTarget.date}</span></p>
              <p><span className="text-slate-500">Proposed:</span> <span className="font-medium">{formatTime(decisionTarget.checkIn, tz)} to {formatTime(decisionTarget.checkOut, tz)}</span></p>
              <p><span className="text-slate-500">Reason:</span> <span>{decisionTarget.reason}</span></p>
            </div>
            <div>
              <Textarea
                label="Reviewer comment (mandatory)"
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Enter mandatory decision note..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDecisionTarget(null)}>Cancel</Button>
              <Button variant="danger" loading={deciding} onClick={() => handleDecision('rejected')}>Reject</Button>
              <Button loading={deciding} onClick={() => handleDecision('approved')}>Approve</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
