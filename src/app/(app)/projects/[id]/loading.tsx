export default function ProjectEditorLoading() {
  return (
    <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[320px_minmax(0,1fr)_360px] lg:p-5">
      <aside className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="h-20 rounded-md bg-slate-100" />
        <div className="h-72 rounded-md bg-[var(--panel)]" />
      </aside>
      <section className="min-w-0 space-y-4">
        <div className="rounded-md border border-[var(--line)] bg-white p-3 shadow-sm">
          <div className="h-10 rounded-md bg-slate-100" />
        </div>
        <div className="rounded-md border border-[var(--line)] bg-white p-3 shadow-sm">
          <div className="h-12 rounded-md bg-slate-100" />
          <div className="mt-3 min-h-[520px] rounded-md bg-[var(--panel)]" />
        </div>
      </section>
      <aside className="hidden space-y-4 rounded-md border border-[var(--line)] bg-white p-4 shadow-sm lg:block">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-16 rounded-md bg-slate-100" />
          ))}
        </div>
      </aside>
    </div>
  );
}
