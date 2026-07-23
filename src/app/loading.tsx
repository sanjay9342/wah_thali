export default function Loading() {
  return (
    <main className="min-h-screen bg-cream px-4 py-5">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-border">
          <div className="h-4 w-24 rounded-full bg-maroon/15" />
          <div className="mt-3 h-12 rounded-2xl bg-maroon/10" />
        </div>
        <div className="mt-4 h-44 rounded-[28px] bg-maroon/15" />
        <div className="mt-5 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 min-w-20 rounded-2xl bg-white shadow-sm ring-1 ring-border" />
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 rounded-3xl bg-white shadow-sm ring-1 ring-border" />
          ))}
        </div>
      </div>
    </main>
  );
}
