import { CheckCircle2, Edit3, EyeOff, PackagePlus, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { categories, products } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const inventoryRows = products.map((product, index) => ({
  ...product,
  stock: [42, 18, 27, 11, 34, 8][index] ?? 16,
  reorder: [20, 12, 14, 10, 16, 6][index] ?? 8,
  margin: [62, 54, 58, 49, 57, 41][index] ?? 45,
}));

export default function AdminInventoryPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Inventory</p>
            <h1 className="text-3xl font-black text-maroon">Products and stock</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Manage menu availability, pricing, add-ons, variants, categories, and stock alerts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> Add product
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total SKUs", String(products.length), "Across live menu"],
            ["Available", String(products.filter((product) => product.available).length), "Visible to customers"],
            ["Low stock", String(inventoryRows.filter((product) => product.stock <= product.reorder).length), "Needs prep or purchase"],
            ["Categories", String(categories.length), "Customer filters"],
          ].map(([label, value, detail]) => (
            <div key={label} className="surface rounded-2xl p-5">
              <p className="text-sm font-bold text-muted">{label}</p>
              <p className="mt-2 text-3xl font-black text-maroon">{value}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-maroon">
              <SlidersHorizontal size={19} className="text-red" /> Filters
            </h2>
            <label className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-border bg-cream px-3">
              <Search size={17} className="text-muted" />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search product" />
            </label>
            <div className="mt-4 grid gap-2">
              {["All products", "Available", "Hidden", "Low stock", "Bestsellers", "Discounted"].map((filter, index) => (
                <button key={filter} className={`rounded-lg px-3 py-2 text-left text-sm font-black ${index === 0 ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
                  {filter}
                </button>
              ))}
            </div>
            <h3 className="mt-5 text-sm font-black text-maroon">Categories</h3>
            <div className="mt-2 grid gap-2">
              {categories.slice(0, 7).map((category) => (
                <button key={category} className="rounded-lg border border-border px-3 py-2 text-left text-xs font-black text-charcoal">
                  {category}
                </button>
              ))}
            </div>
          </aside>

          <div className="surface overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-maroon">Menu inventory</h2>
                <p className="text-sm font-semibold text-muted">Controls are ready for API wiring.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                  <PackagePlus size={17} /> Bulk update
                </button>
                <button className="inline-flex h-10 items-center rounded-lg bg-maroon px-3 text-sm font-black text-white">Export CSV</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Item", "Price", "Stock", "Reorder", "Margin", "Variants", "Add-ons", "Availability", "Actions"].map((head) => (
                      <th key={head} className="p-4">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map((product) => (
                    <tr key={product.id} className="border-t border-border align-top">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={product.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                          <div>
                            <p className="font-black text-charcoal">{product.name}</p>
                            <p className="text-xs font-bold text-muted">{product.category} · {product.dietaryType} · {product.spiceLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-black">{formatRupees(product.price)}</td>
                      <td className="p-4">
                        <input className="h-10 w-20 rounded-lg border border-border bg-cream px-3 font-black" defaultValue={product.stock} />
                      </td>
                      <td className="p-4">
                        <input className="h-10 w-20 rounded-lg border border-border bg-cream px-3 font-black" defaultValue={product.reorder} />
                      </td>
                      <td className="p-4 font-black text-maroon">{product.margin}%</td>
                      <td className="p-4">{product.variants.length}</td>
                      <td className="p-4">{product.addons.length}</td>
                      <td className="p-4">
                        <button className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black ${product.available ? "bg-cream text-success" : "bg-red/10 text-red"}`}>
                          {product.available ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                          {product.available ? "Visible" : "Hidden"}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Edit ${product.name}`}>
                            <Edit3 size={16} />
                          </button>
                          <button className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Delete ${product.name}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
