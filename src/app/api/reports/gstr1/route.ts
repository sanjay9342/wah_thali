import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getReportWindow, parseReportPeriod } from "@/lib/admin-reports";
import { business } from "@/lib/business";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getIstDateInputValue } from "@/lib/time";

const paidOnlineStatuses = ["PAID", "AUTHORIZED"] as const;

async function getHandler(request: Request) {
  const access = await requireAdminPermission(request, "reports");
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const period = parseReportPeriod(url.searchParams.get("period"));
  const date = url.searchParams.get("date") || getIstDateInputValue();
  const window = getReportWindow(period, date, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);

  const header = [
    "GSTIN/UIN of Recipient",
    "Invoice Number",
    "Invoice date",
    "Place Of Supply",
    "Invoice Value",
    "Rate",
    "Taxable Value",
    "CGST",
    "SGST",
    "IGST",
    "Cess",
  ];

  const orders = isDatabaseConfigured()
    ? await prisma.order.findMany({
        where: {
          createdAt: { gte: window.start, lt: window.end },
          OR: [
            { payments: { some: { provider: "COD" } } },
            { payments: { some: { provider: "RAZORPAY", status: { in: [...paidOnlineStatuses] } } } },
          ],
        },
        include: { payments: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const rows = orders
    .filter((order) => !["CANCELLED", "DELIVERY_FAILED", "REFUND_PENDING", "REFUNDED"].includes(order.status))
    .map((order) => {
      const taxableValue = Math.max(order.grandTotal - order.gst, 0);
      const halfGst = Math.round(order.gst / 2);
      return [
        "",
        order.orderNumber,
        getIstDateInputValue(order.createdAt),
        `${business.gstin.slice(0, 2)}-West Bengal`,
        order.grandTotal,
        5,
        taxableValue,
        halfGst,
        order.gst - halfGst,
        0,
        0,
      ];
    });

  const csv = [header, ...rows]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wah-thali-gstr1-${window.fromDate}-to-${window.toDate}.csv"`,
    },
  });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/reports/gstr1");
