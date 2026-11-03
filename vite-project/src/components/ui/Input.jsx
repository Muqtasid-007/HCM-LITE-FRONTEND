const base =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-500 focus:ring-2'

export function Input({ label, error, id, className = '', ...props }) {
  const inputId = id || props.name
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <input id={inputId} aria-invalid={Boolean(error)} className={`${base} ${error ? 'border-rose-400' : ''} ${className}`} {...props} />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}

export function Textarea({ label, error, id, className = '', ...props }) {
  const inputId = id || props.name
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        className={`${base} min-h-24 ${error ? 'border-rose-400' : ''} ${className}`}
        {...props}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}

export function Select({ label, error, id, children, className = '', ...props }) {
  const inputId = id || props.name
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <select id={inputId} aria-invalid={Boolean(error)} className={`${base} ${error ? 'border-rose-400' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
