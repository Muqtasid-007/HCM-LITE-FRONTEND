import { Modal } from '../common/Modal'

export function AuditDiffModal({ log, onClose }) {
  return (
    <Modal open={Boolean(log)} title="Audit before / after" onClose={onClose}>
      {log ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Before</h3>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">
              {JSON.stringify(log.before ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">After</h3>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">
              {JSON.stringify(log.after ?? null, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
