import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeeApi } from '../../api/employeeApi'
import { Modal } from '../../components/common/Modal'
import { Alert, EmptyState } from '../../components/feedback/Skeleton'
import { useToast } from '../../components/feedback/Toast'
import { Button } from '../../components/ui/Button'
import { Card, Badge } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Pagination, Table } from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import { collectionFrom } from '../../utils/params'
import { statusTone, unitName } from '../../utils/format'
import { apiErrorText } from '../../utils/validation'

export function EmployeeDirectoryPage() {
  const { user, units } = useAuth()
  const toast = useToast()
  const isHr = user?.role === 'HR'
  const [query, setQuery] = useState({ page: 1, limit: 10, search: '', departmentId: '', status: '', sort: 'name' })
  const [searchInput, setSearchInput] = useState('')
  const [collection, setCollection] = useState({ items: [], total: 0, page: 1, limit: 10 })
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [dryRun, setDryRun] = useState(null)
  const [importing, setImporting] = useState(false)

  const departments = useMemo(() => units.filter((unit) => unit.kind === 'department'), [units])

  async function load() {
    const data = await employeeApi.list(query)
    setCollection(collectionFrom(data))
  }

  useEffect(() => {
    load().catch((err) => setError(apiErrorText(err)))
  }, [query.page, query.search, query.departmentId, query.status, query.sort, query.limit])

  async function runImport(dry) {
    if (!csv.trim()) {
      return toast.error('Please paste or upload CSV text first')
    }
    setImporting(true)
    try {
      const result = await employeeApi.importCsv({ csv: csv.trim(), dryRun: dry })
      if (dry) {
        setDryRun(result)
        toast.success(result.valid ? 'Dry-run validation successful' : 'Dry-run found validation errors')
      } else {
        toast.success(`Imported ${result.imported} employees. Save temporary passwords now.`)
        setDryRun(result)
        await load()
      }
    } catch (err) {
      setDryRun({ errors: err.errors || [], message: apiErrorText(err) })
      toast.error(apiErrorText(err, 'Import failed'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employee Directory</h1>
          <p className="text-sm text-slate-500">
            Company personnel directory with server-side substring search, unit filtering, and status filters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isHr ? (
            <>
              <Button variant="outline" onClick={() => { setImportOpen(true); setDryRun(null); }}>
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  employeeApi.exportCsv(query).catch((err) => toast.error(apiErrorText(err, 'Export failed')))
                }
              >
                Export CSV
              </Button>
              <Link to="/employees/new">
                <Button>Add Employee</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <form
          className="mb-4 grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery({ ...query, search: searchInput, page: 1 })
          }}
        >
          <Input placeholder="Search name, code, email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Select value={query.departmentId} onChange={(e) => setQuery({ ...query, departmentId: e.target.value, page: 1 })}>
            <option value="">All departments</option>
            {departments.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </Select>
          <Select value={query.status} onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })}>
            <option value="">All statuses</option>
            {['active', 'probation', 'inactive', 'exited'].map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Search</Button>
            {searchInput || query.departmentId || query.status ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setQuery({ page: 1, limit: 10, search: '', departmentId: '', status: '', sort: 'name' })
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </form>

        {collection.items.length === 0 ? (
          <EmptyState
            title="No employees found"
            body="Try adjusting search filters, or ensure departments and designations are configured."
          />
        ) : null}

        <Table
          rows={collection.items}
          columns={[
            {
              key: 'code',
              header: 'Code',
              render: (row) => (
                <Link className="font-semibold text-emerald-700 hover:underline" to={`/employees/${row._id}`}>
                  {row.code}
                </Link>
              ),
            },
            { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
            { key: 'email', header: 'Email' },
            { key: 'departmentId', header: 'Department', render: (row) => unitName(units, row.departmentId) },
            { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <div className="flex gap-2 justify-end">
                  <Link className="text-xs text-slate-600 hover:text-slate-900 font-medium" to={`/employees/${row._id}`}>
                    Profile
                  </Link>
                  {isHr ? (
                    <Link className="text-xs text-emerald-700 hover:text-emerald-900 font-medium ml-2" to={`/employees/${row._id}/edit`}>
                      Edit
                    </Link>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={collection.page} limit={collection.limit} total={collection.total} onPage={(page) => setQuery({ ...query, page })} />
      </Card>

      {/* CSV Import Modal */}
      <Modal open={importOpen} title="Import Employees via CSV" onClose={() => setImportOpen(false)}>
        <p className="mb-2 text-sm text-slate-600">
          Required headers: <span className="font-mono text-xs font-semibold text-slate-800">code,email,name,departmentId,designationId,joiningDate,basicSalary,gender</span>.
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Always run dry-run validation first. Atomically imports 1–500 rows; any single error rejects the batch entirely.
        </p>

        <Textarea
          className="font-mono text-xs"
          rows={5}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`code,email,name,departmentId,designationId,joiningDate,basicSalary,gender\nENG001,alice@example.com,Alice,0123456789abcdef01234567,0123456789abcdef01234568,2026-10-01,80000,female`}
        />

        <div className="mt-3 flex items-center justify-between">
          <input
            className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              file.text().then(setCsv)
            }}
          />
          <div className="flex gap-2">
            <Button variant="outline" loading={importing} onClick={() => runImport(true)}>
              Validate (Dry-run)
            </Button>
            <Button
              loading={importing}
              disabled={!dryRun || !dryRun.valid || (dryRun.errors || []).length > 0}
              onClick={() => runImport(false)}
            >
              Confirm Import
            </Button>
          </div>
        </div>

        {dryRun ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">
                Processed rows: {dryRun.rowCount ?? dryRun.imported ?? '—'}
              </span>
              <Badge tone={dryRun.valid || dryRun.imported != null ? 'emerald' : 'rose'}>
                {dryRun.valid || dryRun.imported != null ? 'Valid' : 'Errors found'}
              </Badge>
            </div>

            {(dryRun.errors || []).length ? (
              <div className="max-h-48 overflow-y-auto">
                <Table
                  rows={dryRun.errors}
                  rowKey="row"
                  columns={[
                    { key: 'row', header: 'CSV Row', render: (row) => `Row ${row.row}` },
                    { key: 'field', header: 'Field' },
                    { key: 'reason', header: 'Reason' },
                  ]}
                />
              </div>
            ) : dryRun.dryRun ? (
              <Alert tone="emerald">CSV validation passed without any row errors. You can proceed with import.</Alert>
            ) : null}

            {dryRun.items ? (
              <div className="space-y-3 pt-2">
                <Alert tone="amber">
                  Employees imported! Temporary passwords were generated once. Copy and store them securely before closing this dialog.
                </Alert>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const text = dryRun.items
                        .map((it) => `${it.employee?.code} | ${it.employee?.name} | ${it.user?.email || it.employee?.email} | Password: ${it.temporaryPassword}`)
                        .join('\n')
                      navigator.clipboard?.writeText(text)
                      toast.success('All credentials copied to clipboard')
                    }}
                  >
                    Copy All Credentials
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <Table
                    rows={dryRun.items}
                    rowKey={(row) => row.employee?._id || row.employee?.code}
                    columns={[
                      { key: 'code', header: 'Code', render: (row) => row.employee?.code },
                      { key: 'name', header: 'Name', render: (row) => row.employee?.name },
                      { key: 'email', header: 'Email', render: (row) => row.user?.email || row.employee?.email },
                      {
                        key: 'password',
                        header: 'Temporary Password',
                        render: (row) => (
                          <span className="font-mono font-bold text-emerald-800 select-all bg-emerald-50 px-2 py-0.5 rounded">
                            {row.temporaryPassword}
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
