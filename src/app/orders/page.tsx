import {
  ChevronRight,
  Mic,
  MoreVertical,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { products } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const orderHistory = [
  {
    id: "WH0001",
    placedAt: "Order placed on 12 Jul, 12:06PM",
    status: "Delivered",
    total: 249.45,
    image: products[4].image,
    productId: products[4].id,
    productName: products[4].name,
    items: [
      { name: "Paneer Butter Masala Combo", qty: 1, dietaryType: "VEG" },
      { name: "Chicken puff", qty: 1, dietaryType: "NON_VEG" },
      { name: "Watermelon juice", qty: 1, dietaryType: "VEG" },
      { name: "Wheat bread", qty: 1, dietaryType: "VEG" },
    ],
  },
  {
    id: "WH0002",
    placedAt: "Order placed on 29 Jun, 8:31PM",
    status: "Delivered",
    total: 121.9,
    image: products[1].image,
    productId: products[1].id,
    productName: products[1].name,
    items: [
      { name: "Watermelon Juice", qty: 1, dietaryType: "VEG" },
      { name: "Kadala Mittai", qty: 1, dietaryType: "VEG" },
    ],
  },
  {
    id: "WH0003",
    placedAt: "Order placed on 18 Jun, 7:15PM",
    status: "Delivered",
    total: 189,
    image: products[3].image,
    productId: products[3].id,
    productName: products[3].name,
    items: [
      { name: "Chinese Hakka Combo", qty: 1, dietaryType: "NON_VEG" },
      { name: "Wheat Bread", qty: 1, dietaryType: "VEG" },
    ],
  },
];

export default function OrdersPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-[430px] bg-white px-4 pb-32 pt-8 text-charcoal sm:my-6 sm:rounded-[28px] sm:shadow-[0_18px_60px_rgba(34,31,32,0.12)]">
        <label className="flex h-16 items-center gap-4 rounded-2xl bg-white px-4 shadow-[0_5px_18px_rgba(34,31,32,0.14)] ring-1 ring-border">
          <Search size={30} className="shrink-0 text-red" strokeWidth={3} />
          <input
            className="min-w-0 flex-1 bg-transparent text-[18px] font-bold text-charcoal placeholder:text-muted"
            placeholder="Search by order or dish..."
          />
          <span className="h-9 w-px bg-border" />
          <Mic size={24} className="shrink-0 text-red" />
        </label>

        <section className="mt-7 grid gap-6">
          {orderHistory.map((order) => (
            <article key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_12px_rgba(34,31,32,0.16)] ring-1 ring-border">
              <div className="grid grid-cols-[78px_1fr_auto] gap-3 p-4">
                <div className="relative h-[70px] w-[70px] overflow-hidden rounded-xl bg-cream">
                  <Image src={order.image} alt="" fill sizes="70px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[20px] font-black leading-tight text-charcoal">Order #{order.id}</h2>
                  <p className="mt-1 truncate text-[14px] font-semibold text-muted">{order.placedAt.replace("Order placed on ", "")}</p>
                  <Link href="/menu" className="mt-1 inline-flex text-[14px] font-black text-red">
                    View menu
                    <ChevronRight size={15} />
                  </Link>
                </div>
                <button className="grid h-10 w-8 place-items-center text-charcoal" aria-label={`More options for ${order.id}`}>
                  <MoreVertical size={22} />
                </button>
              </div>

              <div className="border-t border-border px-4 py-4">
                <div className="grid gap-4">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.name}`} className="flex items-center gap-3">
                      <DietIcon dietaryType={item.dietaryType} />
                      <p className="text-[17px] font-bold leading-5 text-charcoal">
                        {item.qty} x {item.name}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-dashed border-border pt-4">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <p className="text-[14px] font-black text-muted">{order.placedAt}</p>
                      <p className="mt-2 text-[17px] font-bold text-muted">{order.status}</p>
                    </div>
                    <span className="inline-flex items-center text-[17px] font-black text-charcoal">
                      {formatRupees(order.total)}
                      <ChevronRight size={20} className="text-muted" />
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-black text-charcoal">Rate</span>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star key={value} size={27} className="text-border" />
                    ))}
                  </div>
                  <Link href="/menu" className="inline-flex h-14 items-center gap-2 rounded-xl bg-red px-5 text-[17px] font-black text-white">
                    <RotateCcw size={18} /> Reorder
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
      <MobileNav />
    </>
  );
}

function DietIcon({ dietaryType }: { dietaryType: string }) {
  const nonVeg = dietaryType === "NON_VEG";

  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border ${nonVeg ? "border-red" : "border-maroon"}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${nonVeg ? "bg-red" : "bg-maroon"}`} />
    </span>
  );
}
