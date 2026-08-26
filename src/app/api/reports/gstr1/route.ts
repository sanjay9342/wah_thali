import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getGstr1Rows } from "@/lib/invoice";

async function getHandler(request: Request) {
  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

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

  const rows = getGstr1Rows().map((row) => [
    row.gstin,
    row.invoiceNumber,
    row.date,
    row.placeOfSupply,
    row.invoiceValue,
    row.rate,
    row.taxableValue,
    row.cgst,
    row.sgst,
    row.igst,
    row.cess,
  ]);

  const csv = [header, ...rows]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wah-thali-gstr1.csv"',
    },
  });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/reports/gstr1");
