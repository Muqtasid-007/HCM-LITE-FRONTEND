import { useEffect, useState } from 'react'
import { orgApi } from '../../api/orgApi'
import { Modal } from '../../components/common/Modal'
import { Alert } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { Pagination, Table } from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import { collectionFrom } from '../../utils/params'
import { apiErrorText, fieldErrors, apiFieldErrors } from '../../utils/validation'
import { roleLabel } from '../../utils/format'

export function UsersPage() {
  const { units } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState({ page: 1, limit: 20, search: '' })
  const [collection, setCollection] = useState({ items: [], total: 0, page: 1, limit: 20 })
  const [hrEmail, setHrEmail] = useState('')
  const [creatingHr, setCreatingHr] = useState(false)
  const [temporaryCredentials, setTemporaryCredentials] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [linkingProfile, setLinkingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})
  const [profile, setProfile] = useState({
    code: '',
    email: '',
    name: '',
    departmentId: '',
    designationId: '',
    joiningDate: '',
    basicSalary: '',
    status: 'active',
    gender: '',
    phone: '',
    address: '',
    emergencyContact: '',
  })
  const [error, setError] = useState('')

  const departments = units.filter((unit) => unit.kind === 'department' && unit.active)
  const designations = units.filter((unit) => unit.kind === 'designation' && unit.active)

  async function load() {
    try {
      const data = await orgApi.getUsers(query)
      setCollection(collectionFrom(data))
    } catch (err) {
      setError(apiErrorText(err))
    }
  }

  useEffect(() => {
    load()
  }, [query.page, query.search])

  async function createHr(event) {
    event.preventDefault()
    const errors = fieldErrors({ email: hrEmail }, { email: { required: true, email: true } })
    if (errors.email) return toast.error(errors.email)

    setCreatingHr(true)
    try {
      const data = await orgApi.createHr({ email: hrEmail.trim().toLowerCase() })
      setTemporaryCredentials({
        email: data.user?.email || hrEmail.trim(),
        role: 'HR',
        temporaryPassword: data.temporaryPassword,
      })
      setHrEmail('')
      toast.success('HR account created successfully')
      await load()
    } catch (err) {
      toast.error(apiErrorText(err, 'Failed to create HR account'))
    } finally {
      setCreatingHr(false)
    }
  }

  async function act(targetUser, action) {
    try {
      const data = await orgApi[action](targetUser.id || targetUser._id)
      if (data?.temporaryPassword) {
        setTemporaryCredentials({
          email: targetUser.email,
          role: targetUser.role,
          temporaryPassword: data.temporaryPassword,
        })
      }
      toast.success(`User updated (${action.replace('User', '')})`)
      await load()
    } catch (err) {
      toast.error(apiErrorText(err, 'Operation failed'))
    }
  }

  async function submitProfile(event) {
    event.preventDefault()
    setProfileErrors({})

    const nextErrors = fieldErrors(profile, {
      code: { required: true, code: true },
      name: { required: true },
      departmentId: { required: true },
      designationId: { required: true },
      joiningDate: { required: true },
      basicSalary: { required: true, gt: 0 },
      gender: { required: true },
    })
    setProfileErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setLinkingProfile(true)
    try {
      const body = {
        code: profile.code.trim(),
        email: profileUser.email,
        name: profile.name.trim(),
        departmentId: profile.departmentId,
        designationId: profile.designationId,
        joiningDate: profile.joiningDate,
        basicSalary: Number(profile.basicSalary),
        status: profile.status,
        gender: profile.gender,
      }
      if (profile.phone?.trim()) body.phone = profile.phone.trim()
      if (profile.address?.trim()) body.address = profile.address.trim()
      if (profile.emergencyContact?.trim()) body.emergencyContact = profile.emergencyContact.trim()

      await orgApi.createHrProfile(profileUser.id || profileUser._id, body)
      toast.success('HR employee profile successfully linked')
      setProfileUser(null)
      await load()
    } catch (err) {
      setProfileErrors(apiFieldErrors(err.errors))
      toast.error(apiErrorText(err, 'Could not link HR profile'))
    } finally {
      setLinkingProfile(false)
    }
  }

  function copyCredentials() {
    if (!temporaryCredentials) return
    const text = `HCM Lite Credentials:\nEmail: ${temporaryCredentials.email}\nRole: ${temporaryCredentials.role}\nTemporary Password: ${temporaryCredentials.temporaryPassword}`
    navigator.clipboard?.writeText(text)
    toast.success('Credentials copied to clipboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">User Administration</h1>
        <p className="text-sm text-slate-500">
          Admin portal for managing logins, creating HR staff accounts, resetting credentials, and linking HR employee profiles.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {/* Create HR Login Card */}
      <Card>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Provision HR Account</h2>
        <p className="mb-3 text-xs text-slate-500">
          Generates a new login with role HR and an initial temporary password. Link their employee profile below for self-service attendance.
        </p>
        <form className="flex flex-wrap gap-3" onSubmit={createHr}>
          <Input
            placeholder="hr.manager@company.com"
            type="email"
            value={hrEmail}
            onChange={(e) => setHrEmail(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" loading={creatingHr}>
              Create HR Account
            </Button>
          </div>
        </form>
      </Card>

      {/* Users List Card */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">System Logins</h2>
          <Badge tone="slate">{collection.total} users</Badge>
        </div>
        <Table
          rows={collection.items}
          rowKey="id"
          columns={[
            { key: 'email', header: 'Email Address', render: (row) => <span className="font-medium text-slate-900">{row.email}</span> },
            { key: 'role', header: 'Role', render: (row) => <Badge tone={row.role === 'Admin' ? 'emerald' : row.role === 'HR' ? 'amber' : 'slate'}>{roleLabel(row.role)}</Badge> },
            { key: 'active', header: 'Status', render: (row) => <Badge tone={row.active ? 'emerald' : 'rose'}>{row.active ? 'Active' : 'Deactivated'}</Badge> },
            {
              key: 'employeeId',
              header: 'Employee Profile',
              render: (row) =>
                row.employeeId ? (
                  <span className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">Linked</span>
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" onClick={() => act(row, 'resetUser')}>
                    Reset Password
                  </Button>
                  {row.active ? (
                    <Button variant="danger" onClick={() => act(row, 'deactivateUser')}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => act(row, 'activateUser')}>
                      Activate
                    </Button>
                  )}
                  {row.role === 'HR' && !row.employeeId ? (
                    <Button
                      onClick={() => {
                        setProfileUser(row)
                        setProfile({
                          ...profile,
                          email: row.email,
                          code: '',
                          name: '',
                          joiningDate: '',
                          basicSalary: '',
                        })
                      }}
                    >
                      Link Profile
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={collection.page} limit={collection.limit} total={collection.total} onPage={(page) => setQuery({ ...query, page })} />
      </Card>

      {/* Temporary Password Modal */}
      <Modal open={Boolean(temporaryCredentials)} title="Temporary login credentials" onClose={() => setTemporaryCredentials(null)}>
        {temporaryCredentials ? (
          <div className="space-y-4">
            <Alert tone="amber">
              Temporary credentials are displayed once. Lost passwords require an Admin reset.
            </Alert>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm font-mono">
              <p><span className="text-slate-500 font-sans">Email:</span> {temporaryCredentials.email}</p>
              <p><span className="text-slate-500 font-sans">Role:</span> {temporaryCredentials.role}</p>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-2">
                <span className="text-xs text-emerald-800 font-sans font-semibold block mb-1">Temporary Password:</span>
                <span className="text-base font-bold text-emerald-950 select-all">{temporaryCredentials.temporaryPassword}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={copyCredentials}>
                Copy Credentials
              </Button>
              <Button onClick={() => setTemporaryCredentials(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Link HR Employee Profile Modal */}
      <Modal open={Boolean(profileUser)} title="Link HR Employee Profile" onClose={() => setProfileUser(null)}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitProfile}>
          <p className="md:col-span-2 text-xs text-slate-500">
            Initializes an employee profile linked to <strong className="text-slate-800">{profileUser?.email}</strong>. Email must match the login account.
          </p>
          <Input label="Employee code" placeholder="HR001" value={profile.code} error={profileErrors.code} onChange={(e) => setProfile({ ...profile, code: e.target.value })} />
          <Input label="Email address (fixed)" value={profileUser?.email || ''} disabled />
          <Input label="Full name" value={profile.name} error={profileErrors.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="Joining date" type="date" value={profile.joiningDate} error={profileErrors.joiningDate} onChange={(e) => setProfile({ ...profile, joiningDate: e.target.value })} />
          <Select label="Department" value={profile.departmentId} error={profileErrors.departmentId} onChange={(e) => setProfile({ ...profile, departmentId: e.target.value })}>
            <option value="">Select department</option>
            {departments.map((unit) => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
          </Select>
          <Select label="Designation" value={profile.designationId} error={profileErrors.designationId} onChange={(e) => setProfile({ ...profile, designationId: e.target.value })}>
            <option value="">Select designation</option>
            {designations.map((unit) => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
          </Select>
          <Input label="Basic salary (PKR)" type="number" step="0.01" min="1" value={profile.basicSalary} error={profileErrors.basicSalary} onChange={(e) => setProfile({ ...profile, basicSalary: e.target.value })} />
          <Select label="Status" value={profile.status} onChange={(e) => setProfile({ ...profile, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
          </Select>
          <Select label="Gender" value={profile.gender} error={profileErrors.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          <Input label="Emergency contact" value={profile.emergencyContact} onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })} />
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <Button variant="outline" type="button" onClick={() => setProfileUser(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={linkingProfile}>
              Link Profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
