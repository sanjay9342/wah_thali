import { Heart, Plus, Star } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";

export function FoodCard({ product }: { product: Product }) {
  return (
    <article className="surface overflow-hidden rounded-2xl">
      <Link href={`/menu#${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 flex gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-bold text-white ${
                product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"
              }`}
            >
              {product.dietaryType === "NON_VEG" ? "Non-veg" : "Veg"}
            </span>
            {product.offer ? (
              <span className="rounded-md bg-gold px-2 py-1 text-xs font-black text-charcoal">
                {product.offer}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-maroon">{product.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{product.description}</p>
          </div>
          <Link href="/wishlist" className="grid h-10 min-w-10 place-items-center rounded-lg border border-border text-muted" aria-label="Open wishlist">
            <Heart size={18} />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1 font-bold text-charcoal">
            <Star size={16} className="fill-gold text-gold" /> {product.rating}
          </span>
          <span>{product.ratingCount} ratings</span>
          <span>{product.prepTimeMinutes} min</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-lg font-black text-charcoal">{formatRupees(product.price)}</span>
            {product.originalPrice ? (
              <span className="ml-2 text-sm text-muted line-through">
                {formatRupees(product.originalPrice)}
              </span>
            ) : null}
          </div>
          <Link
            href={`/cart?add=${product.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white"
          >
            <Plus size={18} /> Add
          </Link>
        </div>
      </div>
    </article>
  );
}
