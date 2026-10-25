import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { employeeApi } from '../../api/employeeApi'
import { orgApi } from '../../api/orgApi'
import { Alert } from '../../components/feedback/Skeleton'
import { Modal } from '../../components/common/Modal'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { companyToday, companyTomorrow, formatPkr } from '../../utils/format'
import { apiErrorText, apiFieldErrors, fieldErrors } from '../../utils/validation'

const empty = {
  code: '',
  email: '',
  name: '',
  departmentId: '',
  designationId: '',
  joiningDate: '',
  status: 'active',
  basicSalary: '',
  phone: '',
  address: '',
  emergencyContact: '',
  gender: '',
  exitDate: '',
  effectiveDate: '',
  salaryEffectiveDate: '',
  newBasicSalary: '',
}

export function EmployeeCreateEditPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { units, policy } = useAuth()
  const tz = policy?.timezone || 'Asia/Karachi'
  const today = companyToday(tz)
  const tomorrow = companyTomorrow(tz)

  const [form, setForm] = useState(empty)
  const [employee, setEmployee] = useState(null)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState('')
  const [loading, setLoading] = useState(false)
  const [freshUnits, setFreshUnits] = useState([])

  // Created credentials modal state
  const [createdData, setCreatedData] = useState(null)

  useEffect(() => {
    orgApi.getOrganization()
      .then((data) => setFreshUnits(data?.units || []))
      .catch(() => {})
  }, [])

  const effectiveUnits = freshUnits.length > 0 ? freshUnits : units
  const departments = useMemo(() => effectiveUnits.filter((u) => u.kind === 'department' && u.active), [effectiveUnits])
  const designations = useMemo(() => effectiveUnits.filter((u) => u.kind === 'designation' && u.active), [effectiveUnits])

  useEffect(() => {
    if (!isEdit) return
    employeeApi
      .get(id)
      .then((data) => {
        const e = data.employee
        setEmployee(e)
        setForm({
          ...empty,
          name: e.name || '',
          departmentId: e.departmentId || '',
          designationId: e.designationId || '',
          phone: e.phone || '',
          address: e.address || '',
          emergencyContact: e.emergencyContact || '',
          gender: e.gender || '',
          status: e.status || 'active',
          exitDate: e.exitDate || '',
          effectiveDate: tomorrow,
          salaryEffectiveDate: tomorrow,
        })
      })
      .catch((err) => setAlert(apiErrorText(err)))
  }, [id, isEdit, tomorrow])

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setAlert('')
    setErrors({})

    if (!isEdit) {
      const next = fieldErrors(form, {
        code: { required: true, code: true },
        email: { required: true, email: true },
        name: { required: true },
        departmentId: { required: true },
        designationId: { required: true },
        joiningDate: { required: true },
        basicSalary: { required: true, gt: 0 },
        gender: { required: true },
      })
      if (form.status === 'exited' && !form.exitDate) {
        next.exitDate = 'Exit date is required when status is exited'
      }
      if (form.exitDate && form.joiningDate && form.exitDate < form.joiningDate) {
        next.exitDate = 'Exit date cannot precede joining date'
      }
      setErrors(next)
      if (Object.keys(next).length) return

      setLoading(true)
      try {
        const body = {
          code: form.code.trim(),
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          departmentId: form.departmentId,
          designationId: form.designationId,
          joiningDate: form.joiningDate,
          status: form.status,
          basicSalary: Number(form.basicSalary),
          gender: form.gender,
        }
        if (form.phone?.trim()) body.phone = form.phone.trim()
        if (form.address?.trim()) body.address = form.address.trim()
        if (form.emergencyContact?.trim()) body.emergencyContact = form.emergencyContact.trim()
        if (form.status === 'exited' && form.exitDate) body.exitDate = form.exitDate

        const data = await employeeApi.create(body)
        toast.success('Employee created successfully')
        setCreatedData(data)
      } catch (err) {
        setErrors(apiFieldErrors(err.errors))
        setAlert(apiErrorText(err, 'Could not create employee'))
      } finally {
        setLoading(false)
      }
      return
    }

    // Edit employee flow
    const next = fieldErrors(form, {
      name: { required: true },
      departmentId: { required: true },
      designationId: { required: true },
    })

    const statusChanged = form.status !== employee?.status
    const hasExitDate = Boolean(form.exitDate)

    if (statusChanged || hasExitDate) {
      if (!form.effectiveDate) {
        next.effectiveDate = 'Status/exit change requires an effective date'
      } else if (form.effectiveDate <= today) {
        next.effectiveDate = 'Effective date must be strictly in the future (tomorrow or later)'
      }
      if (form.status === 'exited') {
        if (!form.exitDate) {
          next.exitDate = 'Exit date is required when status is exited'
        } else if (form.effectiveDate && form.exitDate < form.effectiveDate) {
          next.exitDate = 'Exit date must be on or after status effective date'
        }
      }
      if (form.exitDate && employee?.joiningDate && form.exitDate < employee.joiningDate) {
        next.exitDate = 'Exit date cannot precede joining date'
      }
    }

    if (form.newBasicSalary) {
      if (Number(form.newBasicSalary) <= 0) {
        next.newBasicSalary = 'Basic salary must be positive'
      }
      if (!form.salaryEffectiveDate) {
        next.salaryEffectiveDate = 'Salary effective date is required'
      } else if (form.salaryEffectiveDate <= today) {
        next.salaryEffectiveDate = 'Salary effective date must be in the future (tomorrow or later)'
      }
    }

    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      const body = {
        name: form.name.trim(),
        departmentId: form.departmentId,
        designationId: form.designationId,
        phone: form.phone || '',
        address: form.address || '',
        emergencyContact: form.emergencyContact || '',
        gender: form.gender,
      }
      if (statusChanged || hasExitDate) {
        body.status = form.status
        body.effectiveDate = form.effectiveDate
        if (form.exitDate) body.exitDate = form.exitDate
      }

      await employeeApi.patch(id, body)

      if (form.newBasicSalary && form.salaryEffectiveDate) {
        await employeeApi.updateSalary(id, {
          effectiveDate: form.salaryEffectiveDate,
          basicSalary: Number(form.newBasicSalary),
        })
      }

      toast.success('Employee updated successfully')
      navigate(`/employees/${id}`)
    } catch (err) {
      setErrors(apiFieldErrors(err.errors))
      setAlert(apiErrorText(err, 'Could not save employee changes'))
    } finally {
      setLoading(false)
    }
  }

  function copyCredentials() {
    if (!createdData) return
    const text = `HCM Lite Credentials:\nEmail: ${createdData.user?.email || createdData.employee?.email}\nCode: ${createdData.employee?.code}\nTemporary Password: ${createdData.temporaryPassword}`
    navigator.clipboard?.writeText(text)
    toast.success('Credentials copied to clipboard')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isEdit ? 'Edit employee' : 'Register employee'}</h1>
          <p className="text-sm text-slate-500">
            {isEdit
              ? 'Update personal metadata or schedule prospective status and salary versions.'
              : 'Create employee profile and linked user login atomically. Temporary credentials returned once.'}
          </p>
        </div>
        <Link to={isEdit ? `/employees/${id}` : '/employees'}>
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {alert ? <Alert>{alert}</Alert> : null}

      {!isEdit && (departments.length === 0 || designations.length === 0) ? (
        <Alert tone="amber">
          Attention: Organization setup requires at least one active Department and Designation before an employee can be registered. Please ensure an Administrator has created them under Organization Setup.
        </Alert>
      ) : null}

      <form className="space-y-6" onSubmit={onSubmit}>
        <Card className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-semibold">Personal & organizational details</h2>
          {!isEdit ? (
            <>
              <Input label="Employee code" placeholder="e.g. ENG001" value={form.code} error={errors.code} onChange={(e) => update('code', e.target.value)} />
              <Input label="Email address" type="email" placeholder="name@company.com" value={form.email} error={errors.email} onChange={(e) => update('email', e.target.value)} />
              <Input label="Joining date" type="date" value={form.joiningDate} error={errors.joiningDate} onChange={(e) => update('joiningDate', e.target.value)} />
              <Input label="Initial basic salary (PKR)" type="number" step="0.01" min="1" placeholder="80000" value={form.basicSalary} error={errors.basicSalary} onChange={(e) => update('basicSalary', e.target.value)} />
            </>
          ) : (
            <div className="md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">
                <span className="font-semibold">{employee?.code}</span> · {employee?.email} · Joined: {employee?.joiningDate}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Code, email, and joining date are permanent identity anchors. Current basic salary:{' '}
                {formatPkr(employee?.salaryHistory?.at(-1)?.basicMinor)}
              </p>
            </div>
          )}

          <Input label="Full name" value={form.name} error={errors.name} onChange={(e) => update('name', e.target.value)} />

          <Select label="Department" value={form.departmentId} error={errors.departmentId} onChange={(e) => update('departmentId', e.target.value)}>
            <option value="">{departments.length === 0 ? 'No active departments found (create in Organization)' : 'Select department'}</option>
            {departments.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </Select>

          <Select label="Designation" value={form.designationId} error={errors.designationId} onChange={(e) => update('designationId', e.target.value)}>
            <option value="">{designations.length === 0 ? 'No active designations found (create in Organization)' : 'Select designation'}</option>
            {designations.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </Select>

          <Select label="Gender" value={form.gender} error={errors.gender} onChange={(e) => update('gender', e.target.value)}>
            <option value="">Select gender</option>
            {['female', 'male', 'other'].map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </Select>

          <Input label="Phone number" placeholder="+92 300 1234567" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          <Input label="Emergency contact" placeholder="Contact name & phone" value={form.emergencyContact} onChange={(e) => update('emergencyContact', e.target.value)} />
          <Textarea label="Residential address" className="md:col-span-2" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </Card>

        {isEdit ? (
          <Card className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="text-lg font-semibold">Prospective Employment Status & Salary Changes</h2>
              <p className="text-xs text-slate-500">
                Employment status and salary revisions take effect on increasing future effective dates (no earlier than tomorrow in company timezone).
              </p>
            </div>

            <div>
              <Select label="Employment status" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {['active', 'probation', 'inactive', 'exited'].map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Input
                label="Status effective date (future)"
                type="date"
                min={tomorrow}
                value={form.effectiveDate}
                error={errors.effectiveDate}
                onChange={(e) => update('effectiveDate', e.target.value)}
              />
            </div>

            {form.status === 'exited' ? (
              <div className="md:col-span-2">
                <Input
                  label="Exit date (last employed date)"
                  type="date"
                  min={form.effectiveDate || tomorrow}
                  value={form.exitDate}
                  error={errors.exitDate}
                  onChange={(e) => update('exitDate', e.target.value)}
                />
              </div>
            ) : null}

            <div className="md:col-span-2 border-t border-slate-100 pt-4 grid gap-4 md:grid-cols-2">
              <Input
                label="New basic salary (PKR)"
                type="number"
                step="0.01"
                min="1"
                placeholder="Leave blank if unchanged"
                value={form.newBasicSalary}
                error={errors.newBasicSalary}
                onChange={(e) => update('newBasicSalary', e.target.value)}
              />
              <Input
                label="Salary effective date (future)"
                type="date"
                min={tomorrow}
                value={form.salaryEffectiveDate}
                error={errors.salaryEffectiveDate}
                onChange={(e) => update('salaryEffectiveDate', e.target.value)}
              />
            </div>
          </Card>
        ) : (
          <Card className="grid gap-4 md:grid-cols-2">
            <h2 className="md:col-span-2 text-lg font-semibold">Initial Employment Status</h2>
            <Select label="Status" value={form.status} onChange={(e) => update('status', e.target.value)}>
              {['active', 'probation', 'inactive', 'exited'].map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </Select>
            {form.status === 'exited' ? (
              <Input
                label="Exit date"
                type="date"
                min={form.joiningDate}
                value={form.exitDate}
                error={errors.exitDate}
                onChange={(e) => update('exitDate', e.target.value)}
              />
            ) : null}
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link to={isEdit ? `/employees/${id}` : '/employees'}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save changes' : 'Create employee'}
          </Button>
        </div>
      </form>

      {/* Temporary Password Credentials Modal */}
      <Modal open={Boolean(createdData)} title="Employee account created" onClose={() => navigate(`/employees/${createdData?.employee?._id}`)}>
        {createdData ? (
          <div className="space-y-4">
            <Alert tone="amber">
              Important: Temporary passwords are only generated once. Lost credentials require an Admin password reset.
            </Alert>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm font-mono">
              <p><span className="text-slate-500 font-sans">Name:</span> {createdData.employee?.name}</p>
              <p><span className="text-slate-500 font-sans">Employee Code:</span> {createdData.employee?.code}</p>
              <p><span className="text-slate-500 font-sans">Login Email:</span> {createdData.user?.email || createdData.employee?.email}</p>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-2">
                <span className="text-xs text-emerald-800 font-sans font-semibold block mb-1">Temporary Password:</span>
                <span className="text-base font-bold text-emerald-950 select-all">{createdData.temporaryPassword}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={copyCredentials}>
                Copy Credentials
              </Button>
              <Button onClick={() => navigate(`/employees/${createdData.employee._id}`)}>
                Open Employee Profile
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
