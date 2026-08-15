"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, EyeOff, ImagePlus, Plus, Trash2 } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";

type AdminCategory = {
  id: string;
  name: string;
  image?: string;
  offer?: string;
  visible: boolean;
  sortOrder: number;
  _count?: { products: number };
};

export function AdminCategoriesClient({ initialCategories }: { initialCategories: AdminCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState("");
  const [newCategoryOffer, setNewCategoryOffer] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      const response = await fetch("/api/storage/upload", { method: "POST", body });
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
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.trim(),
          image: newCategoryImage.trim(),
          offer: newCategoryOffer.trim(),
          visible: true,
          sortOrder: categories.length + 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Category save failed.");
      setNewCategory("");
      setNewCategoryImage("");
      setNewCategoryOffer("");
      await refreshCategories();
      setMessage("Category added live.");
    });
  }

  function updateCategory(category: AdminCategory, patch: Partial<AdminCategory>) {
    run(async () => {
      const response = await fetch(`/api/categories/${category.id}`, {
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

  function deleteCategory(category: AdminCategory) {
    run(async () => {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
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
              <input value={newCategoryOffer} onChange={(event) => setNewCategoryOffer(event.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-bold" placeholder="Category offer, e.g. 30% OFF up to Rs 75" />
              <p className="text-xs font-bold text-muted">Shown on dishes in this category unless that dish has its own offer.</p>
              {newCategoryImage ? (
                <div className="h-32 overflow-hidden rounded-xl bg-white ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeImage(newCategoryImage)} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-maroon px-4 text-sm font-black text-white">
                Upload using your device
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
              <p className="text-sm font-semibold text-muted">{categories.length} categories shown on customer filters and product forms.</p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {categories.map((category) => (
                <article key={category.id} className="rounded-xl border border-border bg-white p-3">
                  <div className="grid grid-cols-[84px_1fr] gap-3">
                    <div className="h-20 w-20 overflow-hidden rounded-xl bg-cream ring-1 ring-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={safeImage(category.image)} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="grid gap-2">
                      <input className="h-10 min-w-0 rounded-lg border border-border bg-cream px-3 text-sm font-black" defaultValue={category.name} onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name && name !== category.name) updateCategory(category, { name });
                      }} />
                      <input className="h-10 min-w-0 rounded-lg border border-border bg-cream px-3 text-xs font-bold" defaultValue={category.image ?? ""} placeholder="Image URL" onBlur={(event) => {
                        if (event.target.value !== (category.image ?? "")) updateCategory(category, { image: event.target.value });
                      }} />
                      <input className="h-10 min-w-0 rounded-lg border border-border bg-cream px-3 text-xs font-bold" defaultValue={category.offer ?? ""} placeholder="Category offer shown on dishes" onBlur={(event) => {
                        if (event.target.value !== (category.offer ?? "")) updateCategory(category, { offer: event.target.value });
                      }} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-lg bg-cream px-3 py-2 text-xs font-black text-muted">{category._count?.products ?? 0} products</span>
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-maroon px-3 text-xs font-black text-white">
                        Upload using your device
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
                    </div>
                    <div className="flex gap-2 sm:justify-end">
                      <button disabled={isPending} onClick={() => updateCategory(category, { visible: !category.visible })} className={`inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${category.visible ? "bg-maroon text-white" : "border border-border bg-white text-maroon"}`}>
                        {category.visible ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                        {category.visible ? "Available" : "Unavailable"}
                      </button>
                      <button disabled={isPending} onClick={() => deleteCategory(category)} className="grid h-10 w-10 place-items-center rounded-lg border border-border text-red disabled:opacity-60" aria-label={`Delete ${category.name}`}>
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
    </main>
  );
}

function safeImage(src?: string) {
  return src?.startsWith("/") ? src : src || "/wah-thali-meal-cutout-v2.png";
}
