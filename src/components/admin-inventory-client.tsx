"use client";

import { useEffect, useMemo, useState, useTransition, type SyntheticEvent } from "react";
import { CheckCircle2, Download, Edit3, EyeOff, PackagePlus, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch } from "@/lib/admin-client-auth";
import type { AdminProduct } from "@/lib/types";
import { formatRupees, getProductUnitPricing } from "@/lib/pricing";
import { formatIstTime } from "@/lib/time";

type ProductForm = {
  id?: string;
  name: string;
  kitchenName: string;
  reportCode: string;
  category: string;
  description: string;
  image: string;
  dietaryType: AdminProduct["dietaryType"];
  spiceLevel: AdminProduct["spiceLevel"];
  price: string;
  originalPrice: string;
  offer: OfferDraft;
  bestseller: boolean;
  available: boolean;
  variants: { id?: string; name: string; price: string }[];
  addons: { id?: string; name: string; price: string }[];
};

type OfferDraft = {
  type: "NONE" | "PERCENT" | "FIXED";
  percent: string;
  cap: string;
  amount: string;
};

type MessageTone = "success" | "error";

const emptyOfferDraft: OfferDraft = {
  type: "NONE",
  percent: "",
  cap: "",
  amount: "",
};

const emptyForm: ProductForm = {
  name: "",
  kitchenName: "",
  reportCode: "",
  category: "",
  description: "",
  image: "",
  dietaryType: "VEG",
  spiceLevel: "Medium",
  price: "",
  originalPrice: "",
  offer: emptyOfferDraft,
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
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [uploading, setUploading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [savingProductIds, setSavingProductIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), messageTone === "success" ? 4200 : 7000);
    return () => window.clearTimeout(timer);
  }, [message, messageTone]);

  const categories = useMemo(
    () => Array.from(new Set([...initialCategories, ...products.map((product) => product.category)])).sort(),
    [initialCategories, products],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.name} ${product.displayName ?? ""} ${product.kitchenName ?? ""} ${product.reportCode ?? ""} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === "All categories" || product.category === categoryFilter;
      const matchesFilter =
        filter === "All products" ||
        (filter === "Available" && product.available) ||
        (filter === "Unavailable" && !product.available) ||
        (filter === "Best Sellers" && product.bestseller) ||
        (filter === "Discounted" && Boolean(product.offer || product.originalPrice));

      return matchesQuery && matchesCategory && matchesFilter;
    }).sort(compareProductsForMenuState);
  }, [categoryFilter, filter, products, query]);

  const stats = {
    total: products.length,
    available: products.filter((product) => product.available).length,
    offline: products.filter((product) => !product.available).length,
    discounted: products.filter((product) => product.offer || product.originalPrice).length,
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
        showError(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function showSuccess(text: string) {
    setMessageTone("success");
    setMessage(text);
  }

  function showError(text: string) {
    setMessageTone("error");
    setMessage(text);
  }

  function openEdit(product: AdminProduct) {
    setForm(toProductForm(product));
  }

  function handleRefresh() {
    runMutation(async () => {
      await refreshProducts();
      showSuccess("Inventory refreshed successfully.");
    });
  }

  function saveProduct() {
    if (!form) return;

    runMutation(async () => {
      const price = Number(form.price);
      const originalPrice = form.originalPrice ? Number(form.originalPrice) : null;
      if (originalPrice !== null && originalPrice <= price) {
        throw new Error("Real price / strike price must be higher than discount price, e.g. real 150 and discount 100.");
      }

      const payload = {
        name: form.name,
        displayName: form.name,
        kitchenName: form.kitchenName || null,
        reportCode: form.reportCode ? form.reportCode.toUpperCase() : null,
        category: form.category,
        description: form.description,
        image: form.image || undefined,
        dietaryType: form.dietaryType,
        spiceLevel: form.spiceLevel,
        price,
        originalPrice,
        offer: offerDraftToText(form.offer) || null,
        bestseller: form.bestseller,
        available: form.available,
        variants: form.variants
          .filter((variant) => variant.name.trim())
          .map((variant) => ({ id: variant.id, name: variant.name.trim(), price: Number(variant.price || 0), available: true })),
        addons: form.addons
          .filter((addon) => addon.name.trim())
          .map((addon) => ({ id: addon.id, name: addon.name.trim(), price: Number(addon.price || 0), available: true })),
      };

      const response = await adminFetch(adminAccess?.session, form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Product save failed.");

      await refreshProducts();
      setForm(null);
      showSuccess(form.id ? "Dish updated successfully." : "Dish added successfully.");
    });
  }

  async function quickUpdate(product: AdminProduct, patch: Partial<AdminProduct>) {
    if (savingProductIds.has(product.id)) return;

    const previousProduct = product;
    setMessage("");
    setSavingProductIds((current) => new Set(current).add(product.id));
    setProducts((current) =>
      current.map((item) => item.id === product.id ? { ...item, ...patch } : item).sort(compareProductsForMenuState),
    );

    try {
      const response = await adminFetch(adminAccess?.session, `/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update failed.");
      if (data.product?.available !== undefined) {
        setProducts((current) =>
          current.map((item) => item.id === product.id ? { ...item, available: data.product.available } : item).sort(compareProductsForMenuState),
        );
      }
      setLastSyncedAt(new Date());
      showSuccess(`${product.name} is now ${patch.available ? "online" : "offline"}.`);
    } catch (error) {
      setProducts((current) =>
        current.map((item) => item.id === product.id ? previousProduct : item).sort(compareProductsForMenuState),
      );
      showError(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSavingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  }

  function deleteProduct(product: AdminProduct) {
    const confirmed = window.confirm(`Delete ${product.name}? Dishes used in past orders will be hidden to protect order history.`);
    if (!confirmed) return;

    runMutation(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/products/${product.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      await refreshProducts();
      showSuccess(data.archived ? "Dish archived because it has order history." : "Dish deleted successfully.");
    });
  }

  function exportCsv() {
    const rows = [
      ["Display Name", "Internal Name", "Shortcut Code", "Category", "Discount Price", "Real/Strike Price", "Available"],
      ...filteredProducts.map((product) => [
        product.name,
        product.kitchenName ?? "",
        product.reportCode ?? "",
        product.category,
        String(product.price),
        product.originalPrice ? String(product.originalPrice) : "",
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
      const response = await adminFetch(adminAccess?.session, "/api/storage/upload", { method: "POST", body });
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
            <h1 className="text-3xl font-black text-maroon">Products</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Live Supabase menu controls for product CRUD, visibility, and pricing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setForm(emptyForm)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> Add product
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {message ? <StatusMessage message={message} tone={messageTone} /> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total SKUs", String(stats.total), "Across live menu"],
            ["Online", String(stats.available), "Can be ordered"],
            ["Offline", String(stats.offline), "Shown last in black and white"],
            ["Discounted", String(stats.discounted), "Dish offers or strike price"],
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search name or code" />
            </label>
            <div className="mt-4 grid gap-2">
              {["All products", "Available", "Unavailable", "Best Sellers", "Discounted"].map((item) => (
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
                <h2 className="text-xl font-black text-maroon">Menu products</h2>
                <p className="text-sm font-semibold text-muted">
                  {filteredProducts.length} products shown. Changes save to the live database.
                  {lastSyncedAt ? ` Last synced ${formatIstTime(lastSyncedAt)}.` : ""}
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
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Item", "Shortcut", "Price", "Offer", "Variants", "Add-ons", "Availability", "Actions"].map((head) => (
                      <th key={head} className="p-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const pricing = getProductUnitPricing(product);
                    const offerLabel = product.offer || (pricing.discountPerUnit > 0 ? "Strike price" : "Category/default");
                    const saving = savingProductIds.has(product.id);

                    return (
                      <tr key={product.id} className={`border-t border-border align-top ${product.available ? "" : "bg-[#f7f7f7] grayscale"}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={safeAdminImage(product.image)} alt="" className="h-14 w-14 rounded-xl object-cover" onError={useFallbackImage} />
                            <div>
                              <p className="font-black text-charcoal">{product.name}</p>
                              <p className="text-xs font-bold text-muted">{product.category} - {product.dietaryType} - {product.spiceLevel}</p>
                              {product.kitchenName ? <p className="mt-1 text-xs font-black text-maroon">Kitchen: {product.kitchenName}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex h-7 items-center rounded-lg border border-border bg-cream px-2 text-xs font-black text-maroon">
                            {product.reportCode || "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          {pricing.discountPerUnit > 0 ? <span className="block text-xs font-bold text-muted line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
                          <span className="font-black">{formatRupees(pricing.unitPrice)}</span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex min-h-8 max-w-[170px] items-center rounded-full bg-cream px-3 py-1 text-xs font-black text-muted">
                            <span className="truncate">{offerLabel}</span>
                          </span>
                        </td>
                        <td className="p-3">{product.variants.length}</td>
                        <td className="p-3">{product.addons.length}</td>
                        <td className="p-3">
                          <button onClick={() => quickUpdate(product, { available: !product.available })} disabled={saving} aria-busy={saving} className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${product.available ? "bg-maroon text-white" : "border border-border bg-white text-charcoal"}`}>
                            {product.available ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                            {product.available ? "Online" : "Offline"}
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
                    );
                  })}
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

function StatusMessage({ message, tone }: { message: string; tone: MessageTone }) {
  const success = tone === "success";
  return (
    <p
      className={`fixed right-4 top-4 z-[80] max-w-[min(420px,calc(100vw-32px))] rounded-lg border px-4 py-3 text-sm font-black shadow-[0_18px_42px_rgba(34,31,32,0.16)] ${
        success
          ? "border-[#bfe7cf] bg-[#effaf4] text-[#0f7a45]"
          : "border-[#ffd1d6] bg-[#fff4f5] text-red"
      }`}
      role="status"
      aria-live="polite"
    >
      {success ? "Success: " : "Error: "}
      {message}
    </p>
  );
}

function compareProductsForMenuState(a: AdminProduct, b: AdminProduct) {
  return Number(b.available) - Number(a.available) || a.name.localeCompare(b.name);
}

function toProductForm(product: AdminProduct): ProductForm {
  return {
    id: product.id,
    name: product.name,
    kitchenName: product.kitchenName ?? "",
    reportCode: product.reportCode ?? "",
    category: product.category,
    description: product.description,
    image: product.image,
    dietaryType: product.dietaryType,
    spiceLevel: product.spiceLevel,
    price: String(product.price),
    originalPrice: product.originalPrice ? String(product.originalPrice) : "",
    offer: parseOfferText(product.offer),
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
          <Field label="Display name" value={form.name} onChange={(value) => update({ name: value })} />
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Category
            <select value={form.category} onChange={(event) => update({ category: event.target.value })} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal">
              <option value="" disabled>Select category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <Field label="Internal dish name" value={form.kitchenName} onChange={(value) => update({ kitchenName: value })} />
          <Field label="Report shortcut code" value={form.reportCode} onChange={(value) => update({ reportCode: value.toUpperCase() })} />
          <ImageField label="Product image" value={form.image} onChange={(value) => update({ image: value })} uploadImage={uploadImage} />
          <Field
            label="Discount price"
            type="number"
            min={0}
            placeholder="100"
            helper="Customer pays this price."
            value={form.price}
            onChange={(value) => update({ price: value })}
          />
          <Field
            label="Real price / strike price"
            type="number"
            min={0}
            placeholder="150"
            helper="Optional crossed-out price. Keep higher than discount price."
            value={form.originalPrice}
            onChange={(value) => update({ originalPrice: value })}
          />
          <label className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-[#f0d7dd] bg-[#fff4f5] px-3 py-3 text-sm font-black text-charcoal">
            <span className="min-w-0">
              <span className="block text-maroon">Best seller tag</span>
              <span className="mt-0.5 block text-xs font-bold text-muted">Shows a small BEST SELLER tag on this dish card.</span>
            </span>
            <input className="h-5 w-5 shrink-0 accent-maroon" type="checkbox" checked={form.bestseller} onChange={(event) => update({ bestseller: event.target.checked })} />
          </label>
          <PricePreview form={form} />
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
          <div className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            <span>Dish offer / item discount</span>
            <OfferControls value={form.offer} onChange={(offer) => update({ offer })} surface="cream" />
          </div>
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
            Online on live menu
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

function PricePreview({ form }: { form: ProductForm }) {
  const price = Number(form.price);
  const originalPrice = form.originalPrice ? Number(form.originalPrice) : null;
  const hasPrice = Number.isFinite(price) && price > 0;
  const hasStrikePrice = originalPrice !== null && Number.isFinite(originalPrice) && originalPrice > price;
  const hasInvalidStrikePrice = originalPrice !== null && Number.isFinite(originalPrice) && originalPrice > 0 && originalPrice <= price;

  return (
    <div className="rounded-lg border border-border bg-cream px-3 py-2 sm:col-span-2">
      <p className="text-xs font-black uppercase tracking-wide text-maroon">Customer price preview</p>
      <div className="mt-1 flex flex-wrap items-end gap-2">
        {hasStrikePrice ? <span className="text-sm font-bold text-muted line-through">{formatRupees(originalPrice)}</span> : null}
        <span className="text-lg font-black text-charcoal">{hasPrice ? formatRupees(price) : "Enter discount price"}</span>
        {hasStrikePrice ? <span className="pb-0.5 text-xs font-black text-maroon">Save {formatRupees(originalPrice - price)}</span> : null}
      </div>
      {hasInvalidStrikePrice ? (
        <p className="mt-1 text-xs font-bold text-red">Strike price must be higher than discount price.</p>
      ) : null}
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

function OfferControls({ value, onChange, surface }: { value: OfferDraft; onChange: (value: OfferDraft) => void; surface: "cream" | "white" }) {
  const inputClass = `h-11 rounded-lg border border-border px-3 text-sm font-bold text-charcoal ${surface === "cream" ? "bg-cream" : "bg-white"}`;

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-white p-3">
      <select
        value={value.type}
        onChange={(event) => onChange({ ...emptyOfferDraft, type: event.target.value as OfferDraft["type"] })}
        className={inputClass}
      >
        <option value="NONE">No dish offer</option>
        <option value="PERCENT">Percent discount</option>
        <option value="FIXED">Fixed rupee discount</option>
      </select>
      {value.type === "PERCENT" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="number"
            min="1"
            max="100"
            value={value.percent}
            onChange={(event) => onChange({ ...value, percent: event.target.value })}
            className={inputClass}
            placeholder="Discount %"
          />
          <input
            type="number"
            min="0"
            value={value.cap}
            onChange={(event) => onChange({ ...value, cap: event.target.value })}
            className={inputClass}
            placeholder="Max Rs cap"
          />
        </div>
      ) : null}
      {value.type === "FIXED" ? (
        <input
          type="number"
          min="1"
          value={value.amount}
          onChange={(event) => onChange({ ...value, amount: event.target.value })}
          className={inputClass}
          placeholder="Discount Rs"
        />
      ) : null}
      <p className="rounded-lg border border-border bg-cream px-3 py-2 text-xs font-black text-muted">
        {offerDraftToText(value) || "Dish uses category offer when category has one."}
      </p>
    </div>
  );
}

function parseOfferText(offer?: string | null): OfferDraft {
  const text = offer?.trim();
  if (!text) return emptyOfferDraft;

  const normalized = text.toLowerCase().replace(/,/g, "");
  const percent = normalized.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    const cap = normalized.match(/(?:up\s*to|upto|max|maximum)[^\d]*(\d+(?:\.\d+)?)/);
    return {
      type: "PERCENT",
      percent: percent[1],
      cap: cap?.[1] ?? "",
      amount: "",
    };
  }

  const fixed = normalized.match(/(?:rs\.?|inr|\u20b9)\s*(\d+(?:\.\d+)?)\s*(?:off|discount)?/) ?? normalized.match(/(\d+(?:\.\d+)?)\s*(?:rs|rupees)\s*off/);
  if (fixed) {
    return {
      type: "FIXED",
      percent: "",
      cap: "",
      amount: fixed[1],
    };
  }

  return emptyOfferDraft;
}

function offerDraftToText(offer: OfferDraft) {
  if (offer.type === "PERCENT") {
    const percent = normalizePositiveNumber(offer.percent, 100);
    if (!percent) return "";
    const cap = normalizePositiveNumber(offer.cap);
    return `${percent}% OFF${cap ? ` up to Rs ${cap}` : ""}`;
  }

  if (offer.type === "FIXED") {
    const amount = normalizePositiveNumber(offer.amount);
    return amount ? `Rs ${amount} OFF` : "";
  }

  return "";
}

function normalizePositiveNumber(value: string, max?: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const bounded = max ? Math.min(numeric, max) : numeric;
  return Number.isInteger(bounded) ? String(bounded) : bounded.toFixed(2).replace(/\.?0+$/, "");
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  list,
  placeholder,
  helper,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
  placeholder?: string;
  helper?: string;
  min?: number;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
      {label}
      <input type={type} min={min} list={list} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal" />
      {helper ? <span className="text-xs font-bold text-muted">{helper}</span> : null}
    </label>
  );
}
