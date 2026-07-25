import { business } from "@/lib/business";

export const sampleInvoice = {
  invoiceNumber: "WH0001",
  date: "24/07/2026, 01:10 PM",
  customerName: "Sanjay",
  paymentMode: "Cash on Delivery",
  items: [
    { name: "Wah Special Chicken Thali", quantity: 1, rate: 229 },
    { name: "Kolkata Chicken Biryani", quantity: 1, rate: 249 },
  ],
  discount: 0,
  delivery: 40,
  packaging: 0,
  gstRate: 5,
};

export function buildInvoiceTotals(invoice = sampleInvoice) {
  const subtotal = invoice.items.reduce((total, item) => total + item.quantity * item.rate, 0);
  const taxable = Math.max(subtotal - invoice.discount + invoice.delivery + invoice.packaging, 0);
  const cgst = Math.round((taxable * 2.5) / 100);
  const sgst = Math.round((taxable * 2.5) / 100);
  const total = taxable + cgst + sgst;

  return { subtotal, taxable, cgst, sgst, total };
}

export function getGstr1Rows() {
  const totals = buildInvoiceTotals();

  return [
    {
      gstin: business.gstin,
      invoiceNumber: sampleInvoice.invoiceNumber,
      date: sampleInvoice.date,
      placeOfSupply: "19-West Bengal",
      invoiceValue: totals.total,
      rate: sampleInvoice.gstRate,
      taxableValue: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: 0,
      cess: 0,
    },
  ];
}
