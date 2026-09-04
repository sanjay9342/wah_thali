"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type SyntheticEvent, type WheelEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Download, Edit3, EyeOff, GripVertical, PackagePlus, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch, readAdminApiJson } from "@/lib/admin-client-auth";
import { formatModifierOptionName, getProductModifierGroups } from "@/lib/product-modifiers";
import type { AdminProduct, CategoryOption } from "@/lib/types";
import { formatRupees, getProductUnitPricing } from "@/lib/pricing";
import { formatIstTime } from "@/lib/time";

type ProductForm = {
  id?: string;
  name: string;
  kitchenName: string;
  reportCode: string;
  categoryId: string;
  category: string;
  description: string;
  image: string;
  dietaryType: AdminProduct["dietaryType"];
  rating: string;
  price: string;
  originalPrice: string;
  offer: OfferDraft;
  bestseller: boolean;
  available: boolean;
  variants: { id?: string; name: string; price: string }[];
  addonGroups: AddonGroupDraft[];
};

type OfferDraft = {
  type: "NONE" | "PERCENT" | "FIXED";
  percent: string;
  cap: string;
  amount: string;
};

type AddonGroupDraft = {
  id: string;
  title: string;
  kind: "single" | "multi";
  required: boolean;
  min: string;
  max: string;
  options: { id?: string; name: string; price: string; dietaryType: AdminProduct["dietaryType"] }[];
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
  categoryId: "",
  category: "",
  description: "",
  image: "",
  dietaryType: "VEG",
  rating: "4.5",
  price: "",
  originalPrice: "",
  offer: emptyOfferDraft,
  bestseller: false,
  available: true,
  variants: [],
  addonGroups: [],
};

const savedAddonGroupsStorageKey = "wah-thali-admin-saved-addon-groups";
const savedVariationSetsStorageKey = "wah-thali-admin-saved-variation-sets";

export function AdminInventoryClient({
  initialCategories,
  initialCategoryOptions = [],
  initialProducts,
  initialEditId,
}: {
  initialCategories: string[];
  initialCategoryOptions?: CategoryOption[];
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
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [productScroll, setProductScroll] = useState({ left: 0, max: 0, canScroll: false });
  const productScrollerRef = useRef<HTMLDivElement | null>(null);
  const productScrollFrame = useRef<number | null>(null);
  const dragAutoScrollFrame = useRef<number | null>(null);
  const dragPointerY = useRef(0);
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), messageTone === "success" ? 4200 : 7000);
    return () => window.clearTimeout(timer);
  }, [message, messageTone]);

  useEffect(() => () => {
    if (dragAutoScrollFrame.current !== null) {
      window.cancelAnimationFrame(dragAutoScrollFrame.current);
    }
    if (productScrollFrame.current !== null) {
      window.cancelAnimationFrame(productScrollFrame.current);
    }
  }, []);

  const categoryOptions = useMemo(() => {
    const optionsByName = new Map(initialCategoryOptions.map((category) => [category.name, category]));
    for (const category of initialCategories) {
      if (!optionsByName.has(category)) {
        optionsByName.set(category, {
          id: category,
          name: category,
          sortOrder: optionsByName.size + 1,
          visible: true,
        });
      }
    }
    for (const product of products) {
      if (!optionsByName.has(product.category)) {
        optionsByName.set(product.category, {
          id: product.categoryId ?? product.category,
          name: product.category,
          parentName: product.parentCategory,
          sortOrder: optionsByName.size + 1,
          visible: true,
        });
      }
    }
    return Array.from(optionsByName.values()).sort(compareCategoryOptions);
  }, [initialCategories, initialCategoryOptions, products]);
  const categories = useMemo(() => categoryOptions.map((category) => category.name), [categoryOptions]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.name} ${product.displayName ?? ""} ${product.kitchenName ?? ""} ${product.reportCode ?? ""} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === "All categories" || product.category === categoryFilter || product.parentCategory === categoryFilter;
      const matchesFilter =
        filter === "All products" ||
        (filter === "Available" && product.available) ||
        (filter === "Unavailable" && !product.available) ||
        (filter === "Best Sellers" && product.bestseller) ||
        (filter === "Discounted" && Boolean(product.offer || product.originalPrice));

      return matchesQuery && matchesCategory && matchesFilter;
    });
  }, [categoryFilter, filter, products, query]);

  const readProductScrollState = useCallback(() => {
    const scroller = productScrollerRef.current;
    if (!scroller) return;
    const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setProductScroll({
      left: Math.min(scroller.scrollLeft, max),
      max,
      canScroll: max > 1,
    });
  }, []);

  const updateProductScrollState = useCallback(() => {
    if (productScrollFrame.current !== null) return;
    productScrollFrame.current = window.requestAnimationFrame(() => {
      productScrollFrame.current = null;
      readProductScrollState();
    });
  }, [readProductScrollState]);

  useEffect(() => {
    const scroller = productScrollerRef.current;
    if (!scroller) return;

    readProductScrollState();
    const frame = window.requestAnimationFrame(readProductScrollState);
    scroller.addEventListener("scroll", updateProductScrollState, { passive: true });
    window.addEventListener("resize", readProductScrollState);

    return () => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", updateProductScrollState);
      window.removeEventListener("resize", readProductScrollState);
    };
  }, [filteredProducts.length, readProductScrollState, updateProductScrollState]);

  const stats = {
    total: products.length,
    available: products.filter((product) => product.available).length,
    offline: products.filter((product) => !product.available).length,
    discounted: products.filter((product) => product.offer || product.originalPrice).length,
    categories: categories.length,
  };

  async function refreshProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await readAdminApiJson(response);
    if (!response.ok) throw new Error(getApiErrorMessage(data, "Could not reload products."));
    setProducts(Array.isArray(data.products) ? data.products as AdminProduct[] : []);
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
        name: form.name.trim(),
        displayName: form.name.trim(),
        kitchenName: form.kitchenName || null,
        reportCode: form.reportCode ? form.reportCode.toUpperCase() : null,
        categoryId: form.categoryId || undefined,
        category: form.category.trim(),
        description: form.description.trim(),
        image: form.image.trim() || undefined,
        dietaryType: form.dietaryType,
        rating: Number(form.rating || 4.5),
        price,
        originalPrice,
        offer: offerDraftToText(form.offer) || null,
        bestseller: form.bestseller,
        available: form.available,
        variants: form.variants
          .filter((variant) => variant.name.trim())
          .map((variant) => ({ id: variant.id, name: variant.name.trim(), price: Number(variant.price || 0), available: true })),
        addons: form.addonGroups.filter((group) => group.title.trim() && group.options.some((addon) => addon.name.trim())).flatMap((group) =>
          group.options
            .filter((addon) => addon.name.trim())
            .map((addon) => ({
              id: addon.id,
              name: formatModifierOptionName({
                groupTitle: group.title.trim() || "Add Extras",
                kind: group.kind,
                required: group.required,
                min: Number(group.min || (group.required ? 1 : 0)),
                max: Number(group.max || (group.kind === "single" ? 1 : 0)),
                optionName: addon.name.trim(),
                dietaryType: addon.dietaryType,
              }),
              price: Number(addon.price || 0),
              available: true,
            })),
        ),
      };

      const response = await adminFetch(adminAccess?.session, form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readAdminApiJson(response);
      if (!response.ok) throw new Error(getApiErrorMessage(data, "Product save failed."));

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
      current.map((item) => item.id === product.id ? { ...item, ...patch } : item),
    );

    try {
      const response = await adminFetch(adminAccess?.session, `/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await readAdminApiJson(response);
      if (!response.ok) throw new Error(getApiErrorMessage(data, "Update failed."));
      const updatedProduct = data.product && typeof data.product === "object" ? data.product as Partial<AdminProduct> : null;
      if (typeof updatedProduct?.available === "boolean") {
        const available = updatedProduct.available;
        setProducts((current) =>
          current.map((item) => item.id === product.id ? { ...item, available } : item),
        );
      }
      setLastSyncedAt(new Date());
      showSuccess(`${product.name} is now ${patch.available ? "online" : "offline"}.`);
    } catch (error) {
      setProducts((current) =>
        current.map((item) => item.id === product.id ? previousProduct : item),
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

  function moveProductInCurrentView(productId: string, direction: -1 | 1) {
    const currentIndex = filteredProducts.findIndex((product) => product.id === productId);
    const target = filteredProducts[currentIndex + direction];
    if (!target) return;

    const fromIndex = products.findIndex((product) => product.id === productId);
    const toIndex = products.findIndex((product) => product.id === target.id);
    if (fromIndex < 0 || toIndex < 0) return;
    saveProductOrder(moveItem(products, fromIndex, toIndex));
  }

  function handleProductDragStart(event: DragEvent<HTMLElement>, productId: string) {
    setDraggingProductId(productId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", productId);
  }

  function handleProductDragOver(event: DragEvent<HTMLElement>, productId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverProductId(productId);
    startDragAutoScroll(event.clientY);
  }

  function handleProductListDragOver(event: DragEvent<HTMLElement>) {
    if (!draggingProductId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    startDragAutoScroll(event.clientY);
  }

  function handleProductDrop(event: DragEvent<HTMLElement>, targetProductId: string) {
    event.preventDefault();
    const sourceProductId = event.dataTransfer.getData("text/plain") || draggingProductId;
    setDraggingProductId(null);
    setDragOverProductId(null);
    stopDragAutoScroll();
    if (!sourceProductId || sourceProductId === targetProductId) return;

    const fromIndex = products.findIndex((product) => product.id === sourceProductId);
    const toIndex = products.findIndex((product) => product.id === targetProductId);
    if (fromIndex < 0 || toIndex < 0) return;
    saveProductOrder(moveItem(products, fromIndex, toIndex));
  }

  function startDragAutoScroll(pointerY: number) {
    dragPointerY.current = pointerY;
    if (dragAutoScrollFrame.current !== null) return;
    dragAutoScrollFrame.current = window.requestAnimationFrame(scrollWhileDragging);
  }

  function scrollWhileDragging() {
    dragAutoScrollFrame.current = null;
    const edgeSize = 120;
    const maxSpeed = 28;
    const viewportHeight = window.innerHeight;
    const distanceFromTop = dragPointerY.current;
    const distanceFromBottom = viewportHeight - dragPointerY.current;
    const speed = distanceFromTop < edgeSize
      ? -Math.ceil(((edgeSize - distanceFromTop) / edgeSize) * maxSpeed)
      : distanceFromBottom < edgeSize
        ? Math.ceil(((edgeSize - distanceFromBottom) / edgeSize) * maxSpeed)
        : 0;

    if (!speed) return;
    window.scrollBy(0, speed);
    dragAutoScrollFrame.current = window.requestAnimationFrame(scrollWhileDragging);
  }

  function stopDragAutoScroll() {
    if (dragAutoScrollFrame.current === null) return;
    window.cancelAnimationFrame(dragAutoScrollFrame.current);
    dragAutoScrollFrame.current = null;
  }

  function setProductHorizontalScroll(value: number) {
    const scroller = productScrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: value, behavior: "auto" });
    readProductScrollState();
  }

  function nudgeProductHorizontalScroll(direction: -1 | 1) {
    const scroller = productScrollerRef.current;
    if (!scroller) return;
    const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const distance = Math.max(520, scroller.clientWidth * 0.9);
    const left = Math.min(max, Math.max(0, scroller.scrollLeft + direction * distance));
    scroller.scrollTo({
      left,
      behavior: "smooth",
    });
  }

  function handleProductSliderWheel(event: WheelEvent<HTMLDivElement>) {
    const scroller = productScrollerRef.current;
    if (!scroller) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    setProductHorizontalScroll(Math.min(productScroll.max, Math.max(0, scroller.scrollLeft + delta * 1.4)));
  }

  function saveProductOrder(orderedProducts: AdminProduct[]) {
    setProducts(orderedProducts);
    runMutation(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderedProducts.map((product) => product.id) }),
      });
      const data = await readAdminApiJson(response);
      if (!response.ok) throw new Error(getApiErrorMessage(data, "Product order save failed."));
      await refreshProducts();
      showSuccess("Product order saved successfully.");
    });
  }

  function deleteProduct(product: AdminProduct) {
    const confirmed = window.confirm(`Delete ${product.name}? Dishes used in past orders will be hidden to protect order history.`);
    if (!confirmed) return;

    runMutation(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/products/${product.id}`, { method: "DELETE" });
      const data = await readAdminApiJson(response);
      if (!response.ok) throw new Error(getApiErrorMessage(data, "Delete failed."));
      await refreshProducts();
      showSuccess(data.archived ? "Dish archived because it has order history." : "Dish deleted successfully.");
    });
  }

  function exportCsv() {
    const rows = [
      ["Display Name", "Internal Name", "Shortcut Code", "Category", "Parent Category", "Rating", "Discount Price", "Real/Strike Price", "Available"],
      ...filteredProducts.map((product) => [
        product.name,
        product.kitchenName ?? "",
        product.reportCode ?? "",
        product.category,
        product.parentCategory ?? "",
        String(product.rating),
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
      const data = await readAdminApiJson(response);
      if (!response.ok) throw new Error(getApiErrorMessage(data, "Image upload failed."));
      if (typeof data.publicUrl !== "string" || !data.publicUrl) {
        throw new Error("Image upload finished but no image URL was returned.");
      }
      return data.publicUrl;
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
            <div className="mt-2 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
              {["All categories", ...categoryOptions.map((category) => category.name)].map((category) => {
                const option = categoryOptions.find((item) => item.name === category);
                const isSubcategory = Boolean(option?.parentId);
                return (
                <button key={category} onClick={() => setCategoryFilter(category)} className={`rounded-lg border border-border px-3 py-2 text-left text-xs font-black ${isSubcategory ? "ml-4" : ""} ${categoryFilter === category ? "bg-maroon text-white" : "text-charcoal"}`}>
                  <span className="block">{category}</span>
                  {option?.parentName ? <span className={`mt-0.5 block text-[10px] ${categoryFilter === category ? "text-white/75" : "text-muted"}`}>{option.parentName}</span> : null}
                </button>
                );
              })}
            </div>
          </aside>

          <div className="surface relative min-w-0 overflow-hidden rounded-2xl">
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
            <div ref={productScrollerRef} className="overflow-x-auto" onDragOver={handleProductListDragOver}>
              <table className="w-full min-w-[1280px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[330px]" />
                  <col className="w-[96px]" />
                  <col className="w-[156px]" />
                  <col className="w-[136px]" />
                  <col className="w-[94px]" />
                  <col className="w-[126px]" />
                  <col className="w-[96px]" />
                  <col className="w-[88px]" />
                  <col className="w-[162px]" />
                  <col className="w-[96px]" />
                </colgroup>
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Item", "Price", "Order", "Availability", "Actions", "Choice groups", "Shortcut", "Rating", "Offer", "Variants"].map((head) => (
                      <th key={head} className="p-3 align-middle text-xs font-black uppercase tracking-wide">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const pricing = getProductUnitPricing(product);
                    const offerLabel = product.offer || (pricing.discountPerUnit > 0 ? "Strike price" : "Category/default");
                    const saving = savingProductIds.has(product.id);
                    const modifierGroups = getProductModifierGroups(product);

                    return (
                      <tr
                        key={product.id}
                        onDragOver={(event) => handleProductDragOver(event, product.id)}
                        onDragLeave={() => setDragOverProductId((current) => current === product.id ? null : current)}
                        onDrop={(event) => handleProductDrop(event, product.id)}
                        onDragEnd={() => {
                          setDraggingProductId(null);
                          setDragOverProductId(null);
                          stopDragAutoScroll();
                        }}
                        className={`border-t border-border align-top transition ${product.available ? "" : "bg-[#f7f7f7] grayscale"} ${dragOverProductId === product.id ? "bg-[#fff4f5]" : ""} ${draggingProductId === product.id ? "opacity-55" : ""}`}
                      >
                        <td className="p-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={safeAdminImage(product.image)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" onError={useFallbackImage} />
                            <div className="min-w-0">
                              <p className="break-words font-black leading-snug text-charcoal">{product.name}</p>
                              <p className="mt-1 break-words text-xs font-bold leading-5 text-muted">{product.parentCategory ? `${product.parentCategory} / ` : ""}{product.category} - {product.dietaryType}</p>
                              {product.kitchenName ? <p className="mt-1 text-xs font-black text-maroon">Kitchen: {product.kitchenName}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {pricing.discountPerUnit > 0 ? <span className="block text-xs font-bold text-muted line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
                          <span className="font-black">{formatRupees(pricing.unitPrice)}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isPending || filteredProducts[0]?.id === product.id}
                              onClick={() => moveProductInCurrentView(product.id, -1)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-maroon disabled:opacity-35"
                              aria-label={`Move ${product.name} up`}
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={isPending || filteredProducts[filteredProducts.length - 1]?.id === product.id}
                              onClick={() => moveProductInCurrentView(product.id, 1)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-maroon disabled:opacity-35"
                              aria-label={`Move ${product.name} down`}
                            >
                              <ArrowDown size={15} />
                            </button>
                            <span
                              draggable={!isPending}
                              onDragStart={(event) => handleProductDragStart(event, product.id)}
                              className="grid h-8 w-8 cursor-grab select-none place-items-center rounded-lg border border-border bg-cream text-muted active:cursor-grabbing"
                              title="Drag to reorder"
                              role="button"
                              aria-label={`Drag ${product.name}`}
                            >
                              <GripVertical size={16} />
                            </span>
                          </div>
                        </td>
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
                        <td className="p-3">
                          <span className="font-black">{modifierGroups.length}</span>
                          <span className="ml-1 text-xs font-bold text-muted">/ {product.addons.length} options</span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex h-7 items-center rounded-lg border border-border bg-cream px-2 text-xs font-black text-maroon">
                            {product.reportCode || "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex h-7 items-center rounded-lg bg-[#fff4f5] px-2 text-xs font-black text-maroon">
                            {product.rating}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex min-h-8 max-w-[170px] items-center rounded-full bg-cream px-3 py-1 text-xs font-black text-muted">
                            <span className="truncate">{offerLabel}</span>
                          </span>
                        </td>
                        <td className="p-3 font-bold text-charcoal">{product.variants.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {productScroll.canScroll ? (
              <div onWheel={handleProductSliderWheel} className="fixed bottom-4 left-1/2 z-40 grid w-[min(860px,calc(100vw-32px))] -translate-x-1/2 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 rounded-xl border border-border bg-white/95 p-2 shadow-[0_18px_44px_rgba(34,31,32,0.20)] backdrop-blur">
                <button
                  type="button"
                  onClick={() => nudgeProductHorizontalScroll(-1)}
                  disabled={productScroll.left <= 0}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border text-maroon disabled:opacity-35"
                  aria-label="Scroll products left"
                >
                  <ArrowLeft size={18} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={productScroll.max}
                  step={1}
                  value={productScroll.left}
                  onChange={(event) => setProductHorizontalScroll(event.currentTarget.valueAsNumber)}
                  onInput={(event) => setProductHorizontalScroll(event.currentTarget.valueAsNumber)}
                  className="h-10 w-full cursor-grab accent-maroon active:cursor-grabbing"
                  aria-label="Horizontal product table scroll"
                />
                <button
                  type="button"
                  onClick={() => nudgeProductHorizontalScroll(1)}
                  disabled={productScroll.left >= productScroll.max}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border text-maroon disabled:opacity-35"
                  aria-label="Scroll products right"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {form ? <ProductModal form={form} setForm={setForm} saveProduct={saveProduct} isPending={isPending || uploading} categories={categoryOptions} uploadImage={uploadImage} /> : null}
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

function getApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const payload = data as { error?: unknown; issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
  const fieldMessages = payload.issues?.fieldErrors
    ? Object.entries(payload.issues.fieldErrors).flatMap(([field, messages]) =>
        messages.map((message) => `${field}: ${message}`),
      )
    : [];
  const formMessages = payload.issues?.formErrors ?? [];
  return [...fieldMessages, ...formMessages, typeof payload.error === "string" ? payload.error : fallback][0] ?? fallback;
}

function compareCategoryOptions(a: CategoryOption, b: CategoryOption) {
  return (a.parentName ?? a.name).localeCompare(b.parentName ?? b.name) ||
    Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) ||
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name);
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneAddonGroup(group: AddonGroupDraft, title = group.title): AddonGroupDraft {
  return {
    id: createDraftId(),
    title,
    kind: group.kind,
    required: group.required,
    min: group.min,
    max: group.max,
    options: group.options
      .filter((option) => option.name.trim())
      .map((option) => ({
        name: option.name,
        price: option.price,
        dietaryType: option.dietaryType,
      })),
  };
}

function cloneVariationSet(variants: ProductForm["variants"]) {
  return variants
    .filter((variant) => variant.name.trim())
    .map((variant) => ({
      id: createDraftId(),
      name: variant.name.trim(),
      price: variant.price || "0",
    }));
}

function readSavedAddonGroups(): AddonGroupDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(savedAddonGroupsStorageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((group) => normalizeSavedAddonGroup(group))
      .filter(Boolean)
      .slice(0, 20) as AddonGroupDraft[];
  } catch {
    return [];
  }
}

function readSavedVariationSets(): ProductForm["variants"][] {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(savedVariationSetsStorageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((set) => Array.isArray(set) ? cloneVariationSet(set as ProductForm["variants"]) : [])
      .filter((set) => set.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function writeSavedAddonGroups(groups: AddonGroupDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedAddonGroupsStorageKey, JSON.stringify(groups.map((group) => cloneAddonGroup(group, group.title))));
}

function writeSavedVariationSets(sets: ProductForm["variants"][]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedVariationSetsStorageKey, JSON.stringify(sets.map(cloneVariationSet)));
}

function getVariationSetSignature(variants: ProductForm["variants"]) {
  return cloneVariationSet(variants).map((variant) => `${variant.name}:${variant.price}`).join("|");
}

function getVariationSetLabel(variants: ProductForm["variants"]) {
  const names = cloneVariationSet(variants).map((variant) => variant.name);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

function normalizeSavedAddonGroup(value: unknown): AddonGroupDraft | null {
  if (!value || typeof value !== "object") return null;
  const group = value as Partial<AddonGroupDraft>;
  if (!group.title || !Array.isArray(group.options)) return null;

  return {
    id: createDraftId(),
    title: String(group.title),
    kind: group.kind === "single" ? "single" : "multi",
    required: Boolean(group.required),
    min: String(group.min ?? "0"),
    max: String(group.max ?? "0"),
    options: group.options
      .map((option) => {
        const item = option as Partial<AddonGroupDraft["options"][number]>;
        return {
          name: String(item.name ?? ""),
          price: String(item.price ?? "0"),
          dietaryType: normalizeDietaryType(item.dietaryType),
        };
      })
      .filter((option) => option.name.trim()),
  };
}

function normalizeDietaryType(value: unknown): AdminProduct["dietaryType"] {
  return value === "NON_VEG" || value === "JAIN" ? value : "VEG";
}

function toProductForm(product: AdminProduct): ProductForm {
  return {
    id: product.id,
    name: product.name,
    kitchenName: product.kitchenName ?? "",
    reportCode: product.reportCode ?? "",
    categoryId: product.categoryId ?? "",
    category: product.category,
    description: product.description,
    image: product.image,
    dietaryType: product.dietaryType,
    rating: String(product.rating),
    price: String(product.price),
    originalPrice: product.originalPrice ? String(product.originalPrice) : "",
    offer: parseOfferText(product.offer),
    bestseller: Boolean(product.bestseller),
    available: product.available,
    variants: product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: String(variant.price),
        })),
    addonGroups: getProductModifierGroups(product).map((group) => ({
      id: group.id,
      title: group.title,
      kind: group.kind,
      required: group.required,
      min: String(group.min),
      max: String(group.max),
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        price: String(option.price),
        dietaryType: option.dietaryType ?? product.dietaryType,
      })),
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
  categories: CategoryOption[];
  uploadImage: (file: File) => Promise<string>;
}) {
  const [savedAddonGroups, setSavedAddonGroups] = useState<AddonGroupDraft[]>(() => readSavedAddonGroups());
  const [savedVariationSets, setSavedVariationSets] = useState<ProductForm["variants"][]>(() => readSavedVariationSets());
  const [customChoiceGroupIds, setCustomChoiceGroupIds] = useState<Set<string>>(() => new Set());

  function update(patch: Partial<ProductForm>) {
    setForm({ ...form, ...patch });
  }

  function updateAddonGroup(index: number, patch: Partial<AddonGroupDraft>) {
    update({
      addonGroups: form.addonGroups.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group)),
    });
  }

  function updateAddonOption(groupIndex: number, optionIndex: number, patch: Partial<AddonGroupDraft["options"][number]>) {
    update({
      addonGroups: form.addonGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              ...group,
              options: group.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    });
  }

  function updateVariant(index: number, patch: Partial<ProductForm["variants"][number]>) {
    update({
      variants: form.variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)),
    });
  }

  function applySavedVariationSet(variants: ProductForm["variants"]) {
    update({ variants: cloneVariationSet(variants) });
  }

  function saveVariationSetForReuse() {
    const reusableSet = cloneVariationSet(form.variants);
    if (!reusableSet.length) return;
    const signature = getVariationSetSignature(reusableSet);
    const nextSets = [
      reusableSet,
      ...savedVariationSets.filter((set) => getVariationSetSignature(set) !== signature),
    ].slice(0, 20);
    setSavedVariationSets(nextSets);
    writeSavedVariationSets(nextSets);
  }

  function deleteSavedVariationSet(signature: string) {
    const set = savedVariationSets.find((item) => getVariationSetSignature(item) === signature);
    if (!confirmRemove(`Delete saved variation set "${set ? getVariationSetLabel(set) : "this set"}"?`)) return;
    const nextSets = savedVariationSets.filter((set) => getVariationSetSignature(set) !== signature);
    setSavedVariationSets(nextSets);
    writeSavedVariationSets(nextSets);
  }

  function addAddonGroup(template?: Partial<AddonGroupDraft>) {
    update({
      addonGroups: [
        ...form.addonGroups,
        {
          id: createDraftId(),
          title: template?.title ?? "",
          kind: template?.kind ?? "multi",
          required: template?.required ?? false,
          min: template?.min ?? "0",
          max: template?.max ?? "0",
          options: template?.options?.length ? template.options : [],
        },
      ],
    });
  }

  function applySavedGroup(group: AddonGroupDraft) {
    update({ addonGroups: [...form.addonGroups, cloneAddonGroup(group)] });
  }

  function saveGroupForReuse(group: AddonGroupDraft) {
    if (!group.title.trim() || !group.options.some((option) => option.name.trim())) return;
    const reusableGroup = cloneAddonGroup(group, group.title.trim());
    const nextGroups = [
      reusableGroup,
      ...savedAddonGroups.filter((item) => item.title.trim().toLowerCase() !== group.title.trim().toLowerCase()),
    ].slice(0, 20);
    setSavedAddonGroups(nextGroups);
    writeSavedAddonGroups(nextGroups);
  }

  function deleteSavedGroup(groupTitle: string) {
    if (!confirmRemove(`Delete saved group "${groupTitle}"?`)) return;
    const nextGroups = savedAddonGroups.filter((group) => group.title !== groupTitle);
    setSavedAddonGroups(nextGroups);
    writeSavedAddonGroups(nextGroups);
  }

  function removeVariation(index: number) {
    const variant = form.variants[index];
    if (!confirmRemove(`Remove variation "${variant?.name.trim() || "this variation"}"?`)) return;
    update({ variants: form.variants.filter((_, variantIndex) => variantIndex !== index) });
  }

  function removeAddonGroup(groupIndex: number) {
    const group = form.addonGroups[groupIndex];
    if (!confirmRemove(`Remove choice group "${group?.title.trim() || "this group"}" from this dish?`)) return;
    update({ addonGroups: form.addonGroups.filter((_, currentIndex) => currentIndex !== groupIndex) });
  }

  function removeAddonOption(groupIndex: number, optionIndex: number) {
    const group = form.addonGroups[groupIndex];
    const option = group?.options[optionIndex];
    if (!confirmRemove(`Remove option "${option?.name.trim() || "this option"}"?`)) return;
    updateAddonGroup(groupIndex, { options: group.options.filter((_, currentIndex) => currentIndex !== optionIndex) });
  }

  const parentCategories = categories.filter((category) => !category.parentId);
  const selectedCategory = categories.find((category) => category.id === form.categoryId) ?? categories.find((category) => category.name === form.category);
  const selectedParentId = selectedCategory?.parentId ?? selectedCategory?.id ?? "";
  const subcategoryOptions = selectedParentId ? categories.filter((category) => category.parentId === selectedParentId) : [];
  const selectedSubcategoryId = selectedCategory?.parentId ? selectedCategory.id : "";

  function chooseCategory(categoryId: string) {
    const selected = categories.find((category) => category.id === categoryId);
    update({
      categoryId: selected?.id ?? "",
      category: selected?.name ?? "",
    });
  }

  function chooseSubcategory(categoryId: string) {
    const selected = categories.find((category) => category.id === categoryId);
    if (selected) {
      update({ categoryId: selected.id, category: selected.name });
      return;
    }

    const parent = categories.find((category) => category.id === selectedParentId);
    update({ categoryId: parent?.id ?? "", category: parent?.name ?? "" });
  }

  function getChoiceRule(group: AddonGroupDraft) {
    if (customChoiceGroupIds.has(group.id)) return "custom";
    if (!group.required && Number(group.max || 0) <= 0) return "optional";
    if (group.required && group.kind === "single") return "exact-1";
    if (group.required && group.min === group.max && ["2", "3", "4"].includes(group.min)) return `exact-${group.min}`;
    if (!group.required && ["1", "2", "3", "4"].includes(group.max)) return `upto-${group.max}`;
    return "custom";
  }

  function applyChoiceRule(groupIndex: number, rule: string) {
    const groupId = form.addonGroups[groupIndex]?.id;
    if (rule === "custom") {
      if (groupId) {
        setCustomChoiceGroupIds((current) => new Set(current).add(groupId));
      }
      return;
    }

    if (groupId) {
      setCustomChoiceGroupIds((current) => {
        const next = new Set(current);
        next.delete(groupId);
        return next;
      });
    }

    if (rule === "optional") {
      updateAddonGroup(groupIndex, { kind: "multi", required: false, min: "0", max: "0" });
      return;
    }

    if (rule.startsWith("exact-")) {
      const count = rule.replace("exact-", "");
      updateAddonGroup(groupIndex, {
        kind: count === "1" ? "single" : "multi",
        required: true,
        min: count,
        max: count,
      });
      return;
    }

    if (rule.startsWith("upto-")) {
      const count = rule.replace("upto-", "");
      updateAddonGroup(groupIndex, { kind: "multi", required: false, min: "0", max: count });
      return;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/45 p-3 sm:p-4">
      <div className="grid max-h-[calc(100dvh-24px)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[92dvh]">
        <div className="flex items-center justify-between border-b border-border bg-white p-5">
          <h2 className="text-xl font-black text-maroon">{form.id ? "Edit product" : "Add product"}</h2>
          <button onClick={() => setForm(null)} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain p-5 sm:grid-cols-2 sm:items-start">
          <Field label="Display name" value={form.name} onChange={(value) => update({ name: value })} />
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Category
            <select
              value={selectedParentId}
              onChange={(event) => chooseCategory(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal"
            >
              <option value="">Choose main category</option>
              {parentCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold text-muted">Main menu heading, such as Mini Thali or Combos.</span>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            Subcategory <span className="text-xs text-muted">(optional)</span>
            <select
              value={selectedSubcategoryId}
              disabled={!selectedParentId || !subcategoryOptions.length}
              onChange={(event) => chooseSubcategory(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal disabled:opacity-60"
            >
              <option value="">{subcategoryOptions.length ? "No subcategory, use main category" : "No subcategories for this category"}</option>
              {subcategoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold text-muted">Select this for items like Indian Combo inside Combos.</span>
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
          <Field
            label="Rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            placeholder="4.5"
            helper="This rating is shown on the dish card."
            value={form.rating}
            onChange={(value) => update({ rating: value })}
          />
          <div className="grid min-w-0 gap-2 text-sm font-black text-maroon">
            <span>Dish offer / item discount</span>
            <OfferControls value={form.offer} onChange={(offer) => update({ offer })} surface="cream" />
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-cream p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-maroon">Variations</p>
                <p className="text-xs font-bold text-muted">Optional. Enter the final customer price for each variation.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={!form.variants.some((variant) => variant.name.trim())}
                  onClick={saveVariationSetForReuse}
                  className="h-9 rounded-lg border border-maroon/30 bg-white px-3 text-xs font-black text-maroon disabled:opacity-45"
                >
                  Save variations
                </button>
                <button
                  type="button"
                  onClick={() => update({ variants: [...form.variants, { name: "", price: String(Number(form.price || 0)) }] })}
                  className="h-9 rounded-lg bg-maroon px-3 text-xs font-black text-white"
                >
                  Add variation
                </button>
              </div>
            </div>
            {savedVariationSets.length ? (
              <div className="grid gap-2 rounded-xl border border-border bg-white p-3">
                <p className="text-xs font-black uppercase tracking-wide text-maroon">Saved variation sets</p>
                <div className="flex flex-wrap gap-2">
                  {savedVariationSets.map((set) => {
                    const signature = getVariationSetSignature(set);
                    return (
                      <span key={signature} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-cream p-1">
                        <button
                          type="button"
                          onClick={() => applySavedVariationSet(set)}
                          className="h-8 max-w-[220px] truncate px-2 text-xs font-black text-charcoal"
                          title={`Use ${getVariationSetLabel(set)}`}
                        >
                          {getVariationSetLabel(set)}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedVariationSet(signature)}
                          className="grid h-8 w-8 place-items-center rounded-md text-red"
                          aria-label={`Delete saved variation set ${getVariationSetLabel(set)}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {form.variants.length ? (
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
                    placeholder="Variation price"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariation(index)}
                    className="h-10 rounded-lg border border-border px-3 text-xs font-black text-red"
                  >
                    Remove
                  </button>
                </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-muted">No variations. Customers will add this dish directly.</p>
            )}
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-cream p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-maroon">Choice groups and add-ons</p>
                <p className="text-xs font-bold text-muted">Add only the custom groups this dish needs.</p>
              </div>
              <button
                type="button"
                onClick={() => addAddonGroup()}
                className="h-9 rounded-lg bg-maroon px-3 text-xs font-black text-white"
              >
                Add group
              </button>
            </div>
            {savedAddonGroups.length ? (
              <div className="grid gap-2 rounded-xl border border-border bg-white p-3">
                <p className="text-xs font-black uppercase tracking-wide text-maroon">Saved groups</p>
                <div className="flex flex-wrap gap-2">
                  {savedAddonGroups.map((group) => (
                    <span key={group.title} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-cream p-1">
                      <button
                        type="button"
                        onClick={() => applySavedGroup(group)}
                        className="h-8 max-w-[180px] truncate px-2 text-xs font-black text-charcoal"
                        title={`Use ${group.title}`}
                      >
                        {group.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedGroup(group.title)}
                        className="grid h-8 w-8 place-items-center rounded-md text-red"
                        aria-label={`Delete saved group ${group.title}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {form.addonGroups.length ? (
              <div className="grid gap-3">
                {form.addonGroups.map((group, groupIndex) => (
                  <div key={group.id} className="grid gap-3 rounded-xl border border-border bg-white p-3">
                    <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_190px_auto_auto]">
                      <input
                        value={group.title}
                        onChange={(event) => updateAddonGroup(groupIndex, { title: event.target.value })}
                        className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal"
                        placeholder="Group title"
                      />
                      <select
                        value={getChoiceRule(group)}
                        onChange={(event) => {
                          applyChoiceRule(groupIndex, event.target.value);
                        }}
                        className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                        title="How many options customers can select"
                      >
                        <option value="optional">Optional extras</option>
                        <option value="exact-1">Select any 1</option>
                        <option value="exact-2">Select any 2</option>
                        <option value="exact-3">Select any 3</option>
                        <option value="exact-4">Select any 4</option>
                        <option value="upto-1">Up to 1 optional</option>
                        <option value="upto-2">Up to 2 optional</option>
                        <option value="upto-3">Up to 3 optional</option>
                        <option value="upto-4">Up to 4 optional</option>
                        <option value="custom">Custom rule</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAddonGroup(groupIndex)}
                        className="h-10 rounded-lg border border-border px-3 text-xs font-black text-red"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        disabled={!group.title.trim() || !group.options.some((option) => option.name.trim())}
                        onClick={() => saveGroupForReuse(group)}
                        className="h-10 rounded-lg bg-charcoal px-3 text-xs font-black text-white disabled:opacity-45"
                      >
                        Save group
                      </button>
                    </div>
                    {getChoiceRule(group) === "custom" ? (
                      <div className="grid gap-2 rounded-lg border border-[#f0d7dd] bg-[#fff4f5] p-3 sm:grid-cols-[120px_120px_120px_minmax(0,1fr)]">
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-charcoal">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={(event) => updateAddonGroup(groupIndex, {
                              required: event.target.checked,
                              min: event.target.checked ? group.min || "1" : "0",
                            })}
                          />
                          Required
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={group.min}
                          onChange={(event) => updateAddonGroup(groupIndex, { min: event.target.value })}
                          className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                          placeholder="Minimum"
                        />
                        <input
                          type="number"
                          min={0}
                          value={group.max}
                          onChange={(event) => updateAddonGroup(groupIndex, { max: event.target.value })}
                          className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal"
                          placeholder="Maximum"
                        />
                        <p className="self-center text-xs font-bold leading-5 text-muted sm:pl-2">
                          Use this for large groups, e.g. minimum 0 and maximum 10.
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-lg bg-cream px-3 py-2 text-xs font-bold text-muted">{choiceRuleDescription(group)}</p>
                    )}
                    <div className="grid gap-2">
                      {!group.options.length ? (
                        <p className="rounded-lg border border-dashed border-border bg-cream px-3 py-2 text-xs font-bold text-muted">
                          No options in this group yet.
                        </p>
                      ) : null}
                      {group.options.map((addon, optionIndex) => (
                        <div key={addon.id ?? optionIndex} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_120px_132px_auto]">
                          <input
                            value={addon.name}
                            onChange={(event) => updateAddonOption(groupIndex, optionIndex, { name: event.target.value })}
                            className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal"
                            placeholder="Option name, e.g. Sprite 250ml"
                          />
                          <input
                            type="number"
                            min={0}
                            value={addon.price}
                            onChange={(event) => updateAddonOption(groupIndex, optionIndex, { price: event.target.value })}
                            className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal"
                            placeholder="Price"
                          />
                          <select
                            value={addon.dietaryType}
                            onChange={(event) => updateAddonOption(groupIndex, optionIndex, { dietaryType: event.target.value as AdminProduct["dietaryType"] })}
                            className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                            title="Dietary type"
                          >
                            <option value="VEG">Veg</option>
                            <option value="NON_VEG">Non-veg</option>
                            <option value="JAIN">Jain</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeAddonOption(groupIndex, optionIndex)}
                            className="h-10 rounded-lg border border-border px-3 text-xs font-black text-red"
                          >
                            Remove option
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateAddonGroup(groupIndex, { options: [...group.options, { name: "", price: "0", dietaryType: form.dietaryType }] })}
                        className="h-10 rounded-lg border border-dashed border-maroon/40 bg-cream px-3 text-xs font-black text-maroon"
                      >
                        Add option
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-muted">No choice groups yet. Use a template or add a custom group.</p>
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
        <div className="flex justify-end gap-2 border-t border-border bg-white p-5">
          <button onClick={() => setForm(null)} className="h-11 rounded-lg border border-border px-4 font-black">Cancel</button>
          <button onClick={saveProduct} disabled={isPending || !form.name.trim() || !form.category} className="h-11 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
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
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
  placeholder?: string;
  helper?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-black text-maroon">
      {label}
      <input type={type} min={min} max={max} step={step} list={list} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-border bg-cream px-3 text-charcoal" />
      {helper ? <span className="text-xs font-bold text-muted">{helper}</span> : null}
    </label>
  );
}

function choiceRuleDescription(group: AddonGroupDraft) {
  const min = Number(group.min || 0);
  const max = Number(group.max || 0);
  if (group.required) {
    const requiredCount = Math.max(1, min);
    return `Customer must select ${requiredCount === 1 ? "any 1 option" : `any ${requiredCount} options`} from this group.`;
  }

  if (max > 0) {
    return `Customer can select up to ${max} ${max === 1 ? "option" : "options"} from this group.`;
  }

  return "Customer can skip this group or select any add-ons they want.";
}

function confirmRemove(message: string) {
  return window.confirm(`${message}\n\nThis cannot be undone until you save or recreate it.`);
}
