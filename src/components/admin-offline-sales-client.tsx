"use client";

import { Minus, Plus, Printer, ReceiptText, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { business } from "@/lib/business";
import { adminFetch, readAdminApiJson } from "@/lib/admin-client-auth";
import { formatRupees, normalizeGstRate } from "@/lib/pricing";
import { getModifierOptionLabel, getModifierSelectionIssue, getProductModifierGroups } from "@/lib/product-modifiers";
import { formatIstDateTime, getIstDateTimeInputValue } from "@/lib/time";
import type { AdminProduct } from "@/lib/types";

type SaleLine = {
  id: string;
  productId: string;
  variantId: string;
  addonIds: string[];
  quantity: number;
  price: number;
  name: string;
};

type CreatedOfflineOrder = {
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  createdAt: string;
  paymentSummary: string;
  items: { productId?: string; name: string; quantity: number; price: number }[];
};

type PaymentMethod = "CASH" | "UPI" | "CARD" | "OTHER";

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export function AdminOfflineSalesClient({ products, gstRate }: { products: AdminProduct[]; gstRate: number }) {
  const adminAccess = useAdminAccess();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [saleAt, setSaleAt] = useState(getIstDateTimeInputValue());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [extraCharges, setExtraCharges] = useState(0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOfflineOrder | null>(null);
  const [configuringProduct, setConfiguringProduct] = useState<AdminProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("regular");
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const gstPercent = normalizeGstRate(gstRate);
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
  const safeExtraCharges = Math.max(0, Math.round(extraCharges || 0));
  const taxable = Math.max(subtotal - safeDiscount + safeExtraCharges, 0);
  const gst = Math.round(taxable * gstPercent);
  const grandTotal = taxable + gst;

  const configVariants = configuringProduct ? getProductVariants(configuringProduct) : [];
  const selectedVariant = configVariants.find((variant) => variant.id === selectedVariantId) ?? configVariants[0];
  const modifierGroups = useMemo(() => configuringProduct ? getProductModifierGroups(configuringProduct) : [], [configuringProduct]);
  const selectedAddonIds = useMemo(
    () => configuringProduct
      ? configuringProduct.addons.flatMap((addon) => Array.from({ length: addonQuantities[addon.id] ?? 0 }, () => addon.id))
      : [],
    [addonQuantities, configuringProduct],
  );
  const addonTotal = configuringProduct
    ? configuringProduct.addons.reduce((total, addon) => total + addon.price * (addonQuantities[addon.id] ?? 0), 0)
    : 0;
  const modifierSelectionIssue = getModifierSelectionIssue(modifierGroups, addonQuantities);
  const configuredUnitPrice = configuringProduct && selectedVariant ? getUnitPrice(configuringProduct, selectedVariant, addonTotal) : 0;

  function openProduct(product: AdminProduct) {
    setMessage("");
    setCreatedOrder(null);
    const variants = getProductVariants(product);
    setSelectedVariantId(variants[0]?.id ?? "regular");
    setAddonQuantities({});
    if (variants.length <= 1 && product.addons.length === 0) {
      addConfiguredLine(product, variants[0] ?? { id: "regular", name: "Regular", price: 0 }, []);
      return;
    }
    setConfiguringProduct(product);
  }

  function addConfiguredLine(product: AdminProduct, variant: { id: string; name: string; price: number }, addonIds: string[]) {
    const selectedAddons = addonIds.map((addonId) => product.addons.find((addon) => addon.id === addonId)).filter((addon): addon is AdminProduct["addons"][number] => Boolean(addon));
    const unitPrice = getUnitPrice(product, variant, selectedAddons.reduce((total, addon) => total + addon.price, 0));
    const name = getLineName(product, variant, selectedAddons);
    const lineKey = getLineKey(product.id, variant.id, addonIds);

    setLines((current) => {
      const existing = current.find((line) => getLineKey(line.productId, line.variantId, line.addonIds) === lineKey);
      if (existing) {
        return current.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, {
        id: `${lineKey}-${Date.now()}`,
        productId: product.id,
        variantId: variant.id,
        addonIds,
        quantity: 1,
        price: unitPrice,
        name,
      }];
    });
  }

  function addConfiguredProduct() {
    if (!configuringProduct || !selectedVariant || modifierSelectionIssue) return;
    addConfiguredLine(configuringProduct, selectedVariant, selectedAddonIds);
    setConfiguringProduct(null);
  }

  function updateLine(lineId: string, patch: Partial<SaleLine>) {
    setLines((current) => current
      .map((line) => line.id === lineId ? { ...line, ...patch } : line)
      .filter((line) => line.quantity > 0));
  }

  function resetForm() {
    setLines([]);
    setSaleAt(getIstDateTimeInputValue());
    setPaymentMethod("CASH");
    setCustomerName("");
    setCustomerMobile("");
    setCustomerAddress("");
    setDiscount(0);
    setExtraCharges(0);
    setNote("");
    setMessage("");
    setCreatedOrder(null);
    setConfiguringProduct(null);
  }

  async function persistSale() {
    if (!lines.length) {
      setMessage("Add at least one dish before saving.");
      return null;
    }

    setMessage("");
    setCreatedOrder(null);
    const response = await adminFetch(adminAccess?.session, "/api/admin/offline-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleAt,
        paymentMethod,
        customerName: customerName.trim() || "Walk-in customer",
        customerMobile,
        customerAddress,
        discount: safeDiscount,
        extraCharges: safeExtraCharges,
        note,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          addonIds: line.addonIds,
          quantity: line.quantity,
        })),
      }),
    });
    const data = await readAdminApiJson(response);
    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Offline sale could not be saved.");
      return null;
    }
    const order = readCreatedOrder(data);
    setCreatedOrder(order);
    setMessage(`Offline sale ${order?.orderNumber ?? ""} saved. Reports and dish counts are updated.`);
    setLines([]);
    setDiscount(0);
    setExtraCharges(0);
    setNote("");
    return order;
  }

  function saveSale() {
    startTransition(async () => {
      await persistSale();
    });
  }

  function printBill() {
    if (createdOrder) {
      printOfflineBill(createdOrder, (text) => setMessage(text));
      return;
    }
    if (!lines.length) {
      setMessage("Add at least one dish before printing.");
      return;
    }
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) {
      setMessage("Popup blocked. Please allow popups to print the bill.");
      return;
    }
    win.document.write("<!doctype html><title>Saving bill...</title><body style=\"font-family:Arial,sans-serif;padding:18px\"><strong>Saving bill...</strong></body>");
    win.document.close();
    startTransition(async () => {
      const order = await persistSale();
      if (!order) {
        win.close();
        return;
      }
      writeOfflineBill(win, order);
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
              {filteredProducts.map((product) => {
                const hasOptions = getProductVariants(product).length > 1 || product.addons.length > 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProduct(product)}
                    className="min-h-[126px] rounded-lg border border-border bg-white p-3 text-left transition hover:border-red/40 hover:bg-[#fff8f9]"
                  >
                    <span className="block text-[13px] font-black leading-5 text-charcoal">{product.displayName || product.name}</span>
                    <span className="mt-1 block text-[11px] font-bold leading-4 text-muted">{product.reportCode ? `${product.reportCode} | ` : ""}{product.category}</span>
                    <span className="mt-2 inline-flex rounded-md bg-cream px-2.5 py-1 text-xs font-black text-maroon">{formatRupees(product.price)}</span>
                    {hasOptions ? <span className="mt-2 block text-[11px] font-black text-red">Variants / add-ons available</span> : null}
                  </button>
                );
              })}
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
              <div className="flex flex-wrap justify-end gap-2">
                {createdOrder || lines.length ? (
                  <button type="button" onClick={printBill} disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-charcoal px-3 text-sm font-black text-white disabled:opacity-60">
                    <Printer size={16} /> Print bill
                  </button>
                ) : null}
                <button type="button" onClick={resetForm} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
                  <RotateCcw size={16} /> Reset
                </button>
              </div>
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
                    placeholder="Walk-in customer"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-maroon">
                  Mobile
                  <input
                    value={customerMobile}
                    onChange={(event) => setCustomerMobile(event.target.value)}
                    className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                    placeholder="Walk-in if blank"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-black text-maroon">
                Address
                <textarea
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  rows={2}
                  className="rounded-lg border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal"
                  placeholder="Delivery address, counter note, or location"
                />
              </label>

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
                  return (
                    <div key={line.id} className="grid gap-3 border-b border-border p-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-charcoal">{line.name}</p>
                          <p className="text-xs font-bold text-muted">{formatRupees(line.price)} each</p>
                        </div>
                        <button type="button" onClick={() => updateLine(line.id, { quantity: 0 })} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-red" aria-label={`Remove ${product?.name ?? line.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                        <button type="button" onClick={() => updateLine(line.id, { quantity: line.quantity - 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label="Decrease quantity">
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                          className="h-9 min-w-0 rounded-lg border border-border bg-cream px-3 text-center text-sm font-black text-charcoal"
                          aria-label={`${line.name} quantity`}
                        />
                        <button type="button" onClick={() => updateLine(line.id, { quantity: line.quantity + 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label="Increase quantity">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!lines.length ? <p className="p-5 text-center text-sm font-bold text-muted">Select dishes to start the offline bill.</p> : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
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
                  Extra charges
                  <input
                    type="number"
                    min="0"
                    value={extraCharges}
                    onChange={(event) => setExtraCharges(Math.max(0, Number(event.target.value) || 0))}
                    className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                  />
                </label>
              </div>

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
                <div className="mt-2 flex justify-between text-sm font-bold text-muted"><span>Extra charges</span><span>{formatRupees(safeExtraCharges)}</span></div>
                <div className="mt-2 flex justify-between text-sm font-bold text-muted"><span>GST {formatPercent(gstPercent)}</span><span>{formatRupees(gst)}</span></div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-xl font-black text-maroon"><span>Total bill</span><span>{formatRupees(grandTotal)}</span></div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {configuringProduct ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="offline-modifier-title" onClick={() => setConfiguringProduct(null)}>
          <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id="offline-modifier-title" className="text-lg font-black text-maroon">{configuringProduct.displayName || configuringProduct.name}</h2>
                <p className="text-xs font-bold text-muted">{configuringProduct.category}</p>
              </div>
              <button type="button" onClick={() => setConfiguringProduct(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label="Close dish options">
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-4 p-4">
              <div className="grid gap-2">
                <p className="text-sm font-black text-maroon">Variation</p>
                <div className="grid gap-2">
                  {configVariants.map((variant) => (
                    <label key={variant.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal">
                      <span className="flex min-w-0 items-center gap-2">
                        <input type="radio" checked={selectedVariantId === variant.id} onChange={() => setSelectedVariantId(variant.id)} />
                        <span className="truncate">{variant.name}</span>
                      </span>
                      <span>{formatRupees(getUnitPrice(configuringProduct, variant, 0))}</span>
                    </label>
                  ))}
                </div>
              </div>

              {modifierGroups.map((group) => (
                <div key={group.id} className="grid gap-2">
                  <p className="text-sm font-black text-maroon">{group.title}</p>
                  <div className="grid gap-2">
                    {group.options.map((option) => {
                      const selected = (addonQuantities[option.id] ?? 0) > 0;
                      return (
                        <label key={option.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal">
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type={group.kind === "single" ? "radio" : "checkbox"}
                              name={group.id}
                              checked={selected}
                              onChange={() => {
                                if (group.kind === "single") {
                                  setAddonQuantities((current) => ({
                                    ...Object.fromEntries(Object.entries(current).filter(([addonId]) => !group.options.some((item) => item.id === addonId))),
                                    [option.id]: 1,
                                  }));
                                  return;
                                }
                                setAddonQuantities((current) => {
                                  if (selected) {
                                    const next = { ...current };
                                    delete next[option.id];
                                    return next;
                                  }
                                  return { ...current, [option.id]: 1 };
                                });
                              }}
                            />
                            <span className="truncate">{option.name}</span>
                          </span>
                          <span>{option.price ? `+${formatRupees(option.price)}` : "No charge"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {modifierSelectionIssue ? <p className="rounded-lg border border-[#ffd1d6] bg-[#fff4f5] px-3 py-2 text-xs font-black text-red">{modifierSelectionIssue}</p> : null}
              <button
                type="button"
                onClick={addConfiguredProduct}
                disabled={Boolean(modifierSelectionIssue)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
              >
                <Plus size={17} /> Add to bill {formatRupees(configuredUnitPrice)}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function getProductVariants(product: AdminProduct) {
  return product.variants.length ? product.variants : [{ id: "regular", name: "Regular", price: 0 }];
}

function getUnitPrice(product: AdminProduct, variant: { price: number }, addonTotal: number) {
  return product.price + variant.price + addonTotal;
}

function getLineName(product: AdminProduct, variant: { name: string }, addons: { name: string }[]) {
  const variantName = variant.name.toLowerCase() === "regular" ? "" : variant.name;
  const addonNames = addons.map((addon) => getModifierOptionLabel(addon.name));
  return [product.displayName || product.name, variantName, addonNames.length ? `With ${addonNames.join(", ")}` : ""].filter(Boolean).join(" - ");
}

function getLineKey(productId: string, variantId: string, addonIds: string[]) {
  return [productId, variantId, [...addonIds].sort().join(",")].join("|");
}

function formatPercent(rate: number) {
  const percent = rate * 100;
  return `@ ${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function readCreatedOrder(data: unknown): CreatedOfflineOrder | null {
  if (!data || typeof data !== "object" || !("order" in data)) return null;
  const order = data.order;
  if (!order || typeof order !== "object" || !("orderNumber" in order) || !("grandTotal" in order)) return null;
  const orderRecord = order as Record<string, unknown>;
  const rawItems = orderRecord.items;
  const items = Array.isArray(rawItems)
    ? rawItems.map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        productId: typeof row.productId === "string" ? row.productId : undefined,
        name: typeof row.name === "string" ? row.name : "",
        quantity: Number(row.quantity) || 0,
        price: Number(row.price) || 0,
      };
    }).filter((item) => item.name && item.quantity > 0)
    : [];

  return {
    orderNumber: String(orderRecord.orderNumber),
    customerName: readString(order, "customer", "name") || "Walk-in customer",
    customerMobile: readString(order, "customer", "mobile"),
    customerAddress: readTimelineAddress(order),
    subtotal: readNumber(order, "subtotal"),
    discount: readNumber(order, "discount"),
    gst: readNumber(order, "gst"),
    grandTotal: readNumber(order, "grandTotal"),
    createdAt: String(orderRecord.createdAt ?? new Date().toISOString()),
    paymentSummary: readPaymentSummary(order),
    items,
  };
}

function readString(value: unknown, objectKey: string, key: string) {
  if (!value || typeof value !== "object") return "";
  const nested = (value as Record<string, unknown>)[objectKey];
  if (!nested || typeof nested !== "object") return "";
  const result = (nested as Record<string, unknown>)[key];
  return typeof result === "string" ? result : "";
}

function readNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0;
  return Number((value as Record<string, unknown>)[key]) || 0;
}

function readPaymentSummary(order: unknown) {
  if (!order || typeof order !== "object") return "Offline payment";
  const payments = (order as { payments?: unknown }).payments;
  if (!Array.isArray(payments) || !payments[0] || typeof payments[0] !== "object") return "Offline payment";
  const provider = String((payments[0] as Record<string, unknown>).provider ?? "Offline payment");
  return provider === "COD" ? "Cash collected" : provider.replaceAll("_", " ");
}

function readTimelineAddress(order: unknown) {
  if (!order || typeof order !== "object") return "";
  const timeline = (order as { timeline?: unknown }).timeline;
  if (!Array.isArray(timeline)) return "";
  const notes = timeline
    .map((event) => event && typeof event === "object" ? (event as Record<string, unknown>).note : "")
    .filter((note): note is string => typeof note === "string" && note.length > 0);
  const parts = notes.flatMap((note) => note.split("|").map((part) => part.trim()));
  return parts.find((part) => part.toLowerCase().startsWith("address:"))?.slice("Address:".length).trim() ?? "";
}

function printOfflineBill(order: CreatedOfflineOrder, onError: (message: string) => void) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) {
    onError("Popup blocked. Please allow popups to print the bill.");
    return;
  }
  writeOfflineBill(win, order);
}

function writeOfflineBill(win: Window, order: CreatedOfflineOrder) {
  const extraCharges = Math.max(order.grandTotal - order.subtotal + order.discount - order.gst, 0);
  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${formatRupees(item.price)}</td>
      <td class="num">${formatRupees(item.price * item.quantity)}</td>
    </tr>
  `).join("");
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${order.orderNumber} bill</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #111; }
          h1, h2, p { margin: 0; }
          .center { text-align: center; }
          .muted { color: #555; font-size: 12px; line-height: 1.45; }
          .rule { border-top: 1px dashed #999; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
          .num { text-align: right; }
          .total { font-weight: 800; font-size: 16px; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="center">
          <h1>${business.brandName}</h1>
          <p class="muted">${business.legalName}</p>
          <p class="muted">${business.address}</p>
          <p class="muted">GSTIN: ${business.gstin} | Phone: ${business.phone}</p>
        </div>
        <div class="rule"></div>
        <p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p>
        <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}${order.customerMobile ? ` (${escapeHtml(order.customerMobile)})` : ""}</p>
        ${order.customerAddress ? `<p><strong>Address:</strong> ${escapeHtml(order.customerAddress)}</p>` : ""}
        <p><strong>Date:</strong> ${formatIstDateTime(order.createdAt)}</p>
        <p><strong>Payment:</strong> ${escapeHtml(order.paymentSummary)}</p>
        <div class="rule"></div>
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="rule"></div>
        <table>
          <tr><td>Subtotal</td><td class="num">${formatRupees(order.subtotal)}</td></tr>
          <tr><td>Discount</td><td class="num">-${formatRupees(order.discount)}</td></tr>
          ${extraCharges > 0 ? `<tr><td>Extra charges</td><td class="num">${formatRupees(extraCharges)}</td></tr>` : ""}
          <tr><td>GST</td><td class="num">${formatRupees(order.gst)}</td></tr>
          <tr class="total"><td>Total payable</td><td class="num">${formatRupees(order.grandTotal)}</td></tr>
        </table>
        <div class="rule"></div>
        <p class="center"><strong>Thank you for ordering from ${business.brandName}.</strong></p>
        <p class="center muted">Fresh homely meals, made with care.</p>
        <button onclick="window.print()" style="margin-top:16px;width:100%;height:40px;font-weight:800">Print bill</button>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
