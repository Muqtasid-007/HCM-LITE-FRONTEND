import { useEffect, useMemo, useState } from 'react'
import { orgApi } from '../../api/orgApi'
import { Modal } from '../../components/common/Modal'
import { Alert, EmptyState } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Textarea } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import { companyToday, companyTomorrow, currentPolicy, weekendLabel } from '../../utils/format'
import { apiErrorText } from '../../utils/validation'
import { Building2, Briefcase, Plus, Pencil, Trash2 } from 'lucide-react'

const WEEKEND_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

function policyToForm(policy) {
  return {
    timezone: policy?.timezone || 'Asia/Karachi',
    officeStart: policy?.officeStart || '09:00',
    officeEnd: policy?.officeEnd || '18:00',
    graceMinutes: policy?.graceMinutes ?? 15,
    halfDayHours: policy?.halfDayHours ?? 5,
    weekendDays: policy?.weekendDays || [6, 7],
    officeLatitude: policy?.officeLatitude ?? 0,
    officeLongitude: policy?.officeLongitude ?? 0,
    geofenceRadius: policy?.geofenceRadius ?? 150,
    leaveTypesText: JSON.stringify(
      policy?.leaveTypes || [
        { name: 'annual', quota: 14, paid: true, active: true },
        { name: 'sick', quota: 8, paid: true, active: true },
        { name: 'casual', quota: 10, paid: true, active: true },
        { name: 'unpaid', quota: null, paid: false, active: true },
      ],
      null,
      2,
    ),
    holidaysText: JSON.stringify(policy?.holidays || [], null, 2),
  }
}

export function OrganizationPage() {
  const { user, organization, refreshUser, refreshOrganization } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'Admin'
  const [activeTab, setActiveTab] = useState('structure') // 'structure' | 'policy'

  const policy = useMemo(
    () => currentPolicy(organization?.company, companyToday(currentPolicy(organization?.company)?.timezone)),
    [organization],
  )
  const tz = currentPolicy(organization?.company)?.timezone || 'Asia/Karachi'
  const tomorrow = companyTomorrow(tz)

  const [name, setName] = useState(organization?.company?.name || '')
  const [effectiveDate, setEffectiveDate] = useState(tomorrow)
  const [policyForm, setPolicyForm] = useState(policyToForm(policy))
  const [error, setError] = useState('')
  const [savingPolicy, setSavingPolicy] = useState(false)

  // Units Modal State (Departments & Designations)
  const [createModal, setCreateModal] = useState({ open: false, kind: 'department', name: '', active: true })
  const [editModal, setEditModal] = useState({ open: false, unit: null, name: '', active: true })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, unit: null })
  const [unitSaving, setUnitSaving] = useState(false)

  useEffect(() => {
    setName(organization?.company?.name || '')
    setPolicyForm(policyToForm(policy))
    setEffectiveDate(companyTomorrow(tz))
  }, [organization, policy, tz])

  const units = organization?.units || []
  const departments = useMemo(() => units.filter((u) => u.kind === 'department'), [units])
  const designations = useMemo(() => units.filter((u) => u.kind === 'designation'), [units])

  // Unit creation (Admin)
  async function handleCreateUnit(event) {
    event.preventDefault()
    if (!createModal.name.trim()) {
      return toast.error('Unit name is required')
    }
    setUnitSaving(true)
    try {
      await orgApi.createUnit({
        kind: createModal.kind,
        name: createModal.name.trim(),
        active: createModal.active,
      })
      toast.success(`${createModal.kind === 'department' ? 'Department' : 'Designation'} created`)
      setCreateModal({ open: false, kind: 'department', name: '', active: true })
      if (refreshOrganization) await refreshOrganization()
      else await refreshUser()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to create unit'))
    } finally {
      setUnitSaving(false)
    }
  }

  // Unit edit (Admin)
  async function handleEditUnit(event) {
    event.preventDefault()
    if (!editModal.name.trim()) {
      return toast.error('Unit name is required')
    }
    setUnitSaving(true)
    try {
      await orgApi.patchUnit(editModal.unit._id, {
        name: editModal.name.trim(),
        active: editModal.active,
      })
      toast.success(`${editModal.unit.kind === 'department' ? 'Department' : 'Designation'} updated`)
      setEditModal({ open: false, unit: null, name: '', active: true })
      if (refreshOrganization) await refreshOrganization()
      else await refreshUser()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to update unit'))
    } finally {
      setUnitSaving(false)
    }
  }

  // Toggle active status (Admin)
  async function handleToggleUnit(unit) {
    try {
      await orgApi.patchUnit(unit._id, { active: !unit.active })
      toast.success(`${unit.name} ${unit.active ? 'deactivated' : 'activated'}`)
      if (refreshOrganization) await refreshOrganization()
      else await refreshUser()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to update unit status'))
    }
  }

  // Unit delete (Admin)
  async function handleDeleteUnit() {
    if (!deleteConfirm.unit) return
    const unit = deleteConfirm.unit
    setUnitSaving(true)
    try {
      await orgApi.deleteUnit(unit._id)
      toast.success(`${unit.kind === 'department' ? 'Department' : 'Designation'} deleted`)
      setDeleteConfirm({ open: false, unit: null })
      if (refreshOrganization) await refreshOrganization()
      else await refreshUser()
    } catch (err) {
      if (err.status === 409) {
        toast.error('Cannot delete: Record is referenced by active or historical employees. Please deactivate it instead.')
      } else {
        toast.error(apiErrorText(err, 'Failed to delete unit'))
      }
    } finally {
      setUnitSaving(false)
    }
  }

  // Policy version update (Admin)
  async function savePolicy(event) {
    event.preventDefault()
    setSavingPolicy(true)
    setError('')
    try {
      const leaveTypes = JSON.parse(policyForm.leaveTypesText)
      const holidays = JSON.parse(policyForm.holidaysText)
      await orgApi.updateOrganization({
        name: name.trim(),
        effectiveDate,
        policy: {
          timezone: policyForm.timezone,
          officeStart: policyForm.officeStart,
          officeEnd: policyForm.officeEnd,
          graceMinutes: Number(policyForm.graceMinutes),
          halfDayHours: Number(policyForm.halfDayHours),
          weekendDays: policyForm.weekendDays,
          officeLatitude: Number(policyForm.officeLatitude),
          officeLongitude: Number(policyForm.officeLongitude),
          geofenceRadius: Number(policyForm.geofenceRadius),
          leaveTypes,
          holidays,
        },
      })
      toast.success('Policy version scheduled successfully')
      await refreshUser()
    } catch (err) {
      setError(apiErrorText(err, 'Could not save organization policy'))
    } finally {
      setSavingPolicy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organization Setup</h1>
          <p className="text-sm text-slate-500">
            Configure company units (Departments & Designations) and operating policies.
          </p>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <Button
          variant={activeTab === 'structure' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('structure')}
        >
          <Building2 size={16} className="mr-1.5" />
          Departments & Designations
          <span className="ml-2 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs text-slate-800">
            {units.length}
          </span>
        </Button>
        <Button
          variant={activeTab === 'policy' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('policy')}
        >
          Company Policy & Hours
        </Button>
      </div>

      {/* Tab 1: Departments & Designations */}
      {activeTab === 'structure' ? (
        <div className="space-y-6">
          {!isAdmin ? (
            <Alert tone="slate">
              You are viewing the organization structure in read-only mode. Departments and Designations are managed by Company Administrators.
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Departments Management Card */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="text-emerald-700" size={20} />
                    <h2 className="text-lg font-semibold text-slate-900">Departments</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    {departments.filter((d) => d.active).length} active of {departments.length} total
                  </p>
                </div>
                {isAdmin ? (
                  <Button
                    onClick={() =>
                      setCreateModal({ open: true, kind: 'department', name: '', active: true })
                    }
                  >
                    <Plus size={16} className="mr-1" />
                    Add Department
                  </Button>
                ) : null}
              </div>

              {departments.length === 0 ? (
                <EmptyState
                  title="No departments created"
                  body={isAdmin ? "Click 'Add Department' to define organizational departments before onboarding staff." : "No departments configured."}
                />
              ) : (
                <Table
                  rows={departments}
                  rowKey="_id"
                  columns={[
                    {
                      key: 'name',
                      header: 'Department Name',
                      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
                    },
                    {
                      key: 'active',
                      header: 'Status',
                      render: (row) => (
                        <Badge tone={row.active ? 'emerald' : 'slate'}>
                          {row.active ? 'Active' : 'Inactive'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      render: (row) =>
                        isAdmin ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditModal({ open: true, unit: row, name: row.name, active: row.active })
                              }
                            >
                              <Pencil size={14} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleToggleUnit(row)}
                            >
                              {row.active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setDeleteConfirm({ open: true, unit: row })}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ) : null,
                    },
                  ]}
                />
              )}
            </Card>

            {/* Designations Management Card */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="text-sky-700" size={20} />
                    <h2 className="text-lg font-semibold text-slate-900">Designations</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    {designations.filter((d) => d.active).length} active of {designations.length} total
                  </p>
                </div>
                {isAdmin ? (
                  <Button
                    onClick={() =>
                      setCreateModal({ open: true, kind: 'designation', name: '', active: true })
                    }
                  >
                    <Plus size={16} className="mr-1" />
                    Add Designation
                  </Button>
                ) : null}
              </div>

              {designations.length === 0 ? (
                <EmptyState
                  title="No designations created"
                  body={isAdmin ? "Click 'Add Designation' to define employee job titles before registering staff." : "No designations configured."}
                />
              ) : (
                <Table
                  rows={designations}
                  rowKey="_id"
                  columns={[
                    {
                      key: 'name',
                      header: 'Designation Title',
                      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
                    },
                    {
                      key: 'active',
                      header: 'Status',
                      render: (row) => (
                        <Badge tone={row.active ? 'emerald' : 'slate'}>
                          {row.active ? 'Active' : 'Inactive'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      render: (row) =>
                        isAdmin ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditModal({ open: true, unit: row, name: row.name, active: row.active })
                              }
                            >
                              <Pencil size={14} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleToggleUnit(row)}
                            >
                              {row.active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setDeleteConfirm({ open: true, unit: row })}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ) : null,
                    },
                  ]}
                />
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {/* Tab 2: Company Policy */}
      {activeTab === 'policy' ? (
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Current Effective Policy</h2>
            {policy ? (
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div><dt className="text-slate-500">Effective Date</dt><dd className="font-medium">{policy.effectiveDate}</dd></div>
                <div><dt className="text-slate-500">Working Hours</dt><dd className="font-medium">{policy.officeStart} – {policy.officeEnd}</dd></div>
                <div><dt className="text-slate-500">Late Grace Period</dt><dd className="font-medium">{policy.graceMinutes} minutes</dd></div>
                <div><dt className="text-slate-500">Half-Day Threshold</dt><dd className="font-medium">{policy.halfDayHours} hours</dd></div>
                <div><dt className="text-slate-500">Weekend Days</dt><dd className="font-medium">{weekendLabel(policy.weekendDays)}</dd></div>
                <div><dt className="text-slate-500">Geofence Radius</dt><dd className="font-medium">{policy.geofenceRadius} meters</dd></div>
                <div><dt className="text-slate-500">Operating Timezone</dt><dd className="font-medium">{policy.timezone}</dd></div>
                <div><dt className="text-slate-500">Active Leave Types</dt><dd className="font-medium">{policy.leaveTypes?.filter((t) => t.active).map((t) => t.name).join(', ')}</dd></div>
              </dl>
            ) : (
              <EmptyState title="No effective policy found" />
            )}
          </Card>

          {isAdmin ? (
            <Card>
              <h2 className="mb-1 text-lg font-semibold">Schedule New Policy Version</h2>
              <p className="mb-4 text-xs text-slate-500">
                Policy updates apply prospectively. New versions must have an effective date strictly no earlier than tomorrow in the company timezone.
              </p>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={savePolicy}>
                <Input label="Company name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input
                  label="Effective date (tomorrow or later)"
                  type="date"
                  min={tomorrow}
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
                <Input label="Office start" value={policyForm.officeStart} onChange={(e) => setPolicyForm({ ...policyForm, officeStart: e.target.value })} />
                <Input label="Office end" value={policyForm.officeEnd} onChange={(e) => setPolicyForm({ ...policyForm, officeEnd: e.target.value })} />
                <Input label="Grace minutes" type="number" value={policyForm.graceMinutes} onChange={(e) => setPolicyForm({ ...policyForm, graceMinutes: e.target.value })} />
                <Input label="Half-day hours" type="number" value={policyForm.halfDayHours} onChange={(e) => setPolicyForm({ ...policyForm, halfDayHours: e.target.value })} />
                <Input label="Office latitude" type="number" step="any" value={policyForm.officeLatitude} onChange={(e) => setPolicyForm({ ...policyForm, officeLatitude: e.target.value })} />
                <Input label="Office longitude" type="number" step="any" value={policyForm.officeLongitude} onChange={(e) => setPolicyForm({ ...policyForm, officeLongitude: e.target.value })} />
                <Input label="Geofence radius (meters)" type="number" value={policyForm.geofenceRadius} onChange={(e) => setPolicyForm({ ...policyForm, geofenceRadius: e.target.value })} />
                <Input label="Timezone (IANA)" value={policyForm.timezone} onChange={(e) => setPolicyForm({ ...policyForm, timezone: e.target.value })} />
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-medium text-slate-700">Weekend days</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKEND_OPTIONS.map((day) => (
                      <label key={day.value} className="flex items-center gap-1.5 text-sm bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={policyForm.weekendDays.includes(day.value)}
                          onChange={() =>
                            setPolicyForm((current) => ({
                              ...current,
                              weekendDays: current.weekendDays.includes(day.value)
                                ? current.weekendDays.filter((item) => item !== day.value)
                                : [...current.weekendDays, day.value].sort(),
                            }))
                          }
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Textarea label="Leave types JSON" className="font-mono text-xs" value={policyForm.leaveTypesText} onChange={(e) => setPolicyForm({ ...policyForm, leaveTypesText: e.target.value })} />
                <Textarea label="Public holidays JSON" className="font-mono text-xs" value={policyForm.holidaysText} onChange={(e) => setPolicyForm({ ...policyForm, holidaysText: e.target.value })} />
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" loading={savingPolicy}>
                    Save Policy Version
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Modal: Create Department or Designation */}
      <Modal
        open={createModal.open}
        title={`Add New ${createModal.kind === 'department' ? 'Department' : 'Designation'}`}
        onClose={() => setCreateModal({ ...createModal, open: false })}
      >
        <form className="space-y-4" onSubmit={handleCreateUnit}>
          <Input
            label={`${createModal.kind === 'department' ? 'Department' : 'Designation'} Name`}
            placeholder={createModal.kind === 'department' ? 'e.g. Engineering, Sales, Human Resources' : 'e.g. Senior Software Engineer, Account Executive'}
            value={createModal.name}
            onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={createModal.active}
              onChange={(e) => setCreateModal({ ...createModal, active: e.target.checked })}
            />
            Active immediately (available for employee registration)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModal({ ...createModal, open: false })}
            >
              Cancel
            </Button>
            <Button type="submit" loading={unitSaving}>
              Create {createModal.kind === 'department' ? 'Department' : 'Designation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Unit */}
      <Modal
        open={editModal.open}
        title={`Edit ${editModal.unit?.kind === 'department' ? 'Department' : 'Designation'}`}
        onClose={() => setEditModal({ ...editModal, open: false })}
      >
        <form className="space-y-4" onSubmit={handleEditUnit}>
          <Input
            label="Name"
            value={editModal.name}
            onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={editModal.active}
              onChange={(e) => setEditModal({ ...editModal, active: e.target.checked })}
            />
            Active (inactive units cannot be assigned to new profiles)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditModal({ ...editModal, open: false })}
            >
              Cancel
            </Button>
            <Button type="submit" loading={unitSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        open={deleteConfirm.open}
        title={`Delete ${deleteConfirm.unit?.kind === 'department' ? 'Department' : 'Designation'}`}
        onClose={() => setDeleteConfirm({ open: false, unit: null })}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete <strong className="text-slate-900">{deleteConfirm.unit?.name}</strong>?
          </p>
          <Alert tone="amber">
            Note: Units can only be deleted if they are not referenced by any past or current employee. If referenced, deactivate instead.
          </Alert>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, unit: null })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={unitSaving}
              onClick={handleDeleteUnit}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
