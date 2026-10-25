export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
          <p className="text-sm font-semibold tracking-[0.2em] text-emerald-400">HCM LITE</p>
          <div>
            <h1 className="text-4xl font-semibold">People operations, kept simple.</h1>
            <p className="mt-4 max-w-md text-slate-300">
              Attendance, leave, payroll, and policy answers for Admin, HR, and employees — scoped to the live API
              contract.
            </p>
          </div>
          <p className="text-sm text-slate-400">JWT sessions · role-scoped data · server timestamps</p>
        </aside>
        <main className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
