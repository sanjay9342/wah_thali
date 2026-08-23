export default function Loading() {
  return (
    <main className="min-h-screen bg-white px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-7" aria-live="polite" aria-busy="true">
      <div className="mx-auto max-w-[1248px]">
        <div className="flex items-center justify-between gap-4">
          <div className="h-11 w-32 rounded-2xl bg-[#fff4f5] wt-skeleton" />
          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-full bg-white shadow-sm ring-1 ring-border wt-skeleton" />
            <div className="h-10 w-10 rounded-full bg-white shadow-sm ring-1 ring-border wt-skeleton" />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="h-4 w-20 rounded-full bg-red/15 wt-skeleton" />
            <div className="mt-4 h-9 w-4/5 rounded-xl bg-[#fff4f5] wt-skeleton" />
            <div className="mt-3 h-9 w-3/5 rounded-xl bg-[#fff4f5] wt-skeleton" />
            <div className="mt-5 flex gap-2">
              <div className="h-10 w-28 rounded-xl bg-red/15 wt-skeleton" />
              <div className="h-10 w-24 rounded-xl bg-white shadow-sm ring-1 ring-border wt-skeleton" />
            </div>
          </div>
          <div className="h-48 rounded-2xl bg-red/10 wt-skeleton lg:h-auto" />
        </div>

        <div className="mt-5 flex gap-3 overflow-hidden pb-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 min-w-20 rounded-xl bg-white shadow-sm ring-1 ring-border wt-skeleton sm:min-w-28" />
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
              <div className="h-24 rounded-xl bg-[#fff4f5] wt-skeleton" />
              <div className="mt-3 h-4 w-4/5 rounded-full bg-red/10 wt-skeleton" />
              <div className="mt-2 h-4 w-3/5 rounded-full bg-red/10 wt-skeleton" />
              <div className="mt-4 h-9 rounded-xl bg-red/15 wt-skeleton" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
