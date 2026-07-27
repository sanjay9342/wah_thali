export const invoiceTemplate = {
  invoiceNumber: "No invoice selected",
  date: "",
  customerName: "Customer",
  paymentMode: "Cash on Delivery",
  items: [] as { name: string; quantity: number; rate: number }[],
  discount: 0,
  delivery: 0,
  packaging: 0,
  gstRate: 5,
};

type Gstr1Row = {
  gstin: string;
  invoiceNumber: string;
  date: string;
  placeOfSupply: string;
  invoiceValue: number;
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
};

export function buildInvoiceTotals(invoice = invoiceTemplate) {
  const subtotal = invoice.items.reduce((total, item) => total + item.quantity * item.rate, 0);
  const taxable = Math.max(subtotal - invoice.discount + invoice.delivery + invoice.packaging, 0);
  const cgst = Math.round((taxable * 2.5) / 100);
  const sgst = Math.round((taxable * 2.5) / 100);
  const total = taxable + cgst + sgst;

  return { subtotal, taxable, cgst, sgst, total };
}

export function getGstr1Rows(): Gstr1Row[] {
  return [];
}
