import { Gift, Tag } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { getCouponsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";
import type { Coupon } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const coupons = await getCouponsFromDb();

  return (
    <>
      <Header />
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f7fb] px-5 pb-28 pt-5 text-charcoal sm:my-6 sm:rounded-[28px] lg:max-w-5xl lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-muted">Wah Thali</p>
            <h1 className="mt-1 text-[26px] font-black leading-tight text-maroon">Offers</h1>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border">
            <Gift size={23} />
          </span>
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {coupons.length ? coupons.map((coupon) => (
            <article key={coupon.code} className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-muted">Coupon</p>
                  <h2 className="mt-1 text-[20px] font-black leading-tight text-maroon">{coupon.label}</h2>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff4f5] text-maroon">
                  <Tag size={19} />
                </span>
              </div>
              <div className="mt-4 inline-flex rounded-xl bg-[#fff4f5] px-3 py-2 text-[13px] font-black text-maroon">
                Use Code: {coupon.code}
              </div>
              <p className="mt-3 text-[13px] font-bold text-muted">
                Save {getCouponBenefitText(coupon)} on orders above {formatRupees(coupon.minOrder)}.
              </p>
            </article>
          )) : (
            <section className="rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-border lg:col-span-2">
              <Gift className="mx-auto text-maroon" size={34} />
              <h2 className="mt-3 text-[20px] font-black text-charcoal">No live coupons</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-muted">
                Add active coupons from Admin, and they will appear here automatically.
              </p>
            </section>
          )}
        </section>
      </main>
      <MobileNav />
    </>
  );
}

function getCouponBenefitText(coupon: Coupon) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return coupon.maxDiscount ? `${coupon.value}% up to ${formatRupees(coupon.maxDiscount)}` : `${coupon.value}%`;
}
