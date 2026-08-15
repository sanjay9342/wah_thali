"use client";

import { useMemo, useState, useTransition, type SyntheticEvent } from "react";
import { CheckCircle2, Download, Edit3, EyeOff, PackagePlus, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import type { AdminProduct } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";

type ProductForm = {
  id?: string;
  name: string;
  category: string;
  description: string;
  image: string;
  dietaryType: AdminProduct["dietaryType"];
  spiceLevel: AdminProduct["spiceLevel"];
  price: string;
  originalPrice: string;
  prepTimeMinutes: string;
  stock: string;
  reorderAt: string;
  margin: string;
  offer: string;
  bestseller: boolean;
  available: boolean;
  variants: { id?: string; name: string; price: string }[];
  addons: { id?: string; name: string; price: string }[];
};

const emptyForm: ProductForm = {
  name: "",
  category: "",
  description: "",
  image: "",
  dietaryType: "VEG",
  spiceLevel: "Medium",
  price: "",
  originalPrice: "",
  prepTimeMinutes: "25",
  stock: "0",
  reorderAt: "0",
  margin: "0",
  offer: "",
  bestseller: false,
  available: true,
  variants: [{ name: "Regular", price: "0" }],
  addons: [],
};

export function AdminInventoryClient({
  initialCategories,
  initialProducts,
  initialEditId,
}: {
  initialCategories: string[];
  initialProducts: AdminProduct[];
  initialEditId?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All products");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [form, setForm] = useState<ProductForm | null>(() => {
    const product = initialProducts.find((item) => item.id === initialEditId);
    return product ? toProductForm(product) : null;
  });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(
    () => Array.from(new Set([...initialCategories, ...products.map((product) => product.category)])).sort(),
    [initialCategories, products],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === "All categories" || product.category === categoryFilter;
      const matchesFilter =
        filter === "All products" ||
        (filter === "Available" && product.available) ||
        (filter === "Unavailable" && !product.available) ||
        (filter === "Low stock" && product.stock <= product.reorderAt) ||
        (filter === "Bestsellers" && product.bestseller) ||
        (filter === "Discounted" && Boolean(product.offer || product.originalPrice));

      return matchesQuery && matchesCategory && matchesFilter;
    });
  }, [categoryFilter, filter, products, query]);

  const stats = {
    total: products.length,
    available: products.filter((product) => product.available).length,
    lowStock: products.filter((product) => product.stock <= product.reorderAt).length,
    categories: categories.length,
  };

  async function refreshProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not reload products.");
    setProducts(data.products);
    setLastSyncedAt(new Date());
  }

  function runMutation(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function openEdit(product: AdminProduct) {
    setForm(toProductForm(product));
  }

  function handleRefresh() {
    runMutation(async () => {
      await refreshProducts();
      setMessage("Inventory refreshed from live database.");
    });
  }

  function saveProduct() {
    if (!form) return;

    runMutation(async () => {
      const payload = {
        name: form.name,
        category: form.category,
        description: form.description,
        image: form.image || undefined,
        dietaryType: form.dietaryType,
        spiceLevel: form.spiceLevel,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        prepTimeMinutes: Number(form.prepTimeMinutes),
        stock: Number(form.stock),
        reorderAt: Number(form.reorderAt),
        margin: Number(form.margin),
        offer: form.offer || null,
        bestseller: form.bestseller,
        available: form.available,
        variants: form.variants
          .filter((variant) => variant.name.trim())
          .map((variant) => ({ id: variant.id, name: variant.name.trim(), price: Number(variant.price || 0), available: true })),
        addons: form.addons
          .filter((addon) => addon.name.trim())
          .map((addon) => ({ id: addon.id, name: addon.name.trim(), price: Number(addon.price || 0), available: true })),
      };

      const response = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Product save failed.");

      await refreshProducts();
      setForm(null);
      setMessage(form.id ? "Product updated live." : "Product added live.");
    });
  }

  function quickUpdate(product: AdminProduct, patch: Partial<AdminProduct>) {
    runMutation(async () => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update failed.");
      await refreshProducts();
      setMessage("Inventory updated live.");
    });
  }

  function deleteProduct(product: AdminProduct) {
    const confirmed = window.confirm(`Delete ${product.name}? Products used in past orders will be archived to protect order history.`);
    if (!confirmed) return;

    runMutation(async () => {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      await refreshProducts();
      setMessage(data.archived ? "Product is archived because it has order history." : "Product deleted.");
    });
  }

  function exportCsv() {
    const rows = [
      ["Name", "Category", "Price", "Stock", "Reorder", "Margin", "Available"],
      ...filteredProducts.map((product) => [
        product.name,
        product.category,
        String(product.price),
        String(product.stock),
        String(product.reorderAt),
        `${product.margin}%`,
        product.available ? "Available" : "Unavailable",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wah-thali-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadImage(file: File, folder = "products") {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const response = await fetch("/api/storage/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Image upload failed.");
      return data.publicUrl as string;
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Inventory</p>
            <h1 className="text-3xl font-black text-maroon">Products and stock</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Live Supabase menu controls for product CRUD, visibility, pricing, and stock.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setForm(emptyForm)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> Add product
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total SKUs", String(stats.total), "Across live menu"],
            ["Available", String(stats.available), "Visible to customers"],
            ["Low stock", String(stats.lowStock), "Needs prep or purchase"],
            ["Categories", String(stats.categories), "Customer filters"],
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search product" />
            </label>
            <div className="mt-4 grid gap-2">
              {["All products", "Available", "Unavailable", "Low stock", "Bestsellers", "Discounted"].map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-left text-sm font-black ${filter === item ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
                  {item}
                </button>
              ))}
            </div>
            <h3 className="mt-5 text-sm font-black text-maroon">Categories</h3>
            <div className="mt-2 grid gap-2">
              {["All categories", ...categories].slice(0, 10).map((category) => (
                <button key={category} onClick={() => setCategoryFilter(category)} className={`rounded-lg border border-border px-3 py-2 text-left text-xs font-black ${categoryFilter === category ? "bg-maroon text-white" : "text-charcoal"}`}>
                  {category}
                </button>
              ))}
            </div>
          </aside>

          <div className="surface min-w-0 overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-maroon">Menu inventory</h2>
                <p className="text-sm font-semibold text-muted">
                  {filteredProducts.length} products shown. Changes save to the live database.
                  {lastSyncedAt ? ` Last synced ${lastSyncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={isPending} onClick={handleRefresh} className="inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-black disabled:opacity-60">
                  <PackagePlus size={17} className={isPending ? "animate-spin" : ""} /> {isPending ? "Refreshing..." : "Refresh"}
                </button>
                <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white">
                  <Download size={17} /> Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Item", "Price", "Stock", "Reorder", "Margin", "Variants", "Add-ons", "Availability", "Actions"].map((head) => (
                      <th key={head} className="p-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-border align-top">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={safeAdminImage(product.image)} alt="" className="h-14 w-14 rounded-xl object-cover" onError={useFallbackImage} />
                          <div>
                            <p className="font-black text-charcoal">{product.name}</p>
                            <p className="text-xs font-bold text-muted">{product.category} - {product.dietaryType} - {product.spiceLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-black">{formatRupees(product.price)}</td>
                      <td className="p-3">
                        <input type="number" min={0} className="h-10 w-[72px] rounded-lg border border-border bg-cream px-3 font-black" defaultValue={product.stock} onBlur={(event) => quickUpdate(product, { stock: Number(event.target.value) })} />
                      </td>
                      <td className="p-3">
                        <input type="number" min={0} className="h-10 w-[72px] rounded-lg border border-border bg-cream px-3 font-black" defaultValue={product.reorderAt} onBlur={(event) => quickUpdate(product, { reorderAt: Number(event.target.value) })} />
                      </td>
                      <td className="p-3 font-black text-maroon">{product.margin}%</td>
                      <td className="p-3">{product.variants.length}</td>
                      <td className="p-3">{product.addons.length}</td>
                      <td className="p-3">
                        <button onClick={() => quickUpdate(product, { available: !product.available })} disabled={isPending} className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${product.available ? "bg-maroon text-white" : "bg-red/10 text-red"}`}>
                          {product.available ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                          {product.available ? "Available" : "Unavailable"}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(product)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Edit ${product.name}`}>
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => deleteProduct(product)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Delete ${product.name}`}>
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

      {form ? <ProductModal form={form} setForm={setForm} saveProduct={saveProduct} isPending={isPending || uploading} categories={categories} uploadImage={uploadImage} /> : null}
    </main>
  );
}

function safeAdminImage(src: string) {
  return src || "/wah-thali-meal-cutout-v2.png";
}

function useFallbackImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
}

function toProductForm(product: AdminProduct): ProductForm {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    image: product.image,
    dietaryType: product.dietaryType,
    spiceLevel: product.spiceLevel,
    price: String(product.price),
    originalPrice: product.originalPrice ? String(product.originalPrice) : "",
    prepTimeMinutes: String(product.prepTimeMinutes),
    stock: String(product.stock),
    reorderAt: String(product.reorderAt),
    margin: String(product.margin),
    offer: product.offer ?? "",
    bestseller: Boolean(product.bestseller),
    available: product.available,
    variants: product.variants.length
      ? product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: String(variant.price),
        }))
      : [{ name: "Regular", price: "0" }],
    addons: product.addons.map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: String(addon.price),
    })),
  };
}

function ProductModal({
  form,
  setForm,
  saveProduct,
  isPending,
  categories,
  uploadImage,
}: {
  form: ProductForm;
  setForm: (form: ProductForm | null) => void;
  saveProduct: () => void;
  isPending: boolean;
  categories: string[];
  uploadImage: (file: File) => Promise<string>;
}) {
  function update(patch: Partial<ProductForm>) {
    setForm({ ...form, ...patch });
  }

  function updateAddon(index: number, patch: Partial<ProductForm["addons"][number]>) {
    update({
      addons: form.addons.map((addon, addonIndex) => (addonIndex === index ? { ...addon, ...patch } : addon)),
    });
  }

  function updateVariant(index: number, patch: Partial<ProductForm["variants"][number]>) {
    update({
      variants: form.variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-xl font-black text-maroon">{form.id ? "Edit product" : "Add product"}</h2>
          <button onClick={() => setForm(null)} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:items-start">
          <Field label="Name" value={form.name} onChange={(value) => update({ name: value })} />
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Category
            <select value={form.category} onChange={(event) => update({ category: event.target.value })} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal">
              <option value="" disabled>Select category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <ImageField label="Product image" value={form.image} onChange={(value) => update({ image: value })} uploadImage={uploadImage} />
          <Field label="Price" type="number" value={form.price} onChange={(value) => update({ price: value })} />
          <Field label="Original price" type="number" value={form.originalPrice} onChange={(value) => update({ originalPrice: value })} />
          <Field label="Prep minutes" type="number" value={form.prepTimeMinutes} onChange={(value) => update({ prepTimeMinutes: value })} />
          <Field label="Stock" type="number" value={form.stock} onChange={(value) => update({ stock: value })} />
          <Field label="Reorder" type="number" value={form.reorderAt} onChange={(value) => update({ reorderAt: value })} />
          <Field label="Margin %" type="number" value={form.margin} onChange={(value) => update({ margin: value })} />
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Dietary
            <select value={form.dietaryType} onChange={(event) => update({ dietaryType: event.target.value as ProductForm["dietaryType"] })} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal">
              <option value="VEG">VEG</option>
              <option value="NON_VEG">NON VEG</option>
              <option value="JAIN">JAIN</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Spice
            <select value={form.spiceLevel} onChange={(event) => update({ spiceLevel: event.target.value as ProductForm["spiceLevel"] })} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal">
              <option value="Mild">Mild</option>
              <option value="Medium">Medium</option>
              <option value="Hot">Hot</option>
            </select>
          </label>
          <Field label="Dish offer (overrides category offer)" value={form.offer} onChange={(value) => update({ offer: value })} />
          <div className="grid gap-3 rounded-xl border border-border bg-cream p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-maroon">Variations</p>
                <p className="text-xs font-bold text-muted">Shown as size/options after customers click a dish. Price is added to base price.</p>
              </div>
              <button
                type="button"
                onClick={() => update({ variants: [...form.variants, { name: "", price: "0" }] })}
                className="h-9 rounded-lg bg-maroon px-3 text-xs font-black text-white"
              >
                Add variation
              </button>
            </div>
            <div className="grid gap-2">
              {form.variants.map((variant, index) => (
                <div key={variant.id ?? index} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <input
                    value={variant.name}
                    onChange={(event) => updateVariant(index, { name: event.target.value })}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                    placeholder="Variation name, e.g. Regular"
                  />
                  <input
                    type="number"
                    min={0}
                    value={variant.price}
                    onChange={(event) => updateVariant(index, { price: event.target.value })}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                    placeholder="Extra price"
                  />
                  <button
                    type="button"
                    onClick={() => update({ variants: form.variants.filter((_, variantIndex) => variantIndex !== index) })}
                    disabled={form.variants.length === 1}
                    className="h-10 rounded-lg border border-border px-3 text-xs font-black text-red disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-cream p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-maroon">Add-ons</p>
                <p className="text-xs font-bold text-muted">Shown to customers when this dish is opened.</p>
              </div>
              <button
                type="button"
                onClick={() => update({ addons: [...form.addons, { name: "", price: "0" }] })}
                className="h-9 rounded-lg bg-maroon px-3 text-xs font-black text-white"
              >
                Add add-on
              </button>
            </div>
            {form.addons.length ? (
              <div className="grid gap-2">
                {form.addons.map((addon, index) => (
                  <div key={addon.id ?? index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      value={addon.name}
                      onChange={(event) => updateAddon(index, { name: event.target.value })}
                      className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                      placeholder="Add-on name, e.g. Extra paneer"
                    />
                    <input
                      type="number"
                      min={0}
                      value={addon.price}
                      onChange={(event) => updateAddon(index, { price: event.target.value })}
                      className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                      placeholder="Price"
                    />
                    <button
                      type="button"
                      onClick={() => update({ addons: form.addons.filter((_, addonIndex) => addonIndex !== index) })}
                      className="h-10 rounded-lg border border-border px-3 text-xs font-black text-red"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-muted">No add-ons yet.</p>
            )}
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-border bg-cream px-3 py-3 text-sm font-black text-charcoal">
            <input type="checkbox" checked={form.available} onChange={(event) => update({ available: event.target.checked })} />
            Available on live menu
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border bg-cream px-3 py-3 text-sm font-black text-charcoal">
            <input type="checkbox" checked={form.bestseller} onChange={(event) => update({ bestseller: event.target.checked })} />
            Bestseller
          </label>
          <label className="grid gap-2 text-sm font-black text-maroon sm:col-span-2">
            Description
            <textarea value={form.description} onChange={(event) => update({ description: event.target.value })} className="min-h-28 rounded-lg border border-border bg-cream px-3 py-2 text-charcoal" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <button onClick={() => setForm(null)} className="h-11 rounded-lg border border-border px-4 font-black">Cancel</button>
          <button onClick={saveProduct} disabled={isPending || !form.category} className="h-11 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
            {isPending ? "Saving..." : "Save product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
  uploadImage,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    }
  }

  return (
      <div className="grid min-w-0 gap-2 text-sm font-black text-maroon">
      <span>{label}</span>
      <div className="grid min-w-0 gap-2 overflow-hidden rounded-lg border border-border bg-cream p-3">
        {value ? (
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={safeAdminImage(value)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 truncate text-xs font-bold text-muted">{value}</span>
          </div>
        ) : null}
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-charcoal" placeholder="Paste image URL" />
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-maroon px-3 text-sm font-black text-white">
          Upload using your device
          <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
        {error ? <p className="text-xs font-bold text-red">{error}</p> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
      {label}
      <input type={type} list={list} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal" />
    </label>
  );
}
