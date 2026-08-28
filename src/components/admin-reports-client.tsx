"use client";

import { BarChart3, CalendarDays, Download, FileText, IndianRupee, ReceiptText, Search, TicketPercent, TrendingDown, TrendingUp, Users, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { formatRupees } from "@/lib/pricing";
import { formatIstDateTime } from "@/lib/time";
import type { AdminReportsSnapshot, ReportMetric, ReportPeriod, ReportRow } from "@/lib/admin-reports";

const periodLabels: Record<ReportPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Date range",
};

const reportKinds = [
  { key: "full", label: "Full report", icon: FileText },
  { key: "sales", label: "Sales PDF", icon: IndianRupee },
  { key: "orders", label: "Orders PDF", icon: ReceiptText },
  { key: "customers", label: "Customer PDF", icon: Users },
  { key: "coupons", label: "Coupon PDF", icon: TicketPercent },
  { key: "items", label: "Items PDF", icon: Utensils },
  { key: "best", label: "Best items PDF", icon: TrendingUp },
  { key: "worst", label: "Worst items PDF", icon: TrendingDown },
] as const;

type ReportKind = (typeof reportKinds)[number]["key"];

export function AdminReportsClient({ snapshot }: { snapshot: AdminReportsSnapshot }) {
  const router = useRouter();
  const pathname = usePathname();
  const snapshotKey = `${snapshot.period}:${snapshot.date}:${snapshot.fromDate}:${snapshot.toDate}:${snapshot.searchQuery}`;
  const [rangeDraft, setRangeDraft] = useState({ key: snapshotKey, from: snapshot.fromDate, to: snapshot.toDate });
  const activeRangeDraft = rangeDraft.key === snapshotKey ? rangeDraft : { key: snapshotKey, from: snapshot.fromDate, to: snapshot.toDate };
  const [searchDraft, setSearchDraft] = useState({ key: snapshotKey, value: snapshot.searchQuery });
  const activeSearchDraft = searchDraft.key === snapshotKey ? searchDraft : { key: snapshotKey, value: snapshot.searchQuery };

  const pdfSections = useMemo(() => buildPdfSections(snapshot), [snapshot]);

  function pushReport(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function getReportParams(input: { period?: ReportPeriod; date?: string; from?: string; to?: string; q?: string }) {
    const period = input.period ?? snapshot.period;
    const params = new URLSearchParams({
      period,
      date: input.date ?? snapshot.date,
    });
    if (period === "custom") {
      params.set("from", input.from ?? activeRangeDraft.from);
      params.set("to", input.to ?? activeRangeDraft.to);
    }
    const q = input.q ?? activeSearchDraft.value;
    if (q.trim()) params.set("q", q.trim());
    return params;
  }

  function updateReport(nextPeriod = snapshot.period, nextDate = snapshot.date) {
    if (nextPeriod === "custom") {
      applyDateRange(activeRangeDraft.from, activeRangeDraft.to);
      return;
    }

    pushReport(getReportParams({ period: nextPeriod, date: nextDate }));
  }

  function applyDateRange(nextFrom = activeRangeDraft.from, nextTo = activeRangeDraft.to) {
    if (!isValidDateInput(nextFrom) || !isValidDateInput(nextTo)) return;
    const from = nextFrom <= nextTo ? nextFrom : nextTo;
    const to = nextFrom <= nextTo ? nextTo : nextFrom;
    setRangeDraft({ key: `custom:${from}:${from}:${to}`, from, to });
    pushReport(getReportParams({ period: "custom", date: from, from, to }));
  }

  function applySearch() {
    pushReport(getReportParams({ q: activeSearchDraft.value }));
  }

  function download(kind: ReportKind) {
    const selectedSections = kind === "full" ? pdfSections : pdfSections.filter((section) => section.kind === kind);
    const filenameDate = snapshot.period === "custom" ? `${snapshot.fromDate}-to-${snapshot.toDate}` : snapshot.date;
    downloadPdf({
      title: `Wah Thali ${reportKinds.find((item) => item.key === kind)?.label.replace(" PDF", "") ?? "Report"}`,
      subtitle: `${periodLabels[snapshot.period]} report - ${snapshot.rangeLabel} - Generated ${formatIstDateTime(snapshot.generatedAt)}`,
      sections: selectedSections,
      filename: `wah-thali-${kind}-${snapshot.period}-${filenameDate}.pdf`,
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Reports</p>
            <h1 className="text-3xl font-black text-maroon">Business reports</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Sales, orders, customers, items, best performers, and slow movers.</p>
          </div>
          <button
            type="button"
            onClick={() => download("full")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white"
          >
            <Download size={18} /> Download full PDF
          </button>
        </div>
        <AdminSectionNav />

        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
          <div className="surface rounded-2xl p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_minmax(300px,380px)]">
              <div>
                <p className="text-sm font-black text-maroon">Report period</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(periodLabels) as ReportPeriod[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => updateReport(item, snapshot.date)}
                      className={`h-10 rounded-lg px-4 text-sm font-black ${snapshot.period === item ? "bg-maroon text-white" : "border border-border bg-cream text-charcoal"}`}
                    >
                      {periodLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="grid gap-2 text-sm font-black text-maroon">
                Date
                <input
                  type="date"
                  value={snapshot.date}
                  onChange={(event) => updateReport(snapshot.period === "custom" ? "daily" : snapshot.period, event.target.value)}
                  className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                />
              </label>
              <div className="grid gap-2">
                <p className="text-sm font-black text-maroon">Date range</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="date"
                    value={activeRangeDraft.from}
                    onChange={(event) => setRangeDraft({ ...activeRangeDraft, from: event.target.value })}
                    className="h-10 min-w-0 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                    aria-label="Report from date"
                  />
                  <input
                    type="date"
                    value={activeRangeDraft.to}
                    onChange={(event) => setRangeDraft({ ...activeRangeDraft, to: event.target.value })}
                    className="h-10 min-w-0 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal"
                    aria-label="Report to date"
                  />
                  <button
                    type="button"
                    onClick={() => applyDateRange()}
                    disabled={!isValidDateInput(activeRangeDraft.from) || !isValidDateInput(activeRangeDraft.to)}
                    className="h-10 rounded-lg bg-maroon px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
            <form
              className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                applySearch();
              }}
            >
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-cream px-3 text-sm font-black text-maroon">
                <Search size={17} className="shrink-0 text-muted" />
                <input
                  value={activeSearchDraft.value}
                  onChange={(event) => setSearchDraft({ key: snapshotKey, value: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-charcoal"
                  placeholder="Search report by shortcut code, display name, or dish name"
                />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="h-11 rounded-lg bg-maroon px-4 text-sm font-black text-white">Search</button>
                {snapshot.searchQuery ? (
                  <button type="button" onClick={() => pushReport(getReportParams({ q: "" }))} className="h-11 rounded-lg border border-border px-4 text-sm font-black text-maroon">
                    Clear
                  </button>
                ) : null}
              </div>
            </form>
          </div>
          <div className="surface rounded-2xl p-4 xl:min-w-[250px]">
            <p className="flex items-center gap-2 text-sm font-black text-maroon">
              <CalendarDays size={16} /> {snapshot.rangeLabel}
            </p>
            <p className="mt-1 text-xs font-bold text-muted">Generated {formatIstDateTime(snapshot.generatedAt)}</p>
            {snapshot.searchQuery ? <p className="mt-2 text-xs font-black text-maroon">Filtered by {snapshot.searchQuery}</p> : null}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.metrics.map((metric, index) => (
            <MetricCard key={metric.label} metric={metric} iconIndex={index} />
          ))}
        </section>

        {snapshot.dishSearch.active ? <DishSearchReportSection snapshot={snapshot} /> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-maroon">Sales report</h2>
                <p className="text-sm font-semibold text-muted">{periodLabels[snapshot.period]} view for {snapshot.rangeLabel}</p>
              </div>
              <div className="flex gap-2">
                <ReportButton kind="sales" onClick={download} />
                <ReportButton kind="orders" onClick={download} />
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Subtotal", snapshot.sales.subtotal],
                ["Discount", snapshot.sales.discount],
                ["GST", snapshot.sales.gst],
                ["Gross sales", snapshot.sales.grossSales],
                ["Net revenue", snapshot.sales.netRevenue],
                ["Average order", snapshot.sales.averageOrderValue],
                ["COD sales", snapshot.sales.codSales],
                ["Online sales", snapshot.sales.onlineSales],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border bg-cream p-4">
                  <p className="text-xs font-black uppercase text-muted">{String(label)}</p>
                  <p className="mt-2 text-xl font-black text-maroon">{formatRupees(Number(value))}</p>
                </div>
              ))}
            </div>
            <TimelineTable rows={snapshot.timeline} />
          </div>

          <aside className="surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="text-xl font-black text-maroon">Order report</h2>
                <p className="text-sm font-semibold text-muted">{snapshot.orders.total} orders</p>
              </div>
              <ReceiptText className="text-red" size={24} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              {[
                ["Active", snapshot.orders.active],
                ["Delivered", snapshot.orders.delivered],
                ["Cancelled", snapshot.orders.cancelled],
                ["Items", snapshot.items.totalItemsSold],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-cream p-3">
                  <p className="text-xs font-bold text-muted">{String(label)}</p>
                  <p className="text-2xl font-black text-maroon">{String(value)}</p>
                </div>
              ))}
            </div>
            <CompactRows rows={snapshot.orders.statusRows} />
          </aside>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ReportPanel title="Customer report" detail={`${snapshot.customers.orderingCustomers} buying customers`} kind="customers" onDownload={download}>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {[
                ["Total customers", snapshot.customers.totalCustomers],
                ["New customers", snapshot.customers.newCustomers],
                ["Repeat customers", snapshot.customers.repeatCustomers],
                ["Avg customer spend", formatRupees(snapshot.customers.averageSpend)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border bg-cream p-4">
                  <p className="text-xs font-bold text-muted">{String(label)}</p>
                  <p className="mt-1 text-xl font-black text-maroon">{String(value)}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Customer", "Mobile", "Orders", "Spend", "Last order"].map((head) => <th key={head} className="p-3">{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.customers.topCustomers.map((customer) => (
                    <tr key={`${customer.mobile}-${customer.name}`} className="border-t border-border">
                      <td className="p-3 font-black">{customer.name}</td>
                      <td className="p-3 text-muted">{customer.mobile}</td>
                      <td className="p-3 font-black">{customer.orders}</td>
                      <td className="p-3 font-black text-maroon">{formatRupees(customer.spend)}</td>
                      <td className="p-3 text-muted">{customer.lastOrder ? formatIstDateTime(customer.lastOrder) : "-"}</td>
                    </tr>
                  ))}
                  {!snapshot.customers.topCustomers.length ? <EmptyTableRow colSpan={5} label="No customer orders in this period." /> : null}
                </tbody>
              </table>
            </div>
          </ReportPanel>

          <ReportPanel title="Items report" detail={`${snapshot.items.uniqueItemsSold} unique sold`} kind="items" onDownload={download}>
            <ItemsTable rows={snapshot.items.rows.slice(0, 12)} emptyLabel="No item sales in this period." />
          </ReportPanel>
        </section>

        <section className="mt-6 surface overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <TicketPercent className="text-red" size={22} /> Coupon report
              </h2>
              <p className="text-sm font-semibold text-muted">Successful transactions only: popularity, coupon sales, members, and discount offered.</p>
            </div>
            <ReportButton kind="coupons" onClick={download} />
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Coupon sales", formatRupees(snapshot.coupons.couponSales)],
              ["Discount offered", formatRupees(snapshot.coupons.discountOffered)],
              ["Redemptions", snapshot.coupons.totalRedemptions],
              ["Members used", snapshot.coupons.uniqueMembers],
              ["Popular coupon", snapshot.coupons.popularCoupon?.code ?? "-"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-cream p-4">
                <p className="text-xs font-bold text-muted">{String(label)}</p>
                <p className="mt-1 text-xl font-black text-maroon">{String(value)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Coupon", "Offer", "Used", "Members", "Sales", "Discount", "Avg order", "Delivery", "Takeaway", "Website"].map((head) => <th key={head} className="p-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {snapshot.coupons.rows.map((coupon) => (
                  <tr key={coupon.code} className="border-t border-border">
                    <td className="p-3 font-black text-maroon">{coupon.code}</td>
                    <td className="p-3 font-bold">{coupon.label}</td>
                    <td className="p-3 font-black">{coupon.redemptions}</td>
                    <td className="p-3 font-black">{coupon.members}</td>
                    <td className="p-3 font-black">{formatRupees(coupon.sales)}</td>
                    <td className="p-3 text-red">{formatRupees(coupon.discount)}</td>
                    <td className="p-3">{formatRupees(coupon.averageOrderValue)}</td>
                    <td className="p-3">{coupon.delivery}</td>
                    <td className="p-3">{coupon.takeaway}</td>
                    <td className="p-3">{coupon.website}</td>
                  </tr>
                ))}
                {!snapshot.coupons.rows.length ? <EmptyTableRow colSpan={10} label="No successful coupon redemptions in this period." /> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ReportPanel title="Best performing items" detail="Sorted by net sales" kind="best" onDownload={download}>
            <ItemsTable rows={snapshot.items.best} emptyLabel="No best items yet." />
          </ReportPanel>
          <ReportPanel title="Worst performing items" detail="Lowest quantity first" kind="worst" onDownload={download}>
            <ItemsTable rows={snapshot.items.worst} emptyLabel="No item data yet." />
          </ReportPanel>
        </section>

        <section className="mt-6 surface overflow-hidden rounded-2xl">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-black text-maroon">Recent orders in report</h2>
            <p className="text-sm font-semibold text-muted">Latest orders inside the selected period.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Order", "Customer", "Status", "Items", "Amount", "Created"].map((head) => <th key={head} className="p-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {snapshot.orders.recent.map((order) => (
                  <tr key={order.orderNumber} className="border-t border-border">
                    <td className="p-3 font-black text-maroon">{order.orderNumber}</td>
                    <td className="p-3 font-black">{order.customerName}</td>
                    <td className="p-3 text-muted">{order.status}</td>
                    <td className="p-3">
                      <p className="font-black">{order.items}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">{order.itemSummary}</p>
                    </td>
                    <td className="p-3 font-black">{formatRupees(order.amount)}</td>
                    <td className="p-3 text-muted">{formatIstDateTime(order.createdAt)}</td>
                  </tr>
                ))}
                {!snapshot.orders.recent.length ? <EmptyTableRow colSpan={6} label="No orders in this period." /> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 surface rounded-2xl p-5">
          <h2 className="text-xl font-black text-maroon">PDF downloads</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {reportKinds.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => download(key)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-cream px-3 text-sm font-black text-maroon"
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function DishSearchReportSection({ snapshot }: { snapshot: AdminReportsSnapshot }) {
  const report = snapshot.dishSearch;
  const bestCustomer = report.customerFavourites[0];

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#f0d7dd] bg-[#fff8f9] shadow-[0_14px_34px_rgba(34,31,32,0.05)]">
      <div className="flex flex-col gap-3 border-b border-[#f0d7dd] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red">Dish search CRM</p>
          <h2 className="mt-1 text-2xl font-black text-maroon">Report for &quot;{report.query}&quot;</h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            Dish-level sales, total orders, repeat customers, and ordering favourites for {snapshot.rangeLabel}.
          </p>
        </div>
        <div className="grid min-w-[220px] gap-1 rounded-xl border border-[#f0d7dd] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase text-muted">Best CRM lead</p>
          <p className="text-sm font-black text-charcoal">{bestCustomer ? bestCustomer.name : "No customer yet"}</p>
          <p className="text-xs font-bold text-muted">{bestCustomer ? `${bestCustomer.orders} orders / ${formatRupees(bestCustomer.spend)}` : "No matching dish orders in this period"}</p>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Matched dishes", report.matchedDishes],
          ["Total dish orders", report.orders],
          ["Items sold", report.quantity],
          ["Item sales", formatRupees(report.itemSales)],
          ["Customers", report.customers],
          ["Repeat customers", report.repeatCustomers],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[#f0d7dd] bg-white p-4">
            <p className="text-xs font-bold text-muted">{String(label)}</p>
            <p className="mt-1 text-xl font-black text-maroon">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 p-5 pt-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
        <div className="overflow-hidden rounded-xl border border-[#f0d7dd] bg-white">
          <div className="border-b border-[#f0d7dd] px-4 py-3">
            <h3 className="text-base font-black text-maroon">Matched dishes</h3>
            <p className="text-xs font-bold text-muted">Only dishes matching the search name, display name, kitchen name, or shortcut code.</p>
          </div>
          <ItemsTable rows={report.topDishes} emptyLabel="No matching dish sales in this period." />
        </div>

        <div className="overflow-hidden rounded-xl border border-[#f0d7dd] bg-white">
          <div className="border-b border-[#f0d7dd] px-4 py-3">
            <h3 className="text-base font-black text-maroon">Customer favourites list</h3>
            <p className="text-xs font-bold text-muted">Customers ranked by repeat orders of the searched dish. Wishlist saves are stored on customer devices, so this uses ordering behaviour.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Customer", "Mobile", "Orders", "Qty", "Item sales", "Favourite dish", "Last order"].map((head) => <th key={head} className="p-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.customerFavourites.map((customer) => (
                  <tr key={`${customer.mobile}-${customer.name}`} className="border-t border-border">
                    <td className="p-3 font-black">{customer.name}</td>
                    <td className="p-3 text-muted">{customer.mobile}</td>
                    <td className="p-3 font-black">{customer.orders}</td>
                    <td className="p-3 font-black">{customer.quantity}</td>
                    <td className="p-3 font-black text-maroon">{formatRupees(customer.spend)}</td>
                    <td className="p-3 text-muted">{customer.favouriteItem || "-"}</td>
                    <td className="p-3 text-muted">{customer.lastOrder ? formatIstDateTime(customer.lastOrder) : "-"}</td>
                  </tr>
                ))}
                {!report.customerFavourites.length ? <EmptyTableRow colSpan={7} label="No customers ordered this searched dish in the selected period." /> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="overflow-hidden rounded-xl border border-[#f0d7dd] bg-white">
          <div className="border-b border-[#f0d7dd] px-4 py-3">
            <h3 className="text-base font-black text-maroon">Recent searched-dish orders</h3>
            <p className="text-xs font-bold text-muted">{report.delivered} delivered, {report.activeOrders} active, {report.cancelled} cancelled.</p>
          </div>
          <OrdersTable rows={report.recentOrders} emptyLabel="No recent orders for this searched dish." />
        </div>
      </div>
    </section>
  );
}

function MetricCard({ metric, iconIndex }: { metric: ReportMetric; iconIndex: number }) {
  const icons = [IndianRupee, BarChart3, ReceiptText, Users, Utensils, CalendarDays];
  const Icon = icons[iconIndex] ?? BarChart3;
  return (
    <div className="surface rounded-2xl p-5">
      <Icon className="text-red" size={24} />
      <p className="mt-4 text-sm font-bold text-muted">{metric.label}</p>
      <p className="text-2xl font-black text-maroon">{metric.value}</p>
      <p className="mt-1 text-xs font-bold text-muted">{metric.detail}</p>
    </div>
  );
}

function ReportPanel({
  title,
  detail,
  kind,
  onDownload,
  children,
}: {
  title: string;
  detail: string;
  kind: ReportKind;
  onDownload: (kind: ReportKind) => void;
  children: ReactNode;
}) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-xl font-black text-maroon">{title}</h2>
          <p className="text-sm font-semibold text-muted">{detail}</p>
        </div>
        <ReportButton kind={kind} onClick={onDownload} />
      </div>
      {children}
    </section>
  );
}

function ReportButton({ kind, onClick }: { kind: ReportKind; onClick: (kind: ReportKind) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(kind)}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon"
    >
      <Download size={16} /> PDF
    </button>
  );
}

function TimelineTable({ rows }: { rows: { label: string; orders: number; sales: number }[] }) {
  const maxSales = Math.max(...rows.map((row) => row.sales), 1);
  return (
    <div className="border-t border-border p-5">
      <h3 className="text-sm font-black text-maroon">Sales timeline</h3>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[82px_1fr_110px] items-center gap-3 text-xs font-bold">
            <span className="text-muted">{row.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-cream">
              <span className="block h-full rounded-full bg-maroon" style={{ width: `${Math.max((row.sales / maxSales) * 100, row.sales ? 6 : 0)}%` }} />
            </span>
            <span className="text-right text-charcoal">{formatRupees(row.sales)} / {row.orders}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactRows({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="border-t border-border">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border px-5 py-3 text-sm last:border-b-0">
          <span className="font-black text-charcoal">{row.label}</span>
          <span className="font-black text-maroon">{row.orders}</span>
        </div>
      ))}
      {!rows.length ? <p className="px-5 py-4 text-sm font-bold text-muted">No orders in this period.</p> : null}
    </div>
  );
}

function ItemsTable({ rows, emptyLabel }: { rows: ReportRow[]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-cream text-maroon">
          <tr>
            {["Item", "Orders", "Qty", "Gross", "Net"].map((head) => <th key={head} className="p-3">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="p-3 font-black">{row.label}</td>
              <td className="p-3 font-black">{row.orders}</td>
              <td className="p-3 font-black">{row.quantity}</td>
              <td className="p-3">{formatRupees(row.grossSales)}</td>
              <td className="p-3 font-black text-maroon">{formatRupees(row.netSales)}</td>
            </tr>
          ))}
          {!rows.length ? <EmptyTableRow colSpan={5} label={emptyLabel} /> : null}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ rows, emptyLabel }: { rows: AdminReportsSnapshot["orders"]["recent"]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-cream text-maroon">
          <tr>
            {["Order", "Customer", "Status", "Items", "Amount", "Created"].map((head) => <th key={head} className="p-3">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.orderNumber} className="border-t border-border">
              <td className="p-3 font-black text-maroon">{order.orderNumber}</td>
              <td className="p-3 font-black">{order.customerName}</td>
              <td className="p-3 text-muted">{order.status}</td>
              <td className="p-3">
                <p className="font-black">{order.items}</p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">{order.itemSummary}</p>
              </td>
              <td className="p-3 font-black">{formatRupees(order.amount)}</td>
              <td className="p-3 text-muted">{formatIstDateTime(order.createdAt)}</td>
            </tr>
          ))}
          {!rows.length ? <EmptyTableRow colSpan={6} label={emptyLabel} /> : null}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-sm font-bold text-muted">{label}</td>
    </tr>
  );
}

type PdfSection = {
  kind: ReportKind;
  heading: string;
  rows: string[][];
};

function buildPdfSections(snapshot: AdminReportsSnapshot): PdfSection[] {
  const dishSearchSections: PdfSection[] = snapshot.dishSearch.active ? [
    {
      kind: "items",
      heading: `Dish Search Summary - ${snapshot.dishSearch.query}`,
      rows: [
        ["Metric", "Value"],
        ["Matched dishes", String(snapshot.dishSearch.matchedDishes)],
        ["Total dish orders", String(snapshot.dishSearch.orders)],
        ["Items sold", String(snapshot.dishSearch.quantity)],
        ["Item sales", money(snapshot.dishSearch.itemSales)],
        ["Customers", String(snapshot.dishSearch.customers)],
        ["Repeat customers", String(snapshot.dishSearch.repeatCustomers)],
        ["Average dish order", money(snapshot.dishSearch.averageOrderValue)],
      ],
    },
    {
      kind: "items",
      heading: "Searched Dish Items",
      rows: [["Item", "Orders", "Qty", "Gross", "Net"], ...snapshot.dishSearch.topDishes.map((row) => reportRowToPdf(row))],
    },
    {
      kind: "customers",
      heading: "Searched Dish Customer Favourites",
      rows: [
        ["Customer", "Mobile", "Orders", "Qty", "Sales", "Favourite dish"],
        ...snapshot.dishSearch.customerFavourites.map((row) => [row.name, row.mobile, String(row.orders), String(row.quantity), money(row.spend), row.favouriteItem]),
      ],
    },
    {
      kind: "orders",
      heading: "Searched Dish Recent Orders",
      rows: [["Order", "Customer", "Status", "Items", "Amount"], ...snapshot.dishSearch.recentOrders.map((row) => [row.orderNumber, row.customerName, row.status, row.itemSummary || String(row.items), money(row.amount)])],
    },
  ] : [];

  return [
    ...dishSearchSections,
    {
      kind: "sales",
      heading: "Sales Report",
      rows: [
        ["Metric", "Value"],
        ["Subtotal", money(snapshot.sales.subtotal)],
        ["Discount", money(snapshot.sales.discount)],
        ["GST", money(snapshot.sales.gst)],
        ["Gross sales", money(snapshot.sales.grossSales)],
        ["Net revenue", money(snapshot.sales.netRevenue)],
        ["Average order", money(snapshot.sales.averageOrderValue)],
        ["COD sales", money(snapshot.sales.codSales)],
        ["Online sales", money(snapshot.sales.onlineSales)],
        ["Cancelled value", money(snapshot.sales.cancelledValue)],
      ],
    },
    {
      kind: "sales",
      heading: "Sales Timeline",
      rows: [["Period", "Orders", "Sales"], ...snapshot.timeline.map((row) => [row.label, String(row.orders), money(row.sales)])],
    },
    {
      kind: "orders",
      heading: "Order Status",
      rows: [["Status", "Orders", "Items", "Gross", "Net"], ...snapshot.orders.statusRows.map((row) => reportRowToPdf(row))],
    },
    {
      kind: "customers",
      heading: "Customer Report",
      rows: [
        ["Metric", "Value"],
        ["Total customers", String(snapshot.customers.totalCustomers)],
        ["New customers", String(snapshot.customers.newCustomers)],
        ["Ordering customers", String(snapshot.customers.orderingCustomers)],
        ["Repeat customers", String(snapshot.customers.repeatCustomers)],
        ["Average customer spend", money(snapshot.customers.averageSpend)],
      ],
    },
    {
      kind: "customers",
      heading: "Top Customers",
      rows: [["Customer", "Mobile", "Orders", "Spend"], ...snapshot.customers.topCustomers.map((row) => [row.name, row.mobile, String(row.orders), money(row.spend)])],
    },
    {
      kind: "coupons",
      heading: "Coupon Report",
      rows: [
        ["Metric", "Value"],
        ["Coupon sales", money(snapshot.coupons.couponSales)],
        ["Discount offered", money(snapshot.coupons.discountOffered)],
        ["Redemptions", String(snapshot.coupons.totalRedemptions)],
        ["Members used", String(snapshot.coupons.uniqueMembers)],
        ["Average coupon order", money(snapshot.coupons.averageCouponOrder)],
        ["Popular coupon", snapshot.coupons.popularCoupon?.code ?? "-"],
      ],
    },
    {
      kind: "coupons",
      heading: "Coupon Performance",
      rows: [
        ["Coupon", "Offer", "Used", "Members", "Sales", "Discount", "Delivery", "Takeaway"],
        ...snapshot.coupons.rows.map((row) => [row.code, row.label, String(row.redemptions), String(row.members), money(row.sales), money(row.discount), String(row.delivery), String(row.takeaway)]),
      ],
    },
    {
      kind: "items",
      heading: "Items Report",
      rows: [["Item", "Orders", "Qty", "Gross", "Net"], ...snapshot.items.rows.map((row) => reportRowToPdf(row))],
    },
    {
      kind: "best",
      heading: "Best Performing Items",
      rows: [["Item", "Orders", "Qty", "Gross", "Net"], ...snapshot.items.best.map((row) => reportRowToPdf(row))],
    },
    {
      kind: "worst",
      heading: "Worst Performing Items",
      rows: [["Item", "Orders", "Qty", "Gross", "Net"], ...snapshot.items.worst.map((row) => reportRowToPdf(row))],
    },
    {
      kind: "orders",
      heading: "Recent Orders",
      rows: [["Order", "Customer", "Status", "Items", "Amount"], ...snapshot.orders.recent.map((row) => [row.orderNumber, row.customerName, row.status, row.itemSummary || String(row.items), money(row.amount)])],
    },
  ];
}

function reportRowToPdf(row: ReportRow) {
  return [row.label, String(row.orders), String(row.quantity), money(row.grossSales), money(row.netSales)];
}

function money(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function downloadPdf(input: { title: string; subtitle: string; sections: PdfSection[]; filename: string }) {
  const lines = flattenPdfLines(input.title, input.subtitle, input.sections);
  const pdf = createSimplePdf(lines);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = input.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function flattenPdfLines(title: string, subtitle: string, sections: PdfSection[]) {
  const lines: string[] = [title, subtitle, ""];
  for (const section of sections) {
    lines.push(section.heading);
    if (section.rows.length) {
      const widths = getColumnWidths(section.rows);
      for (const row of section.rows) {
        const text = row.map((cell, index) => fitCell(cell, widths[index])).join("  ");
        lines.push(...wrapPdfLine(text, 108));
      }
    } else {
      lines.push("No data");
    }
    lines.push("");
  }
  return lines;
}

function getColumnWidths(rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  return Array.from({ length: columnCount }, (_, column) => {
    const contentWidth = Math.max(...rows.map((row) => sanitizePdfText(row[column] ?? "").length));
    return Math.min(Math.max(contentWidth, column === 0 ? 18 : 8), column === 0 ? 42 : 14);
  });
}

function fitCell(value: string, width: number) {
  const text = sanitizePdfText(value);
  const fitted = text.length > width ? `${text.slice(0, Math.max(width - 3, 1))}...` : text;
  return fitted.padEnd(width, " ");
}

function wrapPdfLine(value: string, maxLength: number) {
  const text = sanitizePdfText(value);
  if (text.length <= maxLength) return [text];
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += maxLength) {
    lines.push(text.slice(index, index + maxLength));
  }
  return lines;
}

function createSimplePdf(lines: string[]) {
  const pageCapacity = 52;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageCapacity) {
    pages.push(lines.slice(index, index + pageCapacity));
  }
  if (!pages.length) pages.push(["Wah Thali Report"]);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const pageObjectId = 5 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);
    objects[pageObjectId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    const stream = pdfPageStream(pages[index], index + 1, pages.length);
    objects[contentObjectId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function pdfPageStream(lines: string[], page: number, totalPages: number) {
  const commands: string[] = [];
  lines.forEach((line, index) => {
    const y = 800 - index * 14;
    const isHeading = index === 0 || (line && lines[index - 1] === "");
    const font = isHeading ? "F1" : "F2";
    const size = index === 0 ? 15 : isHeading ? 11 : 8;
    commands.push(`BT /${font} ${size} Tf 42 ${y} Td (${escapePdfText(line)}) Tj ET`);
  });
  commands.push(`BT /F1 8 Tf 492 28 Td (${escapePdfText(`Page ${page} of ${totalPages}`)}) Tj ET`);
  return commands.join("\n");
}

function sanitizePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function escapePdfText(value: string) {
  return sanitizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
