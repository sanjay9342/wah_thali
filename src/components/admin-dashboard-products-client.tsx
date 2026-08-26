"use client";

import { useState } from "react";
import { CheckCircle2, Edit3, EyeOff } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch } from "@/lib/admin-client-auth";
import type { Product } from "@/lib/types";
import { formatRupees, getProductUnitPricing } from "@/lib/pricing";

export function AdminDashboardProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(() => sortProductsForAvailability(initialProducts));
  const [message, setMessage] = useState("");
  const [savingProductIds, setSavingProductIds] = useState<Set<string>>(() => new Set());
  const adminAccess = useAdminAccess();

  async function toggleAvailability(product: Product) {
    if (savingProductIds.has(product.id)) return;

    setMessage("");
    const nextAvailable = !product.available;
    setSavingProductIds((current) => new Set(current).add(product.id));
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, available: nextAvailable } : item));

    try {
      const response = await adminFetch(adminAccess?.session, `/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: nextAvailable }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Status update failed.");
      setMessage(`${product.name} is now ${nextAvailable ? "online" : "offline"}.`);
    } catch (error) {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, available: product.available } : item));
      setMessage(error instanceof Error ? error.message : "Status update failed.");
    } finally {
      setSavingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  }

  return (
    <>
      {message ? <p className="border-b border-border bg-cream px-5 py-3 text-sm font-black text-maroon">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-cream text-maroon">
            <tr>
              {["Product", "Category", "Price", "Status", "Action"].map((head) => (
                <th key={head} className="p-4">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const pricing = getProductUnitPricing(product);
              const saving = savingProductIds.has(product.id);

              return (
                <tr key={product.id} className={`border-t border-border ${product.available ? "" : "bg-[#f7f7f7] grayscale"}`}>
                  <td className="p-4 font-black">{product.name}</td>
                  <td className="p-4 text-muted">{product.category}</td>
                  <td className="p-4">
                    {pricing.discountPerUnit > 0 ? <span className="block text-xs font-bold text-muted line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
                    <span className="font-black">{formatRupees(pricing.unitPrice)}</span>
                  </td>
                  <td className="p-4">
                    <button
                      disabled={saving}
                      aria-busy={saving}
                      onClick={() => toggleAvailability(product)}
                      className={`inline-flex h-10 min-w-36 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                        product.available ? "bg-maroon text-white" : "border border-border bg-white text-maroon"
                      }`}
                    >
                      {product.available ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                      {product.available ? "Online" : "Offline"}
                    </button>
                  </td>
                  <td className="p-4">
                    <a href={`/admin/inventory?edit=${encodeURIComponent(product.id)}`} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 font-black text-maroon">
                      <Edit3 size={16} /> Edit
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </>
  );
}

function sortProductsForAvailability(products: Product[]) {
  return [...products].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));
}
