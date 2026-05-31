export function ReportSkeletonBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 overflow-hidden opacity-60"
    >
      <div className="max-w-3xl mx-auto pt-6 px-6 space-y-4">
        <div className="h-8 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="h-3 w-1/4 bg-slate-200 rounded" />
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-5/6 bg-slate-100 rounded" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="h-3 w-1/3 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="h-3 w-1/4 bg-slate-200 rounded" />
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-3/4 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}
