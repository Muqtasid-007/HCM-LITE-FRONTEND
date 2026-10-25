import { useEffect, useState } from 'react'
import { commsApi } from '../../api/commsApi'
import { AuditDiffModal } from '../../components/comms/AuditDiffModal'
import { Alert, EmptyState } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Textarea } from '../../components/ui/Input'
import { Pagination, Table } from '../../components/ui/Table'
import { isStaff, useAuth } from '../../context/AuthContext'
import { collectionFrom } from '../../utils/params'
import { companyToday, formatDateTime } from '../../utils/format'
import { apiErrorText, fieldErrors } from '../../utils/validation'

const tabsFor = (role) => {
  const tabs = [
    { id: 'announcements', label: 'Announcements' },
    { id: 'notifications', label: 'Notifications' },
  ]
  if (role === 'Admin') tabs.push({ id: 'audit', label: 'Audit Logs' })
  return tabs
}

export function CommsAuditPage() {
  const { user, policy } = useAuth()
  const toast = useToast()
  const tz = policy?.timezone || 'Asia/Karachi'
  const today = companyToday(tz)
  const tabs = tabsFor(user?.role)
  const [tab, setTab] = useState('announcements')

  const [announcements, setAnnouncements] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [notifications, setNotifications] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [audits, setAudits] = useState({ items: [], total: 0, page: 1, limit: 20 })

  const [form, setForm] = useState({ title: '', body: '' })
  const [auditDates, setAuditDates] = useState({ from: '', to: today })
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState(null)

  async function loadAnnouncements(page = 1) {
    try {
      const data = await commsApi.announcements({ page, limit: 20 })
      setAnnouncements(collectionFrom(data))
    } catch (err) {
      setError(apiErrorText(err))
    }
  }

  async function loadNotifications(page = 1) {
    try {
      const data = await commsApi.notifications({ page, limit: 20 })
      setNotifications(collectionFrom(data))
    } catch (err) {
      setError(apiErrorText(err))
    }
  }

  async function loadAudits(page = 1) {
    if (user?.role !== 'Admin') return
    try {
      const query = { page, limit: 20 }
      if (auditDates.from) query.from = auditDates.from
      if (auditDates.to) query.to = auditDates.to
      const data = await commsApi.auditLogs(query)
      setAudits(collectionFrom(data))
    } catch (err) {
      setError(apiErrorText(err))
    }
  }

  useEffect(() => {
    Promise.all([
      loadAnnouncements(),
      loadNotifications(),
      user?.role === 'Admin' ? loadAudits() : Promise.resolve(),
    ]).catch((err) => setError(apiErrorText(err)))
  }, [user?.role])

  async function postAnnouncement(event) {
    event.preventDefault()
    const errors = fieldErrors(form, { title: { required: true }, body: { required: true } })
    if (Object.keys(errors).length) return toast.error(Object.values(errors)[0])

    setPosting(true)
    try {
      await commsApi.createAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
      })
      setForm({ title: '', body: '' })
      toast.success('Announcement broadcasted')
      await loadAnnouncements()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to post announcement'))
    } finally {
      setPosting(false)
    }
  }

  async function markNotificationRead(id) {
    try {
      await commsApi.markRead(id)
      await loadNotifications(notifications.page)
    } catch (err) {
      toast.error(apiErrorText(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Communications & Audit</h1>
        <p className="text-sm text-slate-500">
          Company broadcasts, real-time activity notifications, and immutable administrative audit trail.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? 'primary' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {/* Announcements Tab */}
      {tab === 'announcements' ? (
        <div className="space-y-6">
          {isStaff(user) ? (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Create Announcement</h2>
              <form className="grid gap-3" onSubmit={postAnnouncement}>
                <Input
                  label="Title"
                  placeholder="e.g. Office Holiday Notice"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <Textarea
                  label="Message body"
                  placeholder="Enter company announcement text (rendered safely as plain text)..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={posting}>
                    Post Announcement
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Company Announcements</h2>
              <Badge tone="slate">{announcements.total} total</Badge>
            </div>
            {announcements.items.length === 0 ? (
              <EmptyState title="No announcements yet" body="Company broadcasts from HR and Admin will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {announcements.items.map((item) => (
                  <li key={item._id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900 text-base">{item.title}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(item.createdAt, tz)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{item.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={announcements.page}
              limit={announcements.limit}
              total={announcements.total}
              onPage={loadAnnouncements}
            />
          </Card>
        </div>
      ) : null}

      {/* Notifications Tab */}
      {tab === 'notifications' ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Activity Notifications</h2>
            <Badge tone="slate">{notifications.total} total</Badge>
          </div>
          {notifications.items.length === 0 ? (
            <EmptyState title="No notifications" body="You are all caught up!" />
          ) : (
            <Table
              rows={notifications.items}
              columns={[
                { key: 'title', header: 'Notification', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
                { key: 'createdAt', header: 'Timestamp', render: (row) => formatDateTime(row.createdAt, tz) },
                {
                  key: 'readAt',
                  header: 'Status',
                  render: (row) => (row.readAt ? <Badge tone="slate">Read</Badge> : <Badge tone="amber">Unread</Badge>),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row) =>
                    row.readAt ? null : (
                      <Button variant="outline" onClick={() => markNotificationRead(row._id)}>
                        Mark as read
                      </Button>
                    ),
                },
              ]}
            />
          )}
          <Pagination
            page={notifications.page}
            limit={notifications.limit}
            total={notifications.total}
            onPage={loadNotifications}
          />
        </Card>
      ) : null}

      {/* Audit Logs Tab (Admin Only) */}
      {tab === 'audit' && user?.role === 'Admin' ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">System Audit Trail</h2>
              <p className="text-xs text-slate-500">Immutable transaction logs with before/after state diffs.</p>
            </div>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                loadAudits(1)
              }}
            >
              <Input
                type="date"
                placeholder="From date"
                value={auditDates.from}
                onChange={(e) => setAuditDates({ ...auditDates, from: e.target.value })}
              />
              <Input
                type="date"
                max={today}
                placeholder="To date"
                value={auditDates.to}
                onChange={(e) => setAuditDates({ ...auditDates, to: e.target.value })}
              />
              <Button type="submit">Filter</Button>
            </form>
          </div>

          <Table
            rows={audits.items}
            empty="No audit logs matching query"
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
              { key: 'entityId', header: 'Target ID', render: (row) => <span className="font-mono text-xs">{row.entityId}</span> },
              {
                key: 'diff',
                header: '',
                render: (row) => (
                  <Button variant="outline" onClick={() => setSelectedAudit(row)}>
                    State Diff
                  </Button>
                ),
              },
            ]}
          />
          <Pagination page={audits.page} limit={audits.limit} total={audits.total} onPage={loadAudits} />
        </Card>
      ) : null}

      {/* Audit Diff Modal */}
      <AuditDiffModal log={selectedAudit} onClose={() => setSelectedAudit(null)} />
    </div>
  )
}
