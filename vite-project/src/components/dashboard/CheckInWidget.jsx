import { useCallback, useEffect, useState } from 'react'
import { attendanceApi } from '../../api/attendanceApi'
import { leaveApi } from '../../api/leaveApi'
import { useToast } from '../feedback/Toast'
import { Button } from '../ui/Button'
import { Card, Badge } from '../ui/Card'
import { companyToday, formatTime } from '../../utils/format'
import { apiErrorText } from '../../utils/validation'

export function CheckInWidget({ timezone = 'Asia/Karachi', canAct = false }) {
  const toast = useToast()
  const today = companyToday(timezone)
  const [now, setNow] = useState(new Date())
  const [record, setRecord] = useState(null)
  const [onLeave, setOnLeave] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [data, leaveData] = await Promise.all([
      attendanceApi.list({ from: today, to: today, limit: 1 }),
      leaveApi.list({ from: today, to: today, state: 'approved', limit: 100 }),
    ])
    setRecord(data?.items?.[0] || null)
    setOnLeave((leaveData?.items || []).some((request) => request.days?.some((day) => day.date === today)))
  }, [today])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    load().catch(() => {})
    const refresh = setInterval(() => load().catch(() => {}), 15000)
    return () => { clearInterval(timer); clearInterval(refresh) }
  }, [load])

  async function act(kind) {
    setLoading(true)
    try {
      const data = kind === 'in' ? await attendanceApi.checkIn() : await attendanceApi.checkOut()
      setRecord(data)
      toast.success(kind === 'in' ? 'Checked in' : 'Checked out')
    } catch (error) {
      toast.error(apiErrorText(error, error.status === 409 ? 'Already recorded for today' : 'Attendance action failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Web attendance · server timestamp</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false })}
          </p>
          <p className="text-sm text-slate-500">{today}</p>
        </div>
        <Badge tone={onLeave && !record?.checkIn ? 'slate' : record?.status === 'late' ? 'amber' : record?.checkIn ? 'emerald' : 'rose'}>
          {record?.checkIn ? record.status : onLeave ? 'Leave' : record?.status || 'Absent'}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Check-in</dt>
          <dd>{formatTime(record?.checkIn, timezone)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Check-out</dt>
          <dd>{formatTime(record?.checkOut, timezone)}</dd>
        </div>
      </dl>
      {canAct ? (
        <div className="mt-4 flex gap-2">
          <Button loading={loading} disabled={Boolean(record?.checkIn)} onClick={() => act('in')}>
            Check in
          </Button>
          <Button variant="outline" loading={loading} disabled={!record?.checkIn || Boolean(record?.checkOut)} onClick={() => act('out')}>
            Check out
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Link an employee profile to use web check-in.</p>
      )}
    </Card>
  )
}
