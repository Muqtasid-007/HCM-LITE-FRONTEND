import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/authApi'
import { Alert } from '../../components/feedback/Skeleton'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/feedback/Toast'
import { AuthLayout } from '../../layouts/AuthLayout'
import { apiErrorText, apiFieldErrors, fieldErrors } from '../../utils/validation'

const WEEKEND_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

export function FirstRunSetupPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { setInitializationRequired } = useAuth()
  const [form, setForm] = useState({
    companyName: '',
    email: '',
    password: '',
    timezone: 'Asia/Karachi',
    officeStart: '09:00',
    officeEnd: '18:00',
    graceMinutes: 15,
    halfDayHours: 5,
    weekendDays: [6, 7],
    officeLatitude: 0,
    officeLongitude: 0,
    geofenceRadius: 150,
  })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState('')
  const [loading, setLoading] = useState(false)

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleWeekend(day) {
    setForm((current) => ({
      ...current,
      weekendDays: current.weekendDays.includes(day)
        ? current.weekendDays.filter((item) => item !== day)
        : [...current.weekendDays, day].sort(),
    }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    const nextErrors = fieldErrors(form, {
      companyName: { required: true },
      email: { required: true, email: true },
      password: { required: true, password: true },
      officeStart: { required: true, time: true },
      officeEnd: { required: true, time: true },
      graceMinutes: { required: true, min: 0 },
      geofenceRadius: { required: true, gt: 0 },
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setLoading(true)
    setAlert('')
    try {
      await authApi.initialize({
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        password: form.password,
        policy: {
          timezone: form.timezone,
          officeStart: form.officeStart,
          officeEnd: form.officeEnd,
          graceMinutes: Number(form.graceMinutes),
          halfDayHours: Number(form.halfDayHours),
          weekendDays: form.weekendDays,
          officeLatitude: Number(form.officeLatitude),
          officeLongitude: Number(form.officeLongitude),
          geofenceRadius: Number(form.geofenceRadius),
        },
      })
      setInitializationRequired(false)
      toast.success('Company initialized. Sign in with the Admin account.')
      navigate('/login', { replace: true })
    } catch (error) {
      setErrors(apiFieldErrors(error.errors))
      setAlert(apiErrorText(error, 'Setup failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="First-run setup" subtitle="Create the company profile and the first Admin account.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {alert ? <Alert>{alert}</Alert> : null}
        <Input label="Company name" name="companyName" value={form.companyName} error={errors.companyName} onChange={(e) => update('companyName', e.target.value)} />
        <Input label="Admin email" name="email" type="email" value={form.email} error={errors.email} onChange={(e) => update('email', e.target.value)} />
        <Input label="Admin password" name="password" type="password" value={form.password} error={errors.password} onChange={(e) => update('password', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Office start" name="officeStart" value={form.officeStart} error={errors.officeStart} onChange={(e) => update('officeStart', e.target.value)} />
          <Input label="Office end" name="officeEnd" value={form.officeEnd} error={errors.officeEnd} onChange={(e) => update('officeEnd', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Grace minutes" name="graceMinutes" type="number" min="0" value={form.graceMinutes} error={errors.graceMinutes} onChange={(e) => update('graceMinutes', e.target.value)} />
          <Input label="Half-day hours" name="halfDayHours" type="number" min="0.1" step="0.1" value={form.halfDayHours} onChange={(e) => update('halfDayHours', e.target.value)} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Weekend days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKEND_OPTIONS.map((day) => (
              <label key={day.value} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={form.weekendDays.includes(day.value)} onChange={() => toggleWeekend(day.value)} />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Office latitude" name="officeLatitude" type="number" step="any" value={form.officeLatitude} onChange={(e) => update('officeLatitude', e.target.value)} />
          <Input label="Office longitude" name="officeLongitude" type="number" step="any" value={form.officeLongitude} onChange={(e) => update('officeLongitude', e.target.value)} />
        </div>
        <Input label="Geofence radius (m)" name="geofenceRadius" type="number" value={form.geofenceRadius} error={errors.geofenceRadius} onChange={(e) => update('geofenceRadius', e.target.value)} />
        <Button type="submit" loading={loading} className="w-full">
          Initialize company
        </Button>
      </form>
    </AuthLayout>
  )
}
