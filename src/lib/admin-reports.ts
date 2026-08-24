import "server-only";

import { Prisma, type PaymentStatus } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { formatIstDate, getIstDateInputValue, parseIstDateInput } from "@/lib/time";

export const reportPeriods = ["daily", "weekly", "monthly", "yearly", "custom"] as const;

export type ReportPeriod = (typeof reportPeriods)[number];

export type ReportMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ReportRow = {
  label: string;
  searchText?: string;
  orders: number;
  quantity: number;
  grossSales: number;
  netSales: number;
};

export type CustomerReportRow = {
  name: string;
  mobile: string;
  orders: number;
  spend: number;
  lastOrder?: string;
};

export type OrderReportRow = {
  orderNumber: string;
  customerName: string;
  status: string;
  amount: number;
  items: number;
  itemSummary: string;
  createdAt: string;
};

export type ReportBucket = {
  label: string;
  orders: number;
  sales: number;
};

export type AdminReportsSnapshot = {
  period: ReportPeriod;
  date: string;
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  generatedAt: string;
  searchQuery: string;
  metrics: ReportMetric[];
  sales: {
    subtotal: number;
    discount: number;
    gst: number;
    grossSales: number;
    netRevenue: number;
    averageOrderValue: number;
    codSales: number;
    onlineSales: number;
    cancelledValue: number;
  };
  orders: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
    statusRows: ReportRow[];
    recent: OrderReportRow[];
  };
  customers: {
    totalCustomers: number;
    newCustomers: number;
    orderingCustomers: number;
    repeatCustomers: number;
    averageSpend: number;
    topCustomers: CustomerReportRow[];
  };
  items: {
    totalItemsSold: number;
    uniqueItemsSold: number;
    rows: ReportRow[];
    best: ReportRow[];
    worst: ReportRow[];
  };
  timeline: ReportBucket[];
};

const paidOnlineStatuses: PaymentStatus[] = ["PAID", "AUTHORIZED"];
const cancelledStatuses = new Set(["CANCELLED", "DELIVERY_FAILED", "REFUND_PENDING", "REFUNDED"]);
const activeStatuses = new Set(["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]);

type ReportOrder = Prisma.OrderGetPayload<{
  include: {
    customer: { select: { id: true; name: true; mobile: true; email: true } };
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            displayName: true;
            kitchenName: true;
            reportCode: true;
            category: { select: { name: true } };
          };
        };
      };
    };
    payments: true;
  };
}>;

type ReportProduct = {
  id: string;
  name: string;
  displayName: string | null;
  kitchenName: string | null;
  reportCode: string | null;
  category: { name: string };
};

export function parseReportPeriod(value: unknown): ReportPeriod {
  return reportPeriods.includes(value as ReportPeriod) ? value as ReportPeriod : "daily";
}

export async function getAdminReportsSnapshot(input: { period?: string; date?: string; from?: string; to?: string; q?: string }): Promise<AdminReportsSnapshot> {
  const period = parseReportPeriod(input.period);
  const date = normalizeReportDate(input.date);
  const window = getReportWindow(period, date, input.from, input.to);
  const searchQuery = normalizeSearchQuery(input.q);

  if (!isDatabaseConfigured()) return emptySnapshot(period, date, window.fromDate, window.toDate, window.label, searchQuery);

  const where = {
    AND: [
      visiblePlacedOrderWhere(),
      { createdAt: { gte: window.start, lt: window.end } },
    ],
  } satisfies Prisma.OrderWhereInput;

  const [orders, products, totalCustomers, newCustomers] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, mobile: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                displayName: true,
                kitchenName: true,
                reportCode: true,
                category: { select: { name: true } },
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        kitchenName: true,
        reportCode: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: window.start, lt: window.end } } }),
  ]);

  return buildSnapshot({
    period,
    date,
    fromDate: window.fromDate,
    toDate: window.toDate,
    rangeLabel: window.label,
    generatedAt: new Date().toISOString(),
    orders: filterReportOrders(orders, searchQuery),
    products: filterReportProducts(products, searchQuery),
    totalCustomers,
    newCustomers,
    searchQuery,
  });
}

function buildSnapshot(input: {
  period: ReportPeriod;
  date: string;
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  generatedAt: string;
  orders: ReportOrder[];
  products: ReportProduct[];
  totalCustomers: number;
  newCustomers: number;
  searchQuery: string;
}): AdminReportsSnapshot {
  const revenueOrders = input.orders.filter((order) => !cancelledStatuses.has(order.status));
  const grossSales = sum(revenueOrders, (order) => order.grandTotal);
  const subtotal = sum(revenueOrders, (order) => order.subtotal);
  const discount = sum(revenueOrders, (order) => order.discount);
  const gst = sum(revenueOrders, (order) => order.gst);
  const netRevenue = sum(revenueOrders, (order) => order.subtotal - order.discount);
  const cancelledOrders = input.orders.filter((order) => cancelledStatuses.has(order.status));
  const delivered = input.orders.filter((order) => order.status === "DELIVERED").length;
  const active = input.orders.filter((order) => activeStatuses.has(order.status)).length;
  const averageOrderValue = revenueOrders.length ? Math.round(grossSales / revenueOrders.length) : 0;
  const codSales = sum(revenueOrders.filter((order) => order.payments.some((payment) => payment.provider === "COD")), (order) => order.grandTotal);
  const onlineSales = sum(revenueOrders.filter((order) => order.payments.some((payment) => payment.provider !== "COD" && paidOnlineStatuses.includes(payment.status as PaymentStatus))), (order) => order.grandTotal);
  const cancelledValue = sum(cancelledOrders, (order) => order.grandTotal);
  const itemRows = getItemRows(input.products, revenueOrders);
  const statusRows = getStatusRows(input.orders);
  const topCustomers = getCustomerRows(input.orders);
  const orderingCustomers = new Set(revenueOrders.map((order) => order.customerId)).size;
  const repeatCustomers = topCustomers.filter((customer) => customer.orders > 1).length;
  const totalItemsSold = sum(itemRows, (item) => item.quantity);
  const uniqueItemsSold = itemRows.filter((item) => item.quantity > 0).length;

  return {
    period: input.period,
    date: input.date,
    fromDate: input.fromDate,
    toDate: input.toDate,
    rangeLabel: input.rangeLabel,
    generatedAt: input.generatedAt,
    searchQuery: input.searchQuery,
    metrics: [
      { label: "Gross sales", value: currency(grossSales), detail: `${revenueOrders.length} paid/COD order${revenueOrders.length === 1 ? "" : "s"}` },
      { label: "Net revenue", value: currency(netRevenue), detail: `After ${currency(discount)} discount` },
      { label: "Orders", value: String(input.orders.length), detail: `${delivered} delivered, ${active} active` },
      { label: "Customers", value: String(orderingCustomers), detail: `${input.newCustomers} new in this period` },
      { label: "Items sold", value: String(totalItemsSold), detail: `${uniqueItemsSold} unique menu item${uniqueItemsSold === 1 ? "" : "s"}` },
      { label: "Average order", value: currency(averageOrderValue), detail: `${currency(cancelledValue)} cancelled value` },
    ],
    sales: {
      subtotal,
      discount,
      gst,
      grossSales,
      netRevenue,
      averageOrderValue,
      codSales,
      onlineSales,
      cancelledValue,
    },
    orders: {
      total: input.orders.length,
      active,
      delivered,
      cancelled: cancelledOrders.length,
      statusRows,
      recent: input.orders.slice(0, 12).map((order) => ({
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        status: prettifyStatus(order.status),
        amount: order.grandTotal,
        items: sum(order.items, (item) => item.quantity),
        itemSummary: order.items.map((item) => `${item.quantity} x ${getReportItemDisplayName(item)}`).join(", "),
        createdAt: order.createdAt.toISOString(),
      })),
    },
    customers: {
      totalCustomers: input.totalCustomers,
      newCustomers: input.newCustomers,
      orderingCustomers,
      repeatCustomers,
      averageSpend: orderingCustomers ? Math.round(grossSales / orderingCustomers) : 0,
      topCustomers,
    },
    items: {
      totalItemsSold,
      uniqueItemsSold,
      rows: itemRows,
      best: [...itemRows].filter((row) => row.quantity > 0).sort((a, b) => b.netSales - a.netSales || b.quantity - a.quantity).slice(0, 8),
      worst: [...itemRows].sort((a, b) => a.quantity - b.quantity || a.netSales - b.netSales || a.label.localeCompare(b.label)).slice(0, 8),
    },
    timeline: getTimelineRows(input.period, input.date, revenueOrders, input.fromDate, input.toDate),
  };
}

function getItemRows(products: ReportProduct[], orders: ReportOrder[]): ReportRow[] {
  const rows = new Map<string, ReportRow>();

  for (const product of products) {
    rows.set(product.id, {
      label: getReportProductLabel(product),
      searchText: getReportProductSearchText(product),
      orders: 0,
      quantity: 0,
      grossSales: 0,
      netSales: 0,
    });
  }

  for (const order of orders) {
    const seenInOrder = new Set<string>();
    for (const item of order.items) {
      const key = item.productId || item.name;
      const row = rows.get(key) ?? {
        label: getReportItemLabel(item),
        searchText: getReportItemSearchText(item),
        orders: 0,
        quantity: 0,
        grossSales: 0,
        netSales: 0,
      };
      row.quantity += item.quantity;
      row.grossSales += item.price * item.quantity;
      row.netSales += item.price * item.quantity;
      if (!seenInOrder.has(key)) {
        row.orders += 1;
        seenInOrder.add(key);
      }
      rows.set(key, row);
    }
  }

  return [...rows.values()].sort((a, b) => b.netSales - a.netSales || b.quantity - a.quantity || a.label.localeCompare(b.label));
}

function getStatusRows(orders: ReportOrder[]): ReportRow[] {
  const rows = new Map<string, ReportRow>();

  for (const order of orders) {
    const label = prettifyStatus(order.status);
    const row = rows.get(label) ?? { label, orders: 0, quantity: 0, grossSales: 0, netSales: 0 };
    row.orders += 1;
    row.quantity += sum(order.items, (item) => item.quantity);
    row.grossSales += order.grandTotal;
    if (!cancelledStatuses.has(order.status)) row.netSales += order.grandTotal;
    rows.set(label, row);
  }

  return [...rows.values()].sort((a, b) => b.orders - a.orders || a.label.localeCompare(b.label));
}

function getCustomerRows(orders: ReportOrder[]): CustomerReportRow[] {
  const rows = new Map<string, CustomerReportRow>();

  for (const order of orders.filter((item) => !cancelledStatuses.has(item.status))) {
    const key = order.customerId;
    const row = rows.get(key) ?? {
      name: order.customer.name,
      mobile: order.customer.mobile,
      orders: 0,
      spend: 0,
      lastOrder: order.createdAt.toISOString(),
    };
    row.orders += 1;
    row.spend += order.grandTotal;
    if (!row.lastOrder || order.createdAt > new Date(row.lastOrder)) row.lastOrder = order.createdAt.toISOString();
    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => b.spend - a.spend || b.orders - a.orders).slice(0, 10);
}

function getTimelineRows(period: ReportPeriod, date: string, orders: ReportOrder[], fromDate: string, toDate: string): ReportBucket[] {
  const labels = getTimelineLabels(period, date, fromDate, toDate);
  const rows = new Map(labels.map((label) => [label, { label, orders: 0, sales: 0 }]));

  for (const order of orders) {
    const label = getTimelineLabel(period, order.createdAt, fromDate, toDate);
    const row = rows.get(label) ?? { label, orders: 0, sales: 0 };
    row.orders += 1;
    row.sales += order.grandTotal;
    rows.set(label, row);
  }

  return [...rows.values()];
}

function getTimelineLabels(period: ReportPeriod, date: string, fromDate: string, toDate: string) {
  if (period === "daily") return Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

  const window = getReportWindow(period, date, fromDate, toDate);
  if (period === "custom" && daysBetween(window.start, window.end) > 62) {
    const labels: string[] = [];
    const startParts = parseDateParts(window.fromDate);
    const endParts = parseDateParts(window.toDate);
    for (let year = startParts.year, month = startParts.month; year < endParts.year || (year === endParts.year && month <= endParts.month); month += 1) {
      if (month > 12) {
        year += 1;
        month = 1;
      }
      labels.push(new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1))));
    }
    return labels;
  }

  if (period === "yearly") {
    const parts = parseDateParts(date);
    return Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(Date.UTC(parts.year, month, 1))));
  }

  const labels: string[] = [];
  for (let cursor = new Date(window.start); cursor < window.end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    labels.push(getIstDateInputValue(cursor));
  }
  return labels;
}

function getTimelineLabel(period: ReportPeriod, value: Date, fromDate?: string, toDate?: string) {
  if (period === "daily") {
    const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(value);
    return `${hour}:00`;
  }
  if (period === "custom" && fromDate && toDate) {
    const start = parseIstDateInput(fromDate, "start");
    const end = parseIstDateInput(toDate, "end");
    if (start && end && daysBetween(start, new Date(end.getTime() + 1)) > 62) {
      return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" }).format(value);
    }
  }
  if (period === "yearly") {
    return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short" }).format(value);
  }
  return getIstDateInputValue(value);
}

function visiblePlacedOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { payments: { some: { provider: "COD" } } },
      { payments: { some: { provider: "RAZORPAY", status: { in: paidOnlineStatuses } } } },
    ],
  };
}

function normalizeReportDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseIstDateInput(value) ? value : getIstDateInputValue();
}

function getReportWindow(period: ReportPeriod, date: string, from?: string, to?: string) {
  const parts = parseDateParts(date);

  if (period === "custom") {
    const normalized = normalizeCustomRange(from, to, date);
    const start = parseIstDateInput(normalized.fromDate, "start") ?? istStart(parts.year, parts.month, parts.day);
    const inclusiveEnd = parseIstDateInput(normalized.toDate, "end") ?? start;
    const end = new Date(inclusiveEnd.getTime() + 1);
    return {
      start,
      end,
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
      label: normalized.fromDate === normalized.toDate
        ? formatIstDate(start, "short")
        : `${formatIstDate(start, "short")} to ${formatIstDate(inclusiveEnd, "short")}`,
    };
  }

  if (period === "yearly") {
    const start = istStart(parts.year, 1, 1);
    const end = istStart(parts.year + 1, 1, 1);
    return { start, end, fromDate: `${parts.year}-01-01`, toDate: `${parts.year}-12-31`, label: `${parts.year}` };
  }

  if (period === "monthly") {
    const start = istStart(parts.year, parts.month, 1);
    const end = parts.month === 12 ? istStart(parts.year + 1, 1, 1) : istStart(parts.year, parts.month + 1, 1);
    const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1)));
    const last = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end, fromDate: getIstDateInputValue(start), toDate: getIstDateInputValue(last), label };
  }

  if (period === "weekly") {
    const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const mondayOffset = (anchor.getUTCDay() + 6) % 7;
    anchor.setUTCDate(anchor.getUTCDate() - mondayOffset);
    const start = istStart(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, anchor.getUTCDate());
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const last = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end, fromDate: getIstDateInputValue(start), toDate: getIstDateInputValue(last), label: `${formatIstDate(start, "short")} to ${formatIstDate(last, "short")}` };
  }

  const start = istStart(parts.year, parts.month, parts.day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, fromDate: date, toDate: date, label: formatIstDate(start, "short") };
}

function normalizeCustomRange(from: string | undefined, to: string | undefined, fallbackDate: string) {
  const fromDate = normalizeReportDate(from ?? fallbackDate);
  const toDate = normalizeReportDate(to ?? fromDate);
  return fromDate <= toDate ? { fromDate, toDate } : { fromDate: toDate, toDate: fromDate };
}

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function istStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
}

function emptySnapshot(period: ReportPeriod, date: string, fromDate: string, toDate: string, rangeLabel: string, searchQuery = ""): AdminReportsSnapshot {
  return buildSnapshot({
    period,
    date,
    fromDate,
    toDate,
    rangeLabel,
    generatedAt: new Date().toISOString(),
    orders: [],
    products: [],
    totalCustomers: 0,
    newCustomers: 0,
    searchQuery,
  });
}

function sum<T>(items: T[], read: (item: T) => number) {
  return items.reduce((total, item) => total + read(item), 0);
}

function currency(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function prettifyStatus(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function normalizeSearchQuery(value?: string) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function filterReportProducts(products: ReportProduct[], query: string) {
  if (!query) return products;
  const needle = query.toLowerCase();
  return products.filter((product) => getReportProductSearchText(product).includes(needle));
}

function filterReportOrders(orders: ReportOrder[], query: string) {
  if (!query) return orders;
  const needle = query.toLowerCase();
  return orders.filter((order) => order.items.some((item) => getReportItemSearchText(item).includes(needle)));
}

function getReportProductLabel(product: ReportProduct) {
  const displayName = product.displayName || product.name;
  const prefix = product.reportCode ? `${product.reportCode} - ` : "";
  const kitchen = product.kitchenName && product.kitchenName !== displayName ? ` / ${product.kitchenName}` : "";
  return `${prefix}${displayName}${kitchen} (${product.category.name})`;
}

function getReportItemLabel(item: ReportOrder["items"][number]) {
  return item.product ? getReportProductLabel(item.product) : `${item.name} (Menu)`;
}

function getReportItemDisplayName(item: ReportOrder["items"][number]) {
  if (!item.product) return item.name;
  return item.product.reportCode ? `${item.product.reportCode} - ${item.product.displayName || item.name}` : item.product.displayName || item.name;
}

function getReportProductSearchText(product: ReportProduct) {
  return [
    product.name,
    product.displayName,
    product.kitchenName,
    product.reportCode,
    product.category.name,
  ].filter(Boolean).join(" ").toLowerCase();
}

function getReportItemSearchText(item: ReportOrder["items"][number]) {
  return [
    item.name,
    item.product ? getReportProductSearchText(item.product) : "",
  ].filter(Boolean).join(" ").toLowerCase();
}
