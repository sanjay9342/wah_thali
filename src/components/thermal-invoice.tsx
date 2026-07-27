import { business } from "@/lib/business";
import { buildInvoiceTotals, invoiceTemplate } from "@/lib/invoice";

export function ThermalInvoice({ compact = false }: { compact?: boolean }) {
  const totals = buildInvoiceTotals(invoiceTemplate);

  return (
    <section className={`mx-auto bg-white text-charcoal shadow-sm ring-1 ring-border ${compact ? "max-w-[320px] p-4" : "max-w-sm p-5"}`}>
      <div className="text-center font-mono text-[12px] leading-5">
        <p className="text-sm font-black uppercase">{business.brandName}</p>
        <p>{business.legalName}</p>
        <p>{business.address}</p>
        <p>Phone: {business.phone}</p>
        <p>GSTIN: {business.gstin}</p>
        <p className="mt-3 font-black">Retail Invoice</p>
      </div>

      <div className="mt-4 border-y border-dashed border-charcoal/40 py-2 font-mono text-[12px]">
        <div className="flex justify-between gap-3">
          <span>Bill No: {invoiceTemplate.invoiceNumber}</span>
          <span>{invoiceTemplate.date || "Date pending"}</span>
        </div>
        <p className="mt-1">Customer: {invoiceTemplate.customerName}</p>
        <p>Payment Mode: {invoiceTemplate.paymentMode}</p>
      </div>

      <table className="mt-2 w-full border-b border-dashed border-charcoal/40 font-mono text-[11px]">
        <thead>
          <tr className="border-b border-dashed border-charcoal/40 text-left">
            <th className="py-1">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {invoiceTemplate.items.map((item) => (
            <tr key={item.name}>
              <td className="py-1 pr-2">{item.name}</td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right">{item.rate.toFixed(2)}</td>
              <td className="py-1 text-right">{(item.quantity * item.rate).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-2 space-y-1 font-mono text-[12px]">
        <div className="flex justify-between">
          <dt>Sub Total</dt>
          <dd>{totals.subtotal.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>(-) Discount</dt>
          <dd>{invoiceTemplate.discount.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{invoiceTemplate.delivery.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Packaging</dt>
          <dd>{invoiceTemplate.packaging.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>CGST @ 2.50%</dt>
          <dd>{totals.cgst.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>SGST @ 2.50%</dt>
          <dd>{totals.sgst.toFixed(2)}</dd>
        </div>
        <div className="mt-2 flex justify-between border-y border-dashed border-charcoal/40 py-2 text-sm font-black">
          <dt>TOTAL</dt>
          <dd>Rs {totals.total.toFixed(2)}</dd>
        </div>
      </dl>

      <div className="mt-4 text-center font-mono text-[11px] leading-5">
        <p>E & O.E</p>
        <p>Thank You</p>
        <p>For support call {business.phone}</p>
      </div>
    </section>
  );
}
