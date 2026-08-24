"use client";

import { type DragEvent, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Edit3, EyeOff, GripVertical, ImagePlus, Plus, Tag, Trash2, Upload, X } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch } from "@/lib/admin-client-auth";

type AdminCategory = {
  id: string;
  name: string;
  image?: string;
  offer?: string;
  visible: boolean;
  sortOrder: number;
  _count?: { products: number };
};

type OfferDraft = {
  type: "NONE" | "PERCENT" | "FIXED";
  percent: string;
  cap: string;
  amount: string;
};

const emptyOfferDraft: OfferDraft = {
  type: "NONE",
  percent: "",
  cap: "",
  amount: "",
};

export function AdminCategoriesClient({ initialCategories }: { initialCategories: AdminCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState("");
  const [newCategoryOffer, setNewCategoryOffer] = useState<OfferDraft>(emptyOfferDraft);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  async function refreshCategories() {
    const response = await fetch("/api/categories", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not reload categories.");
    setCategories(data.categories);
  }

  function run(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "categories");
      const response = await adminFetch(adminAccess?.session, "/api/storage/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Image upload failed.");
      return data.publicUrl as string;
    } finally {
      setUploading(false);
    }
  }

  function addCategory() {
    if (!newCategory.trim()) return;
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.trim(),
          image: newCategoryImage.trim(),
          offer: offerDraftToText(newCategoryOffer),
          visible: true,
          sortOrder: categories.length + 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Category save failed.");
      setNewCategory("");
      setNewCategoryImage("");
      setNewCategoryOffer(emptyOfferDraft);
      await refreshCategories();
      setMessage("Category added live.");
    });
  }

  function updateCategory(category: AdminCategory, patch: Partial<AdminCategory>) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Category update failed.");
      await refreshCategories();
      setMessage("Category updated live.");
    });
  }

  function saveCategoryOrder(nextCategories: AdminCategory[]) {
    const orderedCategories = withPositionNumbers(nextCategories);
    setCategories(orderedCategories);
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderedCategories.map((category) => ({
            id: category.id,
            sortOrder: category.sortOrder,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Category order save failed.");
      await refreshCategories();
      setMessage("Category order saved.");
    });
  }

  function moveCategory(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= categories.length || fromIndex === toIndex) return;
    saveCategoryOrder(moveItem(categories, fromIndex, toIndex));
  }

  function handleDragStart(event: DragEvent<HTMLElement>, categoryId: string) {
    setDraggingCategoryId(categoryId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", categoryId);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, categoryId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverCategoryId(categoryId);
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetCategoryId: string) {
    event.preventDefault();
    const sourceCategoryId = event.dataTransfer.getData("text/plain") || draggingCategoryId;
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
    if (!sourceCategoryId || sourceCategoryId === targetCategoryId) return;

    const fromIndex = categories.findIndex((category) => category.id === sourceCategoryId);
    const toIndex = categories.findIndex((category) => category.id === targetCategoryId);
    if (fromIndex < 0 || toIndex < 0) return;
    saveCategoryOrder(moveItem(categories, fromIndex, toIndex));
  }

  function deleteCategory(category: AdminCategory) {
    const productCount = category._count?.products ?? 0;
    const confirmed = window.confirm(
      productCount > 0
        ? `Delete ${category.name}? This category has ${productCount} ${productCount === 1 ? "dish" : "dishes"}, so it will be hidden to protect the menu and order history.`
        : `Delete ${category.name}? This category will be removed permanently.`,
    );
    if (!confirmed) return;

    run(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/categories/${category.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Category delete failed.");
      await refreshCategories();
      setMessage(data.archived ? "Category hidden because it has products." : "Category deleted.");
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Menu setup</p>
            <h1 className="text-3xl font-black text-maroon">Menu categories</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Create customer-facing categories, upload images, and control availability.</p>
          </div>
        </div>
        <AdminSectionNav />

        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <ImagePlus className="text-red" /> Add category
            </h2>
            <div className="mt-4 grid gap-3 rounded-xl border border-border bg-cream p-4">
              <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-bold" placeholder="New category name" />
              <input value={newCategoryImage} onChange={(event) => setNewCategoryImage(event.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-bold" placeholder="Image URL or /public path" />
              <div className="grid gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-maroon">
                  <Tag size={14} /> Category offer
                </span>
                <OfferControls value={newCategoryOffer} onChange={setNewCategoryOffer} surface="light" />
              </div>
              {newCategoryImage ? (
                <div className="h-32 overflow-hidden rounded-xl bg-white ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeImage(newCategoryImage)} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon px-4 text-sm font-black text-white">
                <Upload size={17} /> Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      setNewCategoryImage(await uploadImage(file));
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Image upload failed.");
                    }
                  }}
                />
              </label>
              <button disabled={isPending || uploading || !newCategory.trim()} onClick={addCategory} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
                <Plus size={18} /> Add category
              </button>
            </div>
          </aside>

          <section className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-black text-maroon">Live category list</h2>
              <p className="text-sm font-semibold text-muted">{categories.length} categories numbered first to last for customer filters, product forms, and recommendations.</p>
            </div>
            <div className="grid gap-3 p-4 sm:p-5">
              {categories.map((category, index) => (
                <article
                  key={category.id}
                  onDragOver={(event) => handleDragOver(event, category.id)}
                  onDragLeave={() => setDragOverCategoryId((current) => current === category.id ? null : current)}
                  onDrop={(event) => handleDrop(event, category.id)}
                  onDragEnd={() => {
                    setDraggingCategoryId(null);
                    setDragOverCategoryId(null);
                  }}
                  className={`grid min-w-0 gap-4 rounded-xl border bg-white p-4 transition sm:grid-cols-[64px_minmax(0,1fr)] ${dragOverCategoryId === category.id ? "border-maroon shadow-md" : "border-border"} ${draggingCategoryId === category.id ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2 sm:grid sm:content-start sm:gap-2">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-maroon text-xl font-black text-white" aria-label={`Position ${index + 1}`}>
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1 sm:grid sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={isPending || index === 0}
                        onClick={() => moveCategory(index, index - 1)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon disabled:opacity-40"
                        aria-label={`Move ${category.name} up`}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={isPending || index === categories.length - 1}
                        onClick={() => moveCategory(index, index + 1)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon disabled:opacity-40"
                        aria-label={`Move ${category.name} down`}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-4">
                      <div className="h-[88px] w-[88px] overflow-hidden rounded-xl bg-cream ring-1 ring-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={safeImage(category.image)} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_84px] items-start gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-charcoal">{category.name}</h3>
                          <p className="mt-1 text-xs font-bold text-muted">No. {index + 1} - {category._count?.products ?? 0} products</p>
                        </div>
                        <span className={`inline-flex h-8 w-full items-center justify-center rounded-lg px-2.5 text-[11px] font-black ${category.visible ? "bg-[#effaf4] text-[#0f7a45]" : "bg-[#f2f4f7] text-[#4b5563]"}`}>
                          {category.visible ? "Online" : "Offline"}
                        </span>
                        </div>
                        <p className="mt-3 truncate rounded-lg bg-cream px-3 py-2 text-xs font-bold text-muted">{category.image || "No image set"}</p>
                      </div>
                    </div>

                    <div
                      draggable={!isPending}
                      onDragStart={(event) => handleDragStart(event, category.id)}
                      className="inline-flex h-10 cursor-grab select-none items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-black uppercase text-maroon active:cursor-grabbing"
                      role="button"
                      tabIndex={0}
                      aria-label={`Drag ${category.name}`}
                    >
                      <GripVertical size={17} /> Drag
                    </div>

                    <div className="rounded-xl border border-border bg-cream px-3 py-3 xl:col-span-2">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-black uppercase tracking-wide text-maroon">
                          <Tag size={14} /> Category offer
                        </span>
                        <span className="min-w-0 truncate rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-muted ring-1 ring-border">
                          {category.offer ? category.offer : "No offer"}
                        </span>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 xl:col-span-2">
                      <button type="button" onClick={() => setEditingCategory(category)} className="inline-flex h-9 w-[94px] items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-black text-maroon">
                        <Edit3 size={15} /> Edit
                      </button>
                      <label className="inline-flex h-9 w-[132px] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-maroon px-2.5 text-xs font-black text-white">
                        <Upload size={15} /> Upload image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            try {
                              updateCategory(category, { image: await uploadImage(file) });
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : "Image upload failed.");
                            }
                          }}
                        />
                      </label>
                      <button disabled={isPending} onClick={() => updateCategory(category, { visible: !category.visible })} className={`inline-flex h-9 w-[96px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-black disabled:opacity-60 ${category.visible ? "bg-maroon text-white" : "border border-border bg-white text-maroon"}`}>
                        {category.visible ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                        {category.visible ? "Online" : "Offline"}
                      </button>
                      <button disabled={isPending} onClick={() => deleteCategory(category)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red disabled:opacity-60" aria-label={`Delete ${category.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
      {editingCategory ? (
        <CategoryEditModal
          category={editingCategory}
          isPending={isPending || uploading}
          onClose={() => setEditingCategory(null)}
          onSave={(patch) => {
            updateCategory(editingCategory, patch);
            setEditingCategory(null);
          }}
          uploadImage={uploadImage}
        />
      ) : null}
    </main>
  );
}

function safeImage(src?: string) {
  return src?.startsWith("/") ? src : src || "/wah-thali-meal-cutout-v2.png";
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function withPositionNumbers(categories: AdminCategory[]) {
  return categories.map((category, index) => ({ ...category, sortOrder: index + 1 }));
}

function CategoryEditModal({
  category,
  isPending,
  onClose,
  onSave,
  uploadImage,
}: {
  category: AdminCategory;
  isPending: boolean;
  onClose: () => void;
  onSave: (patch: Partial<AdminCategory>) => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState({
    name: category.name,
    image: category.image ?? "",
    offer: parseOfferText(category.offer),
    visible: category.visible,
    sortOrder: String(category.sortOrder),
  });
  const [error, setError] = useState("");

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const image = await uploadImage(file);
      setDraft((current) => ({ ...current, image }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-xl font-black text-maroon">Edit category</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-2 text-sm font-black text-maroon">
            Category name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-11 rounded-lg border border-border bg-cream px-3 text-charcoal" />
          </label>
          <label className="grid gap-2 text-sm font-black text-maroon">
            Image
            <div className="grid gap-2 rounded-xl border border-border bg-cream p-3">
              {draft.image ? (
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeImage(draft.image)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 truncate text-xs font-bold text-muted">{draft.image}</span>
                </div>
              ) : null}
              <input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} className="h-10 rounded-lg border border-border bg-white px-3 text-xs font-bold text-charcoal" placeholder="Image URL or /public path" />
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white">
                <Upload size={16} /> Upload image
                <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0])} />
              </label>
            </div>
          </label>
          <div className="grid gap-2 text-sm font-black text-maroon">
            Category offer
            <OfferControls value={draft.offer} onChange={(offer) => setDraft({ ...draft, offer })} surface="cream" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-maroon">
              Sort order
              <input type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className="h-11 rounded-lg border border-border bg-cream px-3 text-charcoal" />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-border bg-cream px-3 py-3 text-sm font-black text-charcoal">
              <input type="checkbox" checked={draft.visible} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} />
              Online category
            </label>
          </div>
          {error ? <p className="text-sm font-black text-red">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 font-black">Cancel</button>
          <button
            type="button"
            disabled={isPending || !draft.name.trim()}
            onClick={() => onSave({
              name: draft.name.trim(),
              image: draft.image.trim(),
              offer: offerDraftToText(draft.offer),
              visible: draft.visible,
              sortOrder: Number(draft.sortOrder || 0),
            })}
            className="h-11 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60"
          >
            Save category
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferControls({ value, onChange, surface }: { value: OfferDraft; onChange: (value: OfferDraft) => void; surface: "light" | "cream" }) {
  const inputClass = `h-11 rounded-lg border border-border px-3 text-sm font-bold text-charcoal ${surface === "light" ? "bg-white" : "bg-cream"}`;
  const selectClass = `h-11 rounded-lg border border-border px-3 text-sm font-black text-charcoal ${surface === "light" ? "bg-white" : "bg-cream"}`;

  return (
    <div className="grid gap-2">
      <select value={value.type} onChange={(event) => onChange({ ...emptyOfferDraft, type: event.target.value as OfferDraft["type"] })} className={selectClass}>
        <option value="NONE">No offer</option>
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
      <p className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-black text-muted">
        {offerDraftToText(value) || "No offer"}
      </p>
    </div>
  );
}

function parseOfferText(offer?: string): OfferDraft {
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
