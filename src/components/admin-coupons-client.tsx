"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Edit3, ExternalLink, EyeOff, Plus, Send, Sparkles, Tag, TicketPercent, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch } from "@/lib/admin-client-auth";
import { formatRupees } from "@/lib/pricing";
import { formatIstDate, getIstDateInputValue, parseIstDateInput } from "@/lib/time";

type AdminCoupon = {
  code: string;
  label: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minOrder: number;
  maxDiscount?: number | null;
  audience?: "ALL" | "VIP" | "POINTS" | "TAGS";
  minPoints?: number;
  tagNames?: string[];
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
  audience: "ALL",
  minPoints: 0,
  tagNames: [],
  startsAt: getIstDateInputValue(),
  endsAt: getIstDateInputValue(new Date(), 30),
  active: true,
};

const couponPalettes = [
  { accent: "#009b63", ink: "#006b45", soft: "#eafff3", glow: "#c9f7dd", pill: "#c7ffe1", border: "#b7efcf", dash: "#9ce6bf" },
  { accent: "#b9320b", ink: "#8f2507", soft: "#fff4e7", glow: "#ffdfb8", pill: "#ffe0bf", border: "#ffd1aa", dash: "#ffc07f" },
  { accent: "#095fb9", ink: "#064b95", soft: "#eaf5ff", glow: "#c9e5ff", pill: "#d7ecff", border: "#bfddff", dash: "#9fcaff" },
  { accent: "#008f72", ink: "#006b55", soft: "#eafff9", glow: "#c8fff2", pill: "#cffff2", border: "#b7efe4", dash: "#94e4d5" },
  { accent: "#8d0021", ink: "#6f001a", soft: "#fff4f5", glow: "#ffd7df", pill: "#ffdbe2", border: "#efc8d1", dash: "#df9cad" },
  { accent: "#6242b7", ink: "#493088", soft: "#f3efff", glow: "#ded4ff", pill: "#e2d9ff", border: "#d1c4fb", dash: "#b7a8ef" },
  { accent: "#b7791f", ink: "#8a5415", soft: "#fff8df", glow: "#ffe7a3", pill: "#ffe9ad", border: "#f5d782", dash: "#e7bf4f" },
  { accent: "#0f766e", ink: "#115e59", soft: "#ecfeff", glow: "#bff7f1", pill: "#ccfbf1", border: "#99f6e4", dash: "#5eead4" },
];

export function AdminCouponsClient({
  initialCoupons,
  discountedProducts,
  initialCustomerTags,
}: {
  initialCoupons: AdminCoupon[];
  discountedProducts: number;
  initialCustomerTags: string[];
}) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [customerTags, setCustomerTags] = useState(() => Array.from(new Set(["VIP", ...initialCustomerTags])).sort((a, b) => a.localeCompare(b)));
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  async function refreshCoupons() {
    const response = await fetch("/api/coupons", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not reload coupons.");
    setCoupons(data.coupons.map((coupon: AdminCoupon) => ({
      ...coupon,
      startsAt: coupon.startsAt ? getIstDateInputValue(coupon.startsAt) : emptyCoupon.startsAt,
      endsAt: coupon.endsAt ? getIstDateInputValue(coupon.endsAt) : emptyCoupon.endsAt,
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
      const response = await adminFetch(adminAccess?.session, editing.code && coupons.some((coupon) => coupon.code === editing.code) ? `/api/coupons/${editing.code}` : "/api/coupons", {
        method: editing.code && coupons.some((coupon) => coupon.code === editing.code) ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          code: editing.code.toUpperCase(),
          maxDiscount: editing.maxDiscount ? Number(editing.maxDiscount) : null,
          minPoints: editing.audience === "POINTS" ? Math.max(1, Number(editing.minPoints ?? 1)) : 0,
          tagNames: editing.audience === "TAGS" ? normalizeTagNames(editing.tagNames ?? []) : [],
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
      const response = await adminFetch(adminAccess?.session, `/api/coupons/${code}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Coupon delete failed.");
      await refreshCoupons();
      setMessage("Coupon deleted.");
    });
  }

  function toggleCoupon(coupon: AdminCoupon) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/coupons/${coupon.code}`, {
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

  function notifyCoupon(coupon: AdminCoupon) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/coupons/${coupon.code}/notify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Coupon notification failed.");
      setMessage(`${coupon.code} notification queued for ${data.eligible} eligible customers. WhatsApp sent: ${data.sent}, failed/skipped: ${data.failed}.`);
    });
  }

  const activeCoupons = coupons.filter((coupon) => coupon.active).length;
  const liveCoupons = coupons.filter((coupon) => isCouponLive(coupon));
  const scheduledCoupons = coupons.filter((coupon) => coupon.active && isCouponScheduled(coupon)).length;

  function setCouponAudience(audience: AdminCoupon["audience"]) {
    if (!editing) return;
    setEditing({
      ...editing,
      audience,
      minPoints: audience === "POINTS" ? Math.max(1, Number(editing.minPoints ?? 0)) : 0,
      tagNames: audience === "TAGS" ? editing.tagNames ?? [] : [],
    });
  }

  function createCustomerTag() {
    const name = tagDraft.trim();
    if (!name) return;
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save customer tag.");
      setCustomerTags((current) => Array.from(new Set([...current, data.tag.name])).sort((a, b) => a.localeCompare(b)));
      setEditing((current) => current ? { ...current, tagNames: Array.from(new Set([...(current.tagNames ?? []), data.tag.name])) } : current);
      setTagDraft("");
      setMessage("Customer tag saved.");
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Promotions</p>
            <h1 className="text-3xl font-black text-maroon">Coupons</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Create, edit, activate, and preview coupon tickets shown on the customer Offers page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/offers" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 font-black text-maroon">
              <ExternalLink size={18} /> View offers
            </Link>
            <button onClick={() => setEditing({ ...emptyCoupon })} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> New coupon
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ["Live on Offers", String(liveCoupons.length), "Visible to customers now"],
            ["Active coupon codes", String(activeCoupons), `${scheduledCoupons} scheduled`],
            ["Discounted products", String(discountedProducts), "Offer label visible"],
          ].map(([label, value, detail]) => (
            <div key={label} className="surface rounded-2xl p-5">
              <TicketPercent className="text-red" />
              <p className="mt-4 text-sm font-bold text-muted">{label}</p>
              <p className="text-3xl font-black text-maroon">{value}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-[#f7f8fc]">
          <div className="flex flex-col gap-3 border-b border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <Sparkles className="text-red" size={20} /> Customer offer preview
              </h2>
            <p className="mt-1 text-sm font-semibold text-muted">Every active valid coupon below appears automatically on the Offers page with matching varied colors.</p>
            </div>
            <span className="rounded-lg bg-[#fff4f5] px-3 py-2 text-xs font-black text-red">{liveCoupons.length} live</span>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {liveCoupons.length ? liveCoupons.map((coupon) => (
              <AdminCouponPreview
                key={coupon.code}
                coupon={coupon}
                onCopy={() => navigator.clipboard.writeText(coupon.code)}
                onEdit={() => setEditing(coupon)}
              />
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center lg:col-span-2">
                <TicketPercent className="mx-auto text-muted" size={34} />
                <h3 className="mt-3 text-xl font-black text-maroon">No live offer cards</h3>
                <p className="mt-2 text-sm font-semibold text-muted">Create an active coupon with today inside its date range and it will show here and on /offers.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 surface overflow-hidden rounded-2xl">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-black text-maroon">Manage coupon campaigns</h2>
            <p className="text-sm font-semibold text-muted">Active coupons inside their date range are used by checkout and shown on the Offers page.</p>
          </div>
          <div className="border-b border-border bg-[#fff8f9] p-5">
            <h3 className="text-lg font-black text-maroon">WhatsApp coupon broadcast</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              Use Notify eligible for coupons targeted to all customers, VIP customers, customer tags, or order milestones like 10+ orders. The message includes the coupon code and each customer&apos;s order quantity history.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Code", "Label", "Discount", "Eligible customers", "Minimum", "Dates", "Status", "Actions"].map((head) => (
                    <th key={head} className="p-4">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <tr key={coupon.code} className="border-t border-border">
                      <td className="p-4"><span className="rounded-lg bg-maroon px-3 py-2 font-black text-white">{coupon.code}</span></td>
                      <td className="p-4 font-black">{coupon.label}</td>
                      <td className="p-4">{coupon.type === "FIXED" ? formatRupees(coupon.value) : `${coupon.value}%`}</td>
                      <td className="p-4"><EligibilityPill coupon={coupon} /></td>
                      <td className="p-4">{formatRupees(coupon.minOrder)}</td>
                      <td className="p-4 text-xs font-bold text-muted">{formatCouponDate(coupon.startsAt)} to {formatCouponDate(coupon.endsAt)}</td>
                      <td className="p-4">
                        <button
                          disabled={isPending}
                          onClick={() => toggleCoupon(coupon)}
                          className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${status.className}`}
                        >
                          {coupon.active ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                          {status.label}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button onClick={() => navigator.clipboard.writeText(coupon.code)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Copy ${coupon.code}`}><Copy size={16} /></button>
                          <button onClick={() => notifyCoupon(coupon)} disabled={isPending || !coupon.active} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon disabled:opacity-50" aria-label={`Notify eligible customers for ${coupon.code}`}><Send size={16} /></button>
                          <button onClick={() => setEditing(coupon)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Edit ${coupon.code}`}><Edit3 size={16} /></button>
                          <button onClick={() => deleteCoupon(coupon.code)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Delete ${coupon.code}`}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-maroon">{coupons.some((coupon) => coupon.code === editing.code) ? "Edit coupon" : "New coupon"}</h2>
                <p className="text-sm font-semibold text-muted">Saved active coupons appear automatically on the Offers page.</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg bg-[#fff4f5] px-3 py-2 text-sm font-black text-maroon">
                <input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
                Active
              </label>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Code" value={editing.code} onChange={(value) => setEditing({ ...editing, code: value.toUpperCase().replace(/\s/g, "") })} />
                <Field label="Label" value={editing.label} onChange={(value) => setEditing({ ...editing, label: value })} />
                <label className="grid gap-2 text-sm font-black text-charcoal">
                  Type
                  <select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as AdminCoupon["type"] })} className="h-11 rounded-lg border border-border bg-cream px-3">
                    <option value="FIXED">Fixed amount</option>
                    <option value="PERCENT">Percentage</option>
                  </select>
                </label>
                <Field label={editing.type === "FIXED" ? "Amount off" : "Percent off"} value={String(editing.value)} onChange={(value) => setEditing({ ...editing, value: Number(value) })} />
                <Field label="Minimum order" value={String(editing.minOrder)} onChange={(value) => setEditing({ ...editing, minOrder: Number(value) })} />
                <Field label="Max discount" value={editing.maxDiscount ? String(editing.maxDiscount) : ""} onChange={(value) => setEditing({ ...editing, maxDiscount: value ? Number(value) : null })} />
                <label className="grid gap-2 text-sm font-black text-charcoal">
                  Eligible customers
                  <select value={editing.audience ?? "ALL"} onChange={(event) => setCouponAudience(event.target.value as AdminCoupon["audience"])} className="h-11 rounded-lg border border-border bg-cream px-3">
                    <option value="ALL">All customers</option>
                    <option value="VIP">VIP customers only</option>
                    <option value="POINTS">Order count based</option>
                    <option value="TAGS">Tag based</option>
                  </select>
                </label>
                {editing.audience === "POINTS" ? (
                  <Field
                    label="Customer order count"
                    type="number"
                    value={String(Math.max(1, Number(editing.minPoints ?? 1)))}
                    onChange={(value) => setEditing({ ...editing, minPoints: Math.max(1, Number(value) || 1) })}
                  />
                ) : null}
                {editing.audience === "TAGS" ? (
                  <div className="grid gap-2 rounded-xl border border-border bg-cream p-3 sm:col-span-2">
                    <p className="flex items-center gap-2 text-sm font-black text-maroon"><Tag size={16} /> Eligible customer tags</p>
                    <div className="flex flex-wrap gap-2">
                      {customerTags.map((tagName) => (
                        <button
                          key={tagName}
                          type="button"
                          onClick={() => setEditing({ ...editing, tagNames: toggleName(editing.tagNames ?? [], tagName) })}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black ${editing.tagNames?.includes(tagName) ? "bg-maroon text-white" : "border border-border bg-white text-maroon"}`}
                        >
                          <Tag size={14} /> {tagName}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal" placeholder="Create customer tag" />
                      <button type="button" disabled={isPending || !tagDraft.trim()} onClick={createCustomerTag} className="h-10 rounded-lg border border-border bg-white px-4 text-sm font-black text-maroon disabled:opacity-60">
                        Add tag
                      </button>
                    </div>
                  </div>
                ) : null}
                <Field label="Start date" type="date" value={editing.startsAt} onChange={(value) => setEditing({ ...editing, startsAt: value })} />
                <Field label="End date" type="date" value={editing.endsAt} onChange={(value) => setEditing({ ...editing, endsAt: value })} />
              </div>

              <div className="rounded-2xl bg-[#f7f8fc] p-4">
                <p className="mb-3 text-sm font-black text-maroon">Live preview</p>
                <AdminCouponPreview
                  coupon={{ ...editing, code: editing.code || "WAHDEAL", label: editing.label || "Special Wah Thali offer" }}
                  onCopy={() => undefined}
                  onEdit={() => undefined}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-10 rounded-lg border border-border px-4 font-black">Cancel</button>
              <button disabled={isPending || !canSaveCoupon(editing)} onClick={saveCoupon} className="h-10 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">Save coupon</button>
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

function canSaveCoupon(coupon: AdminCoupon) {
  if (!coupon.code.trim() || !coupon.label.trim()) return false;
  if (coupon.audience === "TAGS" && !normalizeTagNames(coupon.tagNames ?? []).length) return false;
  return true;
}

function AdminCouponPreview({
  coupon,
  onCopy,
  onEdit,
}: {
  coupon: AdminCoupon;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const palette = getCouponPalette(coupon.code);

  return (
    <article
      className="relative grid min-h-[158px] grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(17,24,39,0.06)] ring-1"
      style={{ borderColor: palette.border, boxShadow: `0 16px 30px ${palette.glow}44` }}
    >
      <span className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full blur-2xl" style={{ backgroundColor: palette.glow }} />
      <div className="relative grid place-items-center px-3 text-center" style={{ background: `linear-gradient(135deg, ${palette.soft} 0%, ${palette.glow} 62%, #ffffff 100%)` }}>
        <div>
          <p className="text-[28px] font-black leading-none" style={{ color: palette.ink }}>{getCouponHero(coupon)}</p>
          <p className="mt-1.5 text-[12px] font-black uppercase leading-none" style={{ color: palette.ink }}>OFF</p>
        </div>
        <span className="absolute right-0 top-4 h-[calc(100%-32px)] border-r-2 border-dashed" style={{ borderColor: palette.dash }} />
        <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#f7f8fc]" />
      </div>

      <div className="relative min-w-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: palette.pill, color: palette.ink }}>
            {coupon.code || "CODE"}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onCopy} className="grid h-9 w-9 place-items-center rounded-lg border bg-white" style={{ borderColor: palette.border, color: palette.ink }} aria-label={`Copy ${coupon.code}`}>
              <Copy size={15} />
            </button>
            <button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-lg border bg-white" style={{ borderColor: palette.border, color: palette.ink }} aria-label={`Edit ${coupon.code}`}>
              <Edit3 size={15} />
            </button>
          </div>
        </div>

        <h3 className="mt-4 line-clamp-1 text-[17px] font-black leading-tight text-charcoal">{coupon.label || "Coupon label"}</h3>
        <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-charcoal/85">{getCouponDescription(coupon)}</p>
        <div className="mt-3"><EligibilityPill coupon={coupon} /></div>
        <div className="mt-3 grid gap-1 border-t border-[#eef1f6] pt-3 text-[11px] font-bold leading-4 text-muted sm:grid-cols-2">
          <span>{coupon.minOrder > 0 ? `Min. Order: ${formatRupees(coupon.minOrder)}` : "No minimum order"}</span>
          <span>Expires: {formatCouponDate(coupon.endsAt)}</span>
          {coupon.maxDiscount ? <span className="sm:col-span-2">Max. Discount: {formatRupees(coupon.maxDiscount)}</span> : null}
        </div>
      </div>
    </article>
  );
}

function EligibilityPill({ coupon }: { coupon: Pick<AdminCoupon, "audience" | "minPoints" | "tagNames"> }) {
  const audience = coupon.audience ?? "ALL";
  const label = audience === "VIP"
    ? "VIP only"
    : audience === "POINTS"
      ? `${getMinimumOrderCount(coupon)}+ orders`
      : audience === "TAGS"
        ? `${formatTagList(coupon.tagNames)} only`
      : "All customers";

  return <span className="inline-flex rounded-lg bg-[#fff4f5] px-3 py-2 text-xs font-black text-maroon">{label}</span>;
}

function getMinimumOrderCount(coupon: Pick<AdminCoupon, "minPoints">) {
  return Math.max(1, Number(coupon.minPoints ?? 1));
}

function formatTagList(tagNames: string[] | undefined) {
  return tagNames?.length ? tagNames.join(", ") : "Selected tags";
}

function toggleName(values: string[], name: string) {
  return values.includes(name) ? values.filter((value) => value !== name) : [...values, name];
}

function normalizeTagNames(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

function getCouponPalette(code: string) {
  const hash = [...code].reduce((total, character) => total + character.charCodeAt(0), 0);
  return couponPalettes[hash % couponPalettes.length];
}

function getCouponHero(coupon: Pick<AdminCoupon, "type" | "value">) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return `${coupon.value}%`;
}

function getCouponDescription(coupon: Pick<AdminCoupon, "type" | "value" | "minOrder" | "maxDiscount">) {
  if (coupon.type === "FIXED") {
    return `Use above ${formatRupees(coupon.minOrder)} and save ${formatRupees(coupon.value)}.`;
  }

  return coupon.maxDiscount
    ? `Get ${coupon.value}% OFF up to ${formatRupees(coupon.maxDiscount)}.`
    : `Get ${coupon.value}% OFF on eligible orders.`;
}

function formatCouponDate(value: string) {
  return formatIstDate(parseIstDateInput(value, "start") ?? value);
}

function getCouponStatus(coupon: AdminCoupon) {
  if (!coupon.active) {
    return {
      label: "Off",
      className: "border border-border bg-white text-maroon",
    };
  }

  if (isCouponScheduled(coupon)) {
    return {
      label: "Scheduled",
      className: "bg-[#eaf5ff] text-[#064b95]",
    };
  }

  if (isCouponExpired(coupon)) {
    return {
      label: "Expired",
      className: "bg-[#f3f4f6] text-muted",
    };
  }

  return {
    label: "Live",
    className: "bg-maroon text-white",
  };
}

function getCouponBounds(coupon: Pick<AdminCoupon, "startsAt" | "endsAt">) {
  return {
    start: parseIstDateInput(coupon.startsAt, "start") ?? new Date(coupon.startsAt),
    end: parseIstDateInput(coupon.endsAt, "end") ?? new Date(coupon.endsAt),
  };
}

function isCouponLive(coupon: AdminCoupon) {
  if (!coupon.active) return false;
  const now = new Date();
  const bounds = getCouponBounds(coupon);
  return bounds.start <= now && bounds.end >= now;
}

function isCouponScheduled(coupon: AdminCoupon) {
  const bounds = getCouponBounds(coupon);
  return bounds.start > new Date();
}

function isCouponExpired(coupon: AdminCoupon) {
  const bounds = getCouponBounds(coupon);
  return bounds.end < new Date();
}
