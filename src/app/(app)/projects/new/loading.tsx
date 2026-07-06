export default function NewProjectLoading() {
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
        <div className="h-7 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <div className="h-11 rounded-md bg-slate-100" />
            <div className="h-24 rounded-md bg-slate-100" />
            <div className="h-40 rounded-md border border-dashed border-slate-200 bg-[var(--panel)]" />
            <div className="h-11 rounded-md bg-slate-200" />
          </div>
          <div className="min-h-[420px] rounded-md border border-[var(--line)] bg-[var(--panel)]" />
        </div>
      </section>
    </div>
  );
}
