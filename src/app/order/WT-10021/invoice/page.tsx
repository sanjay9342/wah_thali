import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { ThermalInvoice } from "@/components/thermal-invoice";

export const metadata: Metadata = {
  title: "Invoice WT-10021 | Wah Thali",
};

export default function InvoicePage() {
  return (
    <>
      <Header />
      <main className="bg-cream px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black uppercase tracking-widest text-red">Thermal invoice</p>
              <h1 className="text-3xl font-black text-maroon">Invoice WT-10021</h1>
              <p className="mt-1 text-sm font-semibold text-muted">Designed for 58mm or 80mm receipt printers.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/api/reports/gstr1" className="inline-flex h-11 items-center rounded-lg bg-maroon px-4 text-sm font-black text-white">
                Download GSTR-1 CSV
              </Link>
            </div>
          </div>
          <ThermalInvoice />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
