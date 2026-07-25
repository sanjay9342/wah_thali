"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Edit3, EyeOff } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";

export function AdminDashboardProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not refresh products.");
    setProducts(data.products);
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

  function toggleAvailability(product: Product) {
    run(async () => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !product.available }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Status update failed.");
      await refreshProducts();
      setMessage(`${product.name} is now ${product.available ? "unavailable" : "available"}.`);
    });
  }

  return (
    <>
      {message ? <p className="border-b border-border bg-cream px-5 py-3 text-sm font-black text-maroon">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-cream text-maroon">
            <tr>
              {["Product", "Category", "Price", "Status", "Prep", "Action"].map((head) => (
                <th key={head} className="p-4">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border">
                <td className="p-4 font-black">{product.name}</td>
                <td className="p-4 text-muted">{product.category}</td>
                <td className="p-4 font-black">{formatRupees(product.price)}</td>
                <td className="p-4">
                  <button
                    disabled={isPending}
                    onClick={() => toggleAvailability(product)}
                    className={`inline-flex h-10 min-w-36 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                      product.available ? "bg-maroon text-white" : "border border-border bg-white text-maroon"
                    }`}
                  >
                    {product.available ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                    {product.available ? "Available" : "Unavailable"}
                  </button>
                </td>
                <td className="p-4">{product.prepTimeMinutes} min</td>
                <td className="p-4">
                  <a href={`/admin/inventory?edit=${encodeURIComponent(product.id)}`} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 font-black text-maroon">
                    <Edit3 size={16} /> Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
