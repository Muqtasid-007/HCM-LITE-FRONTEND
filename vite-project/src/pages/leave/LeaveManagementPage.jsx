import { useEffect, useMemo, useState } from 'react'
import { leaveApi } from '../../api/leaveApi'
import { employeeApi } from '../../api/employeeApi'
import { Modal } from '../../components/common/Modal'
import { SmartLeaveInput } from '../../components/leave/SmartLeaveInput'
import { Alert } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Pagination, Table } from '../../components/ui/Table'
import { canCheckIn, isStaff, useAuth } from '../../context/AuthContext'
import { collectionFrom } from '../../utils/params'
import { companyToday, statusTone } from '../../utils/format'
import { apiErrorText, fieldErrors } from '../../utils/validation'

export function LeaveManagementPage() {
  const { user, policy } = useAuth()
  const toast = useToast()
  const staff = isStaff(user)
  const linked = canCheckIn(user)
  const today = companyToday(policy?.timezone)
  const year = Number(today.slice(0, 4))
  const types = policy?.leaveTypes?.filter((t) => t.active) || []
  const [balances, setBalances] = useState([])
  const [query, setQuery] = useState({ page: 1, limit: 20, state: staff ? 'pending' : '' })
  const [collection, setCollection] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [names, setNames] = useState({})
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: types[0]?.name || 'annual', start: '', end: '', reason: '' })
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  // HR Decision Modal State
  const [decisionTarget, setDecisionTarget] = useState(null)
  const [decisionComment, setDecisionComment] = useState('')
  const [deciding, setDeciding] = useState(false)

  const formTypes = useMemo(() => types, [types])

  async function load() {
    const data = await leaveApi.list(query)
    setCollection(collectionFrom(data))
    if (user?.employeeId) {
      try {
        const balance = await leaveApi.balances('me', year)
        setBalances(balance.types || [])
      } catch {}
    }
    if (staff) {
      try {
        const directory = await employeeApi.list({ page: 1, limit: 100 })
        setNames(Object.fromEntries((directory.items || []).map((e) => [String(e._id), e.name])))
      } catch {}
    }
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorText(err)))
  }, [query.page, query.state, user?.employeeId])

  async function apply(event) {
    event.preventDefault()
    const errors = fieldErrors(form, {
      type: { required: true },
      start: { required: true },
      end: { required: true, test: (value, values) => (value < values.start ? 'End must be on or after start' : '') },
      reason: { required: true },
    })
    if (Object.keys(errors).length) return toast.error(Object.values(errors)[0])
    if (form.start < today) return toast.error('Leave cannot start in the past')

    setApplying(true)
    try {
      await leaveApi.apply({ type: form.type, start: form.start, end: form.end, reason: form.reason.trim() })
      toast.success('Leave application submitted')
      setOpen(false)
      setForm({ type: types[0]?.name || 'annual', start: '', end: '', reason: '' })
      await load()
    } catch (err) {
      toast.error(apiErrorText(err, 'Leave could not be applied (overlap, quota, or not working day)'))
    } finally {
      setApplying(false)
    }
  }

  async function handleDecision(decision) {
    if (!decisionTarget) return
    if (!decisionComment.trim()) {
      return toast.error('Comment is required for every decision')
    }
    setDeciding(true)
    try {
      await leaveApi.decide(decisionTarget._id, { decision, comment: decisionComment.trim() })
      toast.success(`Leave request ${decision}`)
      setDecisionTarget(null)
      setDecisionComment('')
      await load()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to save decision'))
    } finally {
      setDeciding(false)
    }
  }

  async function handleCancel(row) {
    try {
      await leaveApi.cancel(row._id)
      toast.success('Leave cancelled')
      await load()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to cancel leave'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leave management</h1>
          <p className="text-sm text-slate-500">
            Skip weekends and holidays per company policy. Pending applications do not reserve quota. Started requests cannot be cancelled.
          </p>
        </div>
        {linked ? <Button onClick={() => setOpen(true)}>Apply for leave</Button> : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}

      {balances.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {balances.map((item) => (
            <Card key={item.type}>
              <p className="text-sm text-slate-500 capitalize">{item.type} leave</p>
              <p className="mt-1 text-2xl font-semibold">{item.remaining == null ? '∞' : item.remaining}</p>
              <p className="text-xs text-slate-500">
                Used {item.used} · Quota {item.quota ?? 'unlimited'} {item.active ? '' : '(inactive)'}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {staff ? (
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'cancelled', ''].map((state) => (
            <Button
              key={state || 'all'}
              variant={query.state === state ? 'primary' : 'outline'}
              onClick={() => setQuery({ ...query, state, page: 1 })}
            >
              {state ? state.charAt(0).toUpperCase() + state.slice(1) : 'All requests'}
            </Button>
          ))}
        </div>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{staff ? 'Leave inbox' : 'My leave requests'}</h2>
          <Badge tone="slate">{collection.total} total</Badge>
        </div>
        <Table
          rows={collection.items}
          empty="No leave records"
          columns={[
            ...(staff
              ? [
                  {
                    key: 'employee',
                    header: 'Employee',
                    render: (row) => names[String(row.employeeId)] || (String(row.employeeId) === String(user?.employeeId) ? 'You' : String(row.employeeId)),
                  },
                ]
              : []),
            { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
            { key: 'start', header: 'Start date' },
            { key: 'end', header: 'End date' },
            { key: 'days', header: 'Days', render: (row) => row.days?.length || 0 },
            { key: 'state', header: 'State', render: (row) => <Badge tone={statusTone(row.state)}>{row.state}</Badge> },
            { key: 'reason', header: 'Reason' },
            { key: 'comment', header: 'HR Note', render: (row) => row.comment || '—' },
            {
              key: 'actions',
              header: '',
              render: (row) => {
                const isOwn = String(row.employeeId) === String(user?.employeeId)
                const canCancel = linked && isOwn && ['pending', 'approved'].includes(row.state) && row.start > today

                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {canCancel ? (
                      <Button variant="outline" onClick={() => handleCancel(row)}>
                        Cancel
                      </Button>
                    ) : null}
                    {user?.role === 'HR' && row.state === 'pending' ? (
                      isOwn ? (
                        <span className="text-xs text-slate-400 italic">Self-service (cannot review)</span>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDecisionTarget(row)
                            setDecisionComment('')
                          }}
                        >
                          Review
                        </Button>
                      )
                    ) : null}
                  </div>
                )
              },
            },
          ]}
        />
        <Pagination page={collection.page} limit={collection.limit} total={collection.total} onPage={(page) => setQuery({ ...query, page })} />
      </Card>

      {/* Apply Leave Modal */}
      <Modal open={open} title="Apply for leave" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={apply}>
          {linked ? (
            <SmartLeaveInput
              onProposal={(proposal) =>
                setForm({
                  type: proposal.type,
                  start: proposal.start,
                  end: proposal.end,
                  reason: proposal.reason,
                })
              }
            />
          ) : null}
          <Select label="Leave type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {formTypes.map((type) => (
              <option key={type.name} value={type.name}>
                {type.name} ({type.paid ? `${type.quota} days/yr` : 'unpaid'})
              </option>
            ))}
          </Select>
          <Input label="Start date" type="date" min={today} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <Input label="End date" type="date" min={form.start || today} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <Textarea label="Reason for leave" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Provide business reason..." />
          <Button type="submit" loading={applying}>Submit request</Button>
        </form>
      </Modal>

      {/* HR Leave Decision Review Modal */}
      <Modal open={Boolean(decisionTarget)} title="Review leave request" onClose={() => setDecisionTarget(null)}>
        {decisionTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
              <p><span className="text-slate-500">Employee:</span> <span className="font-medium">{names[String(decisionTarget.employeeId)] || String(decisionTarget.employeeId)}</span></p>
              <p><span className="text-slate-500">Leave type:</span> <span className="font-medium capitalize">{decisionTarget.type}</span></p>
              <p><span className="text-slate-500">Duration:</span> <span className="font-medium">{decisionTarget.start} to {decisionTarget.end} ({decisionTarget.days?.length || 0} working days)</span></p>
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
