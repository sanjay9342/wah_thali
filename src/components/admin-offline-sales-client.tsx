"use client";

import { Minus, Plus, ReceiptText, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch, readAdminApiJson } from "@/lib/admin-client-auth";
import { formatRupees } from "@/lib/pricing";
import { getIstDateTimeInputValue } from "@/lib/time";
import type { AdminProduct } from "@/lib/types";

type SaleLine = {
  productId: string;
  quantity: number;
  price: number;
};

type PaymentMethod = "CASH" | "UPI" | "CARD" | "OTHER";

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export function AdminOfflineSalesClient({ products }: { products: AdminProduct[] }) {
  const adminAccess = useAdminAccess();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [saleAt, setSaleAt] = useState(getIstDateTimeInputValue());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [customerMobile, setCustomerMobile] = useState("");
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState<{ orderNumber: string; grandTotal: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const candidates = products.filter((product) => product.available);
    if (!needle) return candidates.slice(0, 18);
    return candidates.filter((product) => [
      product.name,
      product.displayName,
      product.kitchenName,
      product.reportCode,
      product.category,
    ].filter(Boolean).join(" ").toLowerCase().includes(needle)).slice(0, 18);
  }, [products, query]);

  const subtotal = lines.reduce((total, line) => total + line.price * line.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount || 0)), subtotal);
  const totalBeforeGst = Math.max(subtotal - safeDiscount, 0);

  function addProduct(product: AdminProduct) {
    setMessage("");
    setCreatedOrder(null);
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { productId: product.id, quantity: 1, price: product.price }];
    });
  }

  function updateLine(productId: string, patch: Partial<SaleLine>) {
    setLines((current) => current
      .map((line) => line.productId === productId ? { ...line, ...patch } : line)
      .filter((line) => line.quantity > 0));
  }

  function resetForm() {
    setLines([]);
    setSaleAt(getIstDateTimeInputValue());
    setPaymentMethod("CASH");
    setCustomerName("Walk-in customer");
    setCustomerMobile("");
    setDiscount(0);
    setNote("");
    setMessage("");
    setCreatedOrder(null);
  }

  function saveSale() {
    if (!lines.length) {
      setMessage("Add at least one dish before saving.");
      return;
    }

    startTransition(async () => {
      setMessage("");
      setCreatedOrder(null);
      const response = await adminFetch(adminAccess?.session, "/api/admin/offline-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleAt,
          paymentMethod,
          customerName,
          customerMobile,
          discount: safeDiscount,
          note,
          items: lines,
        }),
      });
      const data = await readAdminApiJson(response);
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Offline sale could not be saved.");
        return;
      }
      const order = readCreatedOrder(data);
      setCreatedOrder(order);
      setMessage(`Offline sale ${order?.orderNumber ?? ""} saved. Reports and dish counts are updated.`);
      setLines([]);
      setDiscount(0);
      setNote("");
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Manual entry</p>
            <h1 className="text-3xl font-black text-maroon">Offline sales</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Add counter, phone, or manual sales into reports and dish counts.</p>
          </div>
          <button
            type="button"
            onClick={saveSale}
            disabled={isPending || !lines.length}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <Save size={18} /> {isPending ? "Saving..." : "Save offline sale"}
          </button>
        </div>
        <AdminSectionNav />

        {message ? (
          <p className={`mt-4 rounded-lg border px-4 py-3 text-sm font-black ${createdOrder ? "border-[#bfe7ce] bg-[#f1fbf5] text-[#0f7a45]" : "border-[#ffd1d6] bg-[#fff4f5] text-red"}`} role="status">
            {message}
          </p>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-maroon">
                <Search className="text-red" size={20} /> Add dishes
              </h2>
              <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-border bg-cream px-3 text-xs font-black text-maroon">
                <Search size={15} className="text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-charcoal"
                  placeholder="Search by dish name, category, or report code"
                />
              </label>
            </div>
            <div className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="min-h-[112px] rounded-lg border border-border bg-white p-3 text-left transition hover:border-red/40 hover:bg-[#fff8f9]"
                >
                  <span className="block text-[13px] font-black leading-5 text-charcoal">{product.displayName || product.name}</span>
                  <span className="mt-1 block text-[11px] font-bold leading-4 text-muted">{product.reportCode ? `${product.reportCode} | ` : ""}{product.category}</span>
                  <span className="mt-2 inline-flex rounded-md bg-cream px-2.5 py-1 text-xs font-black text-maroon">{formatRupees(product.price)}</span>
                </button>
              ))}
              {!filteredProducts.length ? (
                <p className="rounded-lg border border-border bg-cream p-3 text-xs font-bold text-muted sm:col-span-2 xl:col-span-3">No matching available dishes.</p>
              ) : null}
            </div>
          </div>

          <aside className="surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                  <ReceiptText className="text-red" size={22} /> Sale bill
                </h2>
                <p className="text-sm font-semibold text-muted">{lines.length} dish line{lines.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" onClick={resetForm} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
                <RotateCcw size={16} /> Reset
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <label className="grid gap-2 text-sm font-black text-maroon">
                Sale date and time
                <input
                  type="datetime-local"
                  value={saleAt}
                  onChange={(event) => setSaleAt(event.target.value)}
                  className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-maroon">
                  Customer name
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-maroon">
                  Mobile optional
                  <input
                    value={customerMobile}
                    onChange={(event) => setCustomerMobile(event.target.value)}
                    className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                    placeholder="Walk-in if blank"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-black text-maroon">
                Payment
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                >
                  {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                    <option key={method} value={method}>{paymentLabels[method]}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-border bg-white">
                {lines.map((line) => {
                  const product = productById.get(line.productId);
                  if (!product) return null;
                  return (
                    <div key={line.productId} className="grid gap-3 border-b border-border p-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-charcoal">{product.displayName || product.name}</p>
                          <p className="text-xs font-bold text-muted">{formatRupees(line.price)} each</p>
                        </div>
                        <button type="button" onClick={() => updateLine(line.productId, { quantity: 0 })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Remove ${product.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                        <button type="button" onClick={() => updateLine(line.productId, { quantity: line.quantity - 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label="Decrease quantity">
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.productId, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                          className="h-9 min-w-0 rounded-lg border border-border bg-cream px-3 text-center text-sm font-black text-charcoal"
                          aria-label={`${product.name} quantity`}
                        />
                        <button type="button" onClick={() => updateLine(line.productId, { quantity: line.quantity + 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label="Increase quantity">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!lines.length ? <p className="p-5 text-center text-sm font-bold text-muted">Select dishes to start the offline bill.</p> : null}
              </div>

              <label className="grid gap-2 text-sm font-black text-maroon">
                Discount
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount}
                  onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
                  className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-maroon">
                Staff note optional
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="rounded-lg border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal"
                  placeholder="Counter sale, phone sale, event sale..."
                />
              </label>

              <div className="rounded-xl bg-cream p-4">
                <div className="flex justify-between text-sm font-bold text-muted"><span>Subtotal</span><span>{formatRupees(subtotal)}</span></div>
                <div className="mt-2 flex justify-between text-sm font-bold text-muted"><span>Discount</span><span>-{formatRupees(safeDiscount)}</span></div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-xl font-black text-maroon"><span>Before GST</span><span>{formatRupees(totalBeforeGst)}</span></div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function readCreatedOrder(data: unknown) {
  if (!data || typeof data !== "object" || !("order" in data)) return null;
  const order = data.order;
  if (!order || typeof order !== "object" || !("orderNumber" in order) || !("grandTotal" in order)) return null;
  return {
    orderNumber: String(order.orderNumber),
    grandTotal: Number(order.grandTotal) || 0,
  };
}
