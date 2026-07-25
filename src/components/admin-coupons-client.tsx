"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Edit3, EyeOff, Plus, TicketPercent, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatRupees } from "@/lib/pricing";

type AdminCoupon = {
  code: string;
  label: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minOrder: number;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const emptyCoupon: AdminCoupon = {
  code: "",
  label: "",
  type: "FIXED",
  value: 50,
  minOrder: 149,
  maxDiscount: null,
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
  active: true,
};

export function AdminCouponsClient({ initialCoupons, discountedProducts }: { initialCoupons: AdminCoupon[]; discountedProducts: number }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshCoupons() {
    const response = await fetch("/api/coupons", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not reload coupons.");
    setCoupons(data.coupons.map((coupon: AdminCoupon) => ({
      ...coupon,
      startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 10) : emptyCoupon.startsAt,
      endsAt: coupon.endsAt ? new Date(coupon.endsAt).toISOString().slice(0, 10) : emptyCoupon.endsAt,
    })));
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

  function saveCoupon() {
    if (!editing) return;
    run(async () => {
      const response = await fetch(editing.code && coupons.some((coupon) => coupon.code === editing.code) ? `/api/coupons/${editing.code}` : "/api/coupons", {
        method: editing.code && coupons.some((coupon) => coupon.code === editing.code) ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          code: editing.code.toUpperCase(),
          maxDiscount: editing.maxDiscount ? Number(editing.maxDiscount) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Coupon save failed.");
      await refreshCoupons();
      setEditing(null);
      setMessage("Coupon saved live.");
    });
  }

  function deleteCoupon(code: string) {
    run(async () => {
      const response = await fetch(`/api/coupons/${code}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Coupon delete failed.");
      await refreshCoupons();
      setMessage("Coupon deleted.");
    });
  }

  function toggleCoupon(coupon: AdminCoupon) {
    run(async () => {
      const response = await fetch(`/api/coupons/${coupon.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !coupon.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Coupon status update failed.");
      await refreshCoupons();
      setMessage(`${coupon.code} is now ${coupon.active ? "off" : "active"}.`);
    });
  }

  const activeCoupons = coupons.filter((coupon) => coupon.active).length;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Promotions</p>
            <h1 className="text-3xl font-black text-maroon">Coupons and sliders</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Live coupon CRUD. Homepage slider is managed from Settings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button onClick={() => setEditing(emptyCoupon)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> New coupon
            </button>
          </div>
        </div>

        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ["Active coupon codes", String(activeCoupons), "Live checkout discounts"],
            ["Discounted products", String(discountedProducts), "Offer label visible"],
            ["Total coupons", String(coupons.length), "All saved codes"],
          ].map(([label, value, detail]) => (
            <div key={label} className="surface rounded-2xl p-5">
              <TicketPercent className="text-red" />
              <p className="mt-4 text-sm font-bold text-muted">{label}</p>
              <p className="text-3xl font-black text-maroon">{value}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 surface overflow-hidden rounded-2xl">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-black text-maroon">Coupon campaigns</h2>
            <p className="text-sm font-semibold text-muted">Only these saved coupons will be used by checkout.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Code", "Label", "Discount", "Minimum", "Dates", "Status", "Actions"].map((head) => (
                    <th key={head} className="p-4">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.code} className="border-t border-border">
                    <td className="p-4"><span className="rounded-lg bg-maroon px-3 py-2 font-black text-white">{coupon.code}</span></td>
                    <td className="p-4 font-black">{coupon.label}</td>
                    <td className="p-4">{coupon.type === "FIXED" ? formatRupees(coupon.value) : `${coupon.value}%`}</td>
                    <td className="p-4">{formatRupees(coupon.minOrder)}</td>
                    <td className="p-4 text-xs font-bold text-muted">{coupon.startsAt} to {coupon.endsAt}</td>
                    <td className="p-4">
                      <button
                        disabled={isPending}
                        onClick={() => toggleCoupon(coupon)}
                        className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${
                          coupon.active ? "bg-maroon text-white" : "border border-border bg-white text-maroon"
                        }`}
                      >
                        {coupon.active ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                        {coupon.active ? "Active" : "Off"}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button onClick={() => navigator.clipboard.writeText(coupon.code)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Copy ${coupon.code}`}><Copy size={16} /></button>
                        <button onClick={() => setEditing(coupon)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Edit ${coupon.code}`}><Edit3 size={16} /></button>
                        <button onClick={() => deleteCoupon(coupon.code)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Delete ${coupon.code}`}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black text-maroon">{coupons.some((coupon) => coupon.code === editing.code) ? "Edit coupon" : "New coupon"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Code" value={editing.code} onChange={(value) => setEditing({ ...editing, code: value.toUpperCase() })} />
              <Field label="Label" value={editing.label} onChange={(value) => setEditing({ ...editing, label: value })} />
              <label className="grid gap-2 text-sm font-black text-charcoal">
                Type
                <select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as AdminCoupon["type"] })} className="h-11 rounded-lg border border-border bg-cream px-3">
                  <option value="FIXED">Fixed</option>
                  <option value="PERCENT">Percent</option>
                </select>
              </label>
              <Field label="Value" value={String(editing.value)} onChange={(value) => setEditing({ ...editing, value: Number(value) })} />
              <Field label="Minimum order" value={String(editing.minOrder)} onChange={(value) => setEditing({ ...editing, minOrder: Number(value) })} />
              <Field label="Max discount" value={editing.maxDiscount ? String(editing.maxDiscount) : ""} onChange={(value) => setEditing({ ...editing, maxDiscount: value ? Number(value) : null })} />
              <Field label="Start date" type="date" value={editing.startsAt} onChange={(value) => setEditing({ ...editing, startsAt: value })} />
              <Field label="End date" type="date" value={editing.endsAt} onChange={(value) => setEditing({ ...editing, endsAt: value })} />
              <label className="flex items-center gap-2 text-sm font-black text-charcoal">
                <input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-10 rounded-lg border border-border px-4 font-black">Cancel</button>
              <button disabled={isPending || !editing.code || !editing.label} onClick={saveCoupon} className="h-10 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">Save coupon</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-black text-charcoal">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3" />
    </label>
  );
}
