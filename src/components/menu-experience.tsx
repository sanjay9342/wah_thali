"use client";

import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BadgePercent,
  Bike,
  BookOpen,
  ChevronRight,
  Grid3X3,
  Heart,
  IndianRupee,
  Leaf,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  TimerReset,
  Truck,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { categories as fallbackCategories, products as fallbackProducts } from "@/lib/data";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { getDeliveryLocationCoverage, useDeliveryLocation } from "@/lib/delivery-location";
import { formatRupees, getPricableCartLines, getProductPrice } from "@/lib/pricing";
import { getStoreOrderingStatus } from "@/lib/store-hours";
import { useStoredCart } from "@/lib/use-stored-cart";
import { useStoredWishlist } from "@/lib/use-stored-wishlist";
import type { CartLine, CategoryOfferMap, Coupon, HomeSlide, Product, RestaurantSettings } from "@/lib/types";
import { writeStoredWishlist } from "@/lib/wishlist-storage";

function getQuantity(lines: CartLine[], productId: string) {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0);
}

function getVariantQuantity(lines: CartLine[], productId: string, variantId: string) {
  return lines
    .filter((line) => line.productId === productId && line.variantId === variantId)
    .reduce((total, line) => total + line.quantity, 0);
}

type MenuFilterId = "veg" | "bestseller" | "offers" | "rating" | "fast" | "under199";

const menuFilterOptions: { id: MenuFilterId; label: string; helper: string }[] = [
  { id: "veg", label: "Pure Veg", helper: "Veg and Jain dishes" },
  { id: "offers", label: "Offers", helper: "Deals and discounts" },
  { id: "rating", label: "Rating 4.5+", helper: "Top rated items" },
  { id: "fast", label: "Under 30 min", helper: "Quick prep dishes" },
  { id: "under199", label: "Under Rs 199", helper: "Budget picks" },
];

function MenuFilterIcon({ filterId, className }: { filterId: MenuFilterId; className?: string }) {
  if (filterId === "veg") return <Leaf size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "bestseller") return <Star size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "offers") return <BadgePercent size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "rating") return <Star size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "fast") return <TimerReset size={15} strokeWidth={2.6} className={className} />;
  return <IndianRupee size={15} strokeWidth={2.6} className={className} />;
}

function productMatchesMenuFilters(product: Product, activeFilters: MenuFilterId[], categoryOffers: CategoryOfferMap) {
  if (!activeFilters.length) return true;

  return activeFilters.every((filterId) => {
    if (filterId === "veg") return product.dietaryType === "VEG" || product.dietaryType === "JAIN";
    if (filterId === "bestseller") return Boolean(product.bestseller);
    if (filterId === "offers") return Boolean(getProductOffer(product, categoryOffers) || product.originalPrice);
    if (filterId === "rating") return product.rating >= 4.5;
    if (filterId === "fast") return product.prepTimeMinutes <= 30;
    return product.price <= 199;
  });
}

function SearchFilterControl({
  query,
  setQuery,
  activeFilters,
  filtersOpen,
  onToggleFiltersOpen,
  onToggleFilter,
  onClearFilters,
  placeholder,
  className = "",
}: {
  query: string;
  setQuery: (value: string) => void;
  activeFilters: MenuFilterId[];
  filtersOpen: boolean;
  onToggleFiltersOpen: () => void;
  onToggleFilter: (filterId: MenuFilterId) => void;
  onClearFilters: () => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <section className={`rounded-[16px] border border-[#eef1f6] bg-white px-2 py-1.5 shadow-[0_8px_22px_rgba(34,31,32,0.05)] ${className}`}>
      <div className="grid h-11 grid-cols-[42px_1fr_auto] items-center gap-1 lg:h-12">
        <Search size={20} className="mx-auto text-[#68707c]" strokeWidth={2.4} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 bg-transparent text-[12px] font-semibold text-charcoal outline-none placeholder:text-muted lg:text-sm"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleFiltersOpen}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-2.5 text-[11px] font-black transition-colors lg:px-3 lg:text-xs ${
            activeFilters.length ? "bg-red text-white" : "bg-[#f7f8fc] text-charcoal ring-1 ring-[#e7ebf2]"
          }`}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} strokeWidth={2.7} />
          <span>Filters</span>
          {activeFilters.length ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-red">
              {activeFilters.length}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {menuFilterOptions.map((option) => {
            const selected = activeFilters.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggleFilter(option.id)}
                title={option.helper}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black transition-colors ${
                  selected
                    ? "border-red bg-red text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]"
                    : "border-[#e5e9f0] bg-white text-[#374151] hover:border-red/40 hover:text-red"
                }`}
                aria-pressed={selected}
              >
                <MenuFilterIcon filterId={option.id} className={selected ? "fill-white/20" : ""} />
                {option.label}
              </button>
            );
          })}
          {activeFilters.length ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#e5e9f0] bg-[#f7f8fc] px-3 text-[11px] font-black text-[#4b5563]"
            >
              <X size={14} strokeWidth={2.7} />
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function QuantityControl({
  quantity,
  onAdd,
  onDecrease,
  disabled,
  wide = false,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  disabled: boolean;
  wide?: boolean;
}) {
  if (disabled) {
    return (
      <button disabled className={`${wide ? "min-w-[132px] shrink-0" : ""} h-8 rounded-[8px] bg-[#f2eef0] px-3 text-[10px] font-black text-muted sm:h-9 sm:px-4 sm:text-xs`}>
        Closed
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className={`${wide ? "w-[132px] shrink-0 sm:w-[144px]" : "w-[66px] sm:w-[86px]"} grid h-8 grid-cols-3 overflow-hidden rounded-[8px] bg-red text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)] sm:h-9`}>
        <button className="grid place-items-center" onClick={onDecrease} aria-label="Decrease quantity">
          <Minus size={wide ? 13 : 11} strokeWidth={3} />
        </button>
        <span className="grid place-items-center text-[12px] font-black sm:text-sm">{quantity}</span>
        <button className="grid place-items-center" onClick={onAdd} aria-label="Increase quantity">
          <Plus size={wide ? 13 : 11} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className={`${wide ? "min-w-[132px] shrink-0 px-7" : "px-3"} h-8 rounded-[8px] bg-red text-[11px] font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)] sm:h-9 sm:px-5 sm:text-sm`}
    >
      Add
    </button>
  );
}

function DetailQuantityControl({
  quantity,
  onAdd,
  onDecrease,
  disabled,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <button disabled className="h-13 w-[112px] shrink-0 rounded-[15px] bg-[#f2eef0] text-[12px] font-black text-muted">
        Closed
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className="grid h-13 w-[112px] shrink-0 grid-cols-3 overflow-hidden rounded-[15px] bg-maroon text-white shadow-[0_10px_22px_rgba(141,0,33,0.22)]">
        <button className="grid place-items-center" onClick={onDecrease} aria-label="Decrease quantity">
          <Minus size={16} strokeWidth={3} />
        </button>
        <span className="grid place-items-center text-[14px] font-black">{quantity}</span>
        <button className="grid place-items-center" onClick={onAdd} aria-label="Increase quantity">
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="h-13 w-[112px] shrink-0 rounded-[15px] bg-maroon text-[12px] font-black text-white shadow-[0_10px_22px_rgba(141,0,33,0.22)]"
    >
      Add
    </button>
  );
}

function DietMark({ type, compact = false }: { type: Product["dietaryType"]; compact?: boolean }) {
  const isNonVeg = type === "NON_VEG";
  const colorClass = isNonVeg ? "border-[#c62828]" : "border-[#078b52]";
  const dotClass = isNonVeg ? "bg-[#c62828]" : "bg-[#078b52]";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[4px] border-2 bg-white ${colorClass} ${compact ? "h-4 w-4" : "h-5 w-5"}`}
      title={isNonVeg ? "Non veg" : "Veg"}
      aria-label={isNonVeg ? "Non veg" : "Veg"}
    >
      <span className={`rounded-full ${dotClass} ${compact ? "h-2 w-2" : "h-2.5 w-2.5"}`} />
    </span>
  );
}

function needsDishDetail(product: Product) {
  return product.addons.length > 0 || product.variants.length > 1;
}

function ProductCard({
  product,
  offer,
  quantity,
  saved,
  onAdd,
  onDecrease,
  onOpen,
  onToggleSave,
  orderingDisabled,
}: {
  product: Product;
  offer?: string;
  quantity: number;
  saved: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
  orderingDisabled: boolean;
}) {
  return (
    <article className="min-w-[104px] overflow-hidden rounded-[20px] border border-[#f0e8e2] bg-white shadow-[0_10px_22px_rgba(34,31,32,0.055)] sm:min-w-0 sm:rounded-[26px] sm:shadow-[0_14px_34px_rgba(34,31,32,0.07)]">
      <div className="relative aspect-[1.58/1] w-full overflow-hidden bg-[#f6f1ed] sm:aspect-[1.42/1]">
        <button className="block h-full w-full text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={useFallbackImage} />
        </button>
        <button
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-red shadow-[0_8px_18px_rgba(34,31,32,0.12)] sm:right-3 sm:top-3 sm:h-9 sm:w-9"
          onClick={onToggleSave}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
        >
          <Heart size={12} className={saved ? "fill-red" : "sm:h-[17px] sm:w-[17px]"} />
        </button>
      </div>

      <div className="p-2.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 text-left" onClick={onOpen}>
            <span className="flex min-w-0 items-center justify-between gap-1.5">
              <h3 className="line-clamp-1 min-w-0 text-[10px] font-black leading-tight text-charcoal sm:text-base">{product.name}</h3>
              <DietMark type={product.dietaryType} compact />
            </span>
            <p className="mt-1 line-clamp-1 text-[8px] font-black uppercase tracking-wide text-muted sm:text-[11px]">{product.category}</p>
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[8px] font-bold text-muted sm:mt-2.5 sm:gap-2 sm:text-[11px]">
          <span className="inline-flex items-center gap-0.5 rounded-[5px] bg-[#fff3f5] px-1 py-0.5 font-black text-red sm:gap-1 sm:px-2 sm:py-1">
            <Star size={8} className="fill-red sm:h-[11px] sm:w-[11px]" />
            {product.rating}
          </span>
          <span>{product.prepTimeMinutes}-{product.prepTimeMinutes + 8} min</span>
        </div>

        {offer ? <p className="mt-1.5 line-clamp-1 text-[8px] font-black text-maroon sm:mt-2.5 sm:text-[11px]">{offer}</p> : null}

        <div className={`${offer ? "mt-2.5 sm:mt-3" : "mt-2 sm:mt-2.5"} flex items-center justify-between gap-1.5 sm:gap-3`}>
          <span className="text-[10px] font-black text-charcoal sm:text-base">{formatRupees(product.price)}</span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} disabled={orderingDisabled} />
        </div>
      </div>
    </article>
  );
}

function FoodieProductCard({
  product,
  offer,
  quantity,
  saved,
  onAdd,
  onDecrease,
  onOpen,
  onToggleSave,
  orderingDisabled,
}: {
  product: Product;
  offer?: string;
  quantity: number;
  saved: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
  orderingDisabled: boolean;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_8px_18px_rgba(34,31,32,0.055)] ring-1 ring-[#eef1f6]">
      <div className="relative aspect-[1.55/1] overflow-hidden bg-[#f3f5f8]">
        <button className="block h-full w-full text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={useFallbackImage} />
        </button>
        <button
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-[#98a0ad] shadow-[0_8px_18px_rgba(34,31,32,0.12)]"
          onClick={onToggleSave}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
        >
          <Heart size={17} strokeWidth={2.2} className={saved ? "fill-red text-red" : ""} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-2 pt-2.5">
        <button className="block w-full text-left" onClick={onOpen}>
          <span className="flex min-w-0 items-center justify-between gap-1.5">
            <h3 className="line-clamp-1 min-w-0 text-[14px] font-black leading-tight text-[#111827]">{product.name}</h3>
            <DietMark type={product.dietaryType} compact />
          </span>
          <p className="mt-1 line-clamp-1 text-[10px] font-black uppercase tracking-wide text-[#a0a6b0]">{foodieCategoryLabel(product.category)}</p>
        </button>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-extrabold text-[#5f6875]">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff6ed] px-1.5 py-0.5 font-black text-[#ff6b00]">
            <Star size={10} className="fill-[#ff6b00]" />
            {product.rating}
          </span>
          <span className="text-[#d8dce3]">•</span>
          <span>{product.prepTimeMinutes}-{product.prepTimeMinutes + 5} min</span>
        </div>
        {offer ? (
          <div className="mt-1.5 border-t border-[#eef1f6] pt-1.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-[#078b52]">
              <span className="text-lg">?</span>
              {offer}
            </p>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-[13px] font-black text-[#111827]">{formatRupees(product.price)}</span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} disabled={orderingDisabled} />
        </div>
      </div>
    </article>
  );
}

function DesktopSearchPage({
  query,
  setQuery,
  activeFilters,
  filtersOpen,
  onToggleFiltersOpen,
  onToggleFilter,
  onClearFilters,
  searchGroups,
  categoryOffers,
  validCart,
  savedProductIds,
  orderingDisabled,
  onAdd,
  onDecrease,
  onOpen,
  onToggleSave,
}: {
  query: string;
  setQuery: (value: string) => void;
  activeFilters: MenuFilterId[];
  filtersOpen: boolean;
  onToggleFiltersOpen: () => void;
  onToggleFilter: (filterId: MenuFilterId) => void;
  onClearFilters: () => void;
  searchGroups: { category: string; items: Product[] }[];
  categoryOffers: CategoryOfferMap;
  validCart: CartLine[];
  savedProductIds: string[];
  orderingDisabled: boolean;
  onAdd: (product: Product) => void;
  onDecrease: (product: Product) => void;
  onOpen: (product: Product) => void;
  onToggleSave: (product: Product) => void;
}) {
  return (
    <section className="hidden bg-[#f7f8fc] px-8 pb-16 pt-8 lg:block">
      <div className="mx-auto max-w-[1180px]">
        <div className="rounded-[28px] bg-[#fff4f5] px-10 py-8 shadow-[0_14px_34px_rgba(34,31,32,0.05)]">
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(420px,1fr)] items-center gap-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon">Search Wah Thali</p>
              <h1 className="mt-3 max-w-[410px] text-[38px] font-black leading-tight text-charcoal">
                What are you looking for today?
              </h1>
            </div>
            <SearchFilterControl
              query={query}
              setQuery={setQuery}
              activeFilters={activeFilters}
              filtersOpen={filtersOpen}
              onToggleFiltersOpen={onToggleFiltersOpen}
              onToggleFilter={onToggleFilter}
              onClearFilters={onClearFilters}
              placeholder="Search fresh dishes"
              className="rounded-[18px] border-[#f0e2e4] px-2.5 py-2"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-10">
          {searchGroups.length ? searchGroups.map((group) => (
            <section key={group.category}>
              <div className="mb-5 flex items-center gap-4">
                <h2 className="text-[26px] font-black text-[#111827]">{shortCategoryName(group.category)}</h2>
                <span className="rounded-full bg-[#fff4f5] px-3 py-1 text-xs font-black text-maroon">{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
              </div>
              <div className="grid grid-cols-4 gap-5">
                {group.items.map((product) => (
                  <FoodieProductCard
                    key={product.id}
                    product={product}
                    offer={getProductOffer(product, categoryOffers)}
                    quantity={getQuantity(validCart, product.id)}
                    saved={savedProductIds.includes(product.id)}
                    onAdd={() => onAdd(product)}
                    onDecrease={() => onDecrease(product)}
                    onOpen={() => onOpen(product)}
                    onToggleSave={() => onToggleSave(product)}
                    orderingDisabled={orderingDisabled}
                  />
                ))}
              </div>
            </section>
          )) : (
            <div className="rounded-[24px] border border-[#e7ebf2] bg-white p-10 text-center shadow-[0_12px_28px_rgba(17,24,39,0.04)]">
              <Store className="mx-auto text-muted" size={34} />
              <h2 className="mt-4 text-xl font-black text-[#111827]">No dishes found</h2>
              <p className="mt-2 text-sm font-semibold text-muted">Try clearing filters or searching for thali, biryani, momo, or dessert.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DesktopTrustFooter({ categories }: { categories: string[] }) {
  const topCategories = categories.filter((category) => category !== "All").slice(0, 5);

  return (
    <section className="hidden border-t border-[#f1e7e4] bg-white lg:block">
      <div className="mx-auto max-w-[1180px] px-5 py-9">
        <div className="grid grid-cols-[1.15fr_0.7fr_0.8fr_0.8fr] gap-12">
          <div>
            <Link href="/" className="relative block h-12 w-40 overflow-hidden">
              <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill sizes="160px" className="object-contain object-left" />
            </Link>
            <p className="mt-5 max-w-[360px] text-sm font-semibold leading-7 text-muted">
              Fresh homestyle meals delivered straight to your doorstep. Simple ordering, clean food, and fast delivery.
            </p>
          </div>

          <FooterColumn title="Top Categories">
            {topCategories.map((category) => (
              <Link key={category} href={`/?category=${encodeURIComponent(category)}`} className="text-sm font-bold text-muted hover:text-maroon">
                {shortCategoryName(category)}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="Our Policies">
            {[
              ["Privacy Policy", "/privacy-policy"],
              ["About Us", "/about"],
              ["Terms and Conditions", "/terms-and-conditions"],
              ["Refund Policy", "/refund-cancellation-policy"],
              ["Delivery Policy", "/delivery-policy"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-bold text-muted hover:text-maroon">
                {label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="Support & More">
            {[
              ["Help Center", "/support"],
              ["Orders", "/orders"],
              ["Offers", "/offers"],
              ["Loyalty", "/loyalty"],
              ["Account", "/account"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-bold text-muted hover:text-maroon">
                {label}
              </Link>
            ))}
          </FooterColumn>
        </div>
      </div>
    </section>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-black uppercase tracking-wide text-charcoal">{title}</h3>
      <div className="mt-6 grid gap-4">{children}</div>
    </div>
  );
}
function DishDetailSheet({
  product,
  getQuantityForVariant,
  onAdd,
  onDecrease,
  onClose,
  onSelectProduct,
  orderingDisabled,
  offer,
  relatedProducts,
  freeDeliveryThreshold,
  cartCount,
}: {
  product: Product;
  getQuantityForVariant: (variantId: string) => number;
  onAdd: (variantId: string, addonIds?: string[]) => void;
  onDecrease: (variantId: string) => void;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  orderingDisabled: boolean;
  offer?: string;
  relatedProducts: Product[];
  freeDeliveryThreshold?: number;
  cartCount: number;
}) {
  const defaultVariantId = product.variants[0]?.id ?? "regular";
  const variants = product.variants.length ? product.variants : [{ id: defaultVariantId, name: "Regular", price: 0 }];
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const selectedQuantity = getQuantityForVariant(selectedVariant.id);
  const selectedAddonIds = useMemo(
    () =>
      product.addons.flatMap((addon) =>
        Array.from({ length: addonQuantities[addon.id] ?? 0 }, () => addon.id),
      ),
    [addonQuantities, product.addons],
  );
  const addonTotal = product.addons.reduce((total, addon) => total + addon.price * (addonQuantities[addon.id] ?? 0), 0);
  const selectedPrice = product.price + selectedVariant.price;
  const totalPrice = selectedPrice + addonTotal;
  const discountPercent = product.originalPrice
    ? Math.max(Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100), 0)
    : 0;

  function addAddon(addonId: string) {
    setAddonQuantities((current) => ({
      ...current,
      [addonId]: (current[addonId] ?? 0) + 1,
    }));
  }

  function decreaseAddon(addonId: string) {
    setAddonQuantities((current) => {
      const nextQuantity = Math.max((current[addonId] ?? 0) - 1, 0);
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[addonId];
        return next;
      }
      return { ...current, [addonId]: nextQuantity };
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[#f7f8fc]" onClick={onClose}>
      <section
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f8fc] shadow-[0_18px_60px_rgba(34,31,32,0.08)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-detail-title"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+92px)]">
          <div className="relative h-[242px] bg-[#f6f1ed]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-b from-charcoal/24 via-transparent to-charcoal/10" />
            <button
              className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/92 text-charcoal shadow-lg"
              onClick={onClose}
              aria-label="Close dish details"
            >
              <ArrowLeft size={21} strokeWidth={3} />
            </button>
            <Link href="/cart" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/92 text-maroon shadow-lg" aria-label="Open cart">
              <ShoppingCart size={20} strokeWidth={2.7} />
              {cartCount ? <span className="absolute -right-1 -top-1 rounded-full bg-maroon px-1.5 text-[9px] font-black text-white">{cartCount}</span> : null}
            </Link>
            <span className="absolute bottom-4 left-4">
              <DietMark type={product.dietaryType} />
            </span>
            {discountPercent > 0 ? (
              <span className="absolute left-0 top-[52%] rounded-r-full bg-[#fff2f4] px-3 py-1.5 text-[10px] font-black text-maroon">
                {discountPercent}% OFF
              </span>
            ) : null}
          </div>

          <div className="px-5 pt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">{product.category}</p>
            <h2 id="dish-detail-title" className="mt-1.5 text-[22px] font-black leading-tight text-charcoal">
                {product.name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-black text-muted">
              <span className="inline-flex items-center gap-1">
                <TimerReset size={12} /> {product.prepTimeMinutes}-{product.prepTimeMinutes + 5} min
              </span>
              <span className="text-[#d8dce3]">•</span>
              <span className="inline-flex items-center gap-1">
                <BadgeCheck size={12} className="text-maroon" /> {product.rating}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2.5">
              <span className="text-[26px] font-black leading-none text-charcoal">{formatRupees(totalPrice)}</span>
              {product.originalPrice ? <span className="text-sm font-bold text-muted line-through">{formatRupees(product.originalPrice + selectedVariant.price)}</span> : null}
              {discountPercent > 0 ? <span className="pb-0.5 text-xs font-black text-maroon">{discountPercent}% off</span> : null}
            </div>
          

          {offer ? (
            <div className="mt-4 grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[14px] border border-[#f0d7dd] bg-[#fff4f5] px-3.5 py-2.5 text-maroon">
              <BadgeCheck size={19} className="fill-maroon text-maroon" />
              <span className="text-[11px] font-black uppercase tracking-wide">{offer}</span>
              <span className="text-[13px] font-black">{formatRupees(Math.max(Math.round(totalPrice * 0.8), 0))}</span>
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="text-[12px] font-black text-charcoal">Select Size</h3>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
              {variants.map((variant, index) => {
                const active = variant.id === selectedVariant.id;
                const variantPrice = product.price + variant.price;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`min-h-[96px] rounded-[16px] border-2 bg-white p-2.5 text-center shadow-[0_10px_20px_rgba(17,24,39,0.05)] transition-colors ${
                      active ? "border-maroon text-maroon" : "border-[#eef1f6] text-muted"
                    }`}
                  >
                    <span className={`mx-auto grid h-5 w-5 place-items-center rounded-full ${active ? "bg-maroon text-white" : "bg-[#f2f4f7] text-transparent"}`}>
                      <BadgeCheck size={13} strokeWidth={3} />
                    </span>
                    <span className="mt-2 block text-[11px] font-black">{variant.name}</span>
                    <span className="mt-1 block text-[11px] font-black text-muted">{index === 0 ? "1" : index === 1 ? "2" : String(index + 1)}</span>
                    <span className="mt-1.5 block text-[12px] font-black">{formatRupees(variantPrice)}</span>
                    {product.originalPrice ? <span className="mt-1 block text-[10px] font-bold text-muted line-through">{formatRupees(product.originalPrice + variant.price)}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {product.addons.length ? (
            <div className="mt-5 overflow-hidden rounded-[16px] bg-white shadow-[0_10px_24px_rgba(17,24,39,0.05)] ring-1 ring-[#eef1f6]">
              <div className="flex items-center gap-2 border-b border-[#eef1f6] px-4 py-3">
                <Plus size={15} className="text-maroon" strokeWidth={3} />
                <h3 className="text-[13px] font-black text-charcoal">Add Extras</h3>
              </div>
              <div className="divide-y divide-[#eef1f6]">
                {product.addons.map((addon) => {
                  const addonQuantity = addonQuantities[addon.id] ?? 0;
                  return (
                    <div
                      key={addon.id}
                      className="grid min-h-[52px] grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-black text-charcoal">{addon.name}</span>
                        <span className="mt-0.5 block text-[11px] font-black text-maroon">+{formatRupees(addon.price)}</span>
                      </span>
                      {addonQuantity > 0 ? (
                        <span className="grid h-9 w-[82px] grid-cols-3 overflow-hidden rounded-[10px] bg-red text-white shadow-[0_9px_20px_rgba(141,0,33,0.16)]">
                          <button type="button" className="grid place-items-center" onClick={() => decreaseAddon(addon.id)} aria-label={`Remove ${addon.name}`}>
                            <Minus size={11} strokeWidth={3} />
                          </button>
                          <span className="grid place-items-center text-[11px] font-black">{addonQuantity}</span>
                          <button type="button" className="grid place-items-center" onClick={() => addAddon(addon.id)} aria-label={`Add more ${addon.name}`}>
                            <Plus size={11} strokeWidth={3} />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="h-9 rounded-[10px] bg-red px-4 text-[11px] font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.16)]"
                          onClick={() => addAddon(addon.id)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-[16px] bg-white p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)] ring-1 ring-[#eef1f6]">
            <h3 className="text-[14px] font-black text-charcoal">About this dish</h3>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-muted">{product.description}</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-[16px] bg-white shadow-[0_10px_24px_rgba(17,24,39,0.05)] ring-1 ring-[#eef1f6]">
            <h3 className="border-b border-[#eef1f6] px-4 py-3 text-[14px] font-black text-charcoal">Product Info</h3>
            <div className="divide-y divide-[#eef1f6]">
              <div className="grid grid-cols-[1fr_auto] px-4 py-3 text-[12px] font-black">
                <span className="inline-flex items-center gap-2 text-muted"><TimerReset size={16} /> Prep Time</span>
                <span className="text-charcoal">{product.prepTimeMinutes}-{product.prepTimeMinutes + 5} min</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] px-4 py-3 text-[12px] font-black">
                <span className="text-muted">Serves</span>
                <span className="text-charcoal">{selectedVariant.name}</span>
              </div>
            </div>
          </div>

          {freeDeliveryThreshold ? (
            <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-[#f0d7dd] bg-[#fff4f5] px-4 py-3 text-maroon">
              <Truck size={20} strokeWidth={2.6} />
              <span className="text-[13px] font-black">Free delivery on orders above {formatRupees(freeDeliveryThreshold)}</span>
            </div>
          ) : null}

          {relatedProducts.length ? (
            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-[18px] font-black text-charcoal">You May Also Like</h3>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-black text-maroon">
                  View All <ChevronRight size={15} />
                </button>
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {relatedProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectProduct(item)}
                    className="w-[154px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-white text-left shadow-[0_8px_18px_rgba(34,31,32,0.055)] ring-1 ring-[#eef1f6]"
                  >
                    <span className="relative block aspect-[1.35/1] bg-[#f3f5f8]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </span>
                    <span className="block p-3">
                      <span className="line-clamp-1 text-[14px] font-black text-charcoal">{item.name}</span>
                      <span className="mt-1 line-clamp-1 text-[10px] font-black uppercase text-muted">{foodieCategoryLabel(item.category)}</span>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-1.5 py-0.5 text-[10px] font-black text-maroon">
                        <Star size={10} className="fill-maroon" /> {item.rating}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#eef1f6] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <div className={`grid items-center gap-3 ${selectedQuantity > 0 ? "grid-cols-[minmax(0,1fr)_112px]" : "grid-cols-[minmax(0,1fr)_58px]"}`}>
            <button
              type="button"
              onClick={() => onAdd(selectedVariant.id, selectedAddonIds)}
              disabled={orderingDisabled}
              className="grid h-13 min-w-0 grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 rounded-[15px] bg-maroon px-4 text-white shadow-[0_12px_28px_rgba(141,0,33,0.25)] disabled:bg-muted/40"
            >
              <ShoppingCart size={20} strokeWidth={3} />
              <span className="truncate text-left text-[13px] font-black">{selectedQuantity ? "ADD MORE" : "ADD TO CART"}</span>
              <span className="text-[13px] font-black">{formatRupees(totalPrice)}</span>
            </button>
            {selectedQuantity > 0 ? (
              <DetailQuantityControl quantity={selectedQuantity} onAdd={() => onAdd(selectedVariant.id, selectedAddonIds)} onDecrease={() => onDecrease(selectedVariant.id)} disabled={orderingDisabled} />
            ) : (
              <button type="button" className="grid h-13 place-items-center rounded-[15px] border border-[#e0e3ea] bg-white text-muted" aria-label="Save dish">
                <Heart size={24} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function MenuExperience({
  initialCategories = fallbackCategories,
  initialProducts = fallbackProducts,
  initialSlides,
  initialCategoryImages = {},
  initialCategoryOffers = {},
  initialCoupons = [],
  restaurantSettings,
  initialActiveCategory,
}: {
  initialCategories?: string[];
  initialProducts?: Product[];
  initialSlides?: HomeSlide[];
  initialCategoryImages?: Record<string, string>;
  initialCategoryOffers?: CategoryOfferMap;
  initialCoupons?: Coupon[];
  restaurantSettings?: RestaurantSettings;
  initialActiveCategory?: string;
}) {
  const categories = initialCategories;
  const products = initialProducts;
  const categoryOffers = initialCategoryOffers;
  const pathname = usePathname();
  const router = useRouter();
  const deliveryLocation = useDeliveryLocation();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<MenuFilterId[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!initialActiveCategory || initialActiveCategory === "All") return "All";
    return categories.includes(initialActiveCategory) ? initialActiveCategory : "All";
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mobileMenuView, setMobileMenuView] = useState<"home" | "categories" | "category">("home");
  const [mobileCategory, setMobileCategory] = useState("All");
  const [hiddenCartCount, setHiddenCartCount] = useState(0);
  const [cartBarClosing, setCartBarClosing] = useState(false);
  const cartOwnerId = customerSession?.mobile;
  const cart = useStoredCart(cartOwnerId);
  const savedProductIds = useStoredWishlist(cartOwnerId);
  const validCart = useMemo(() => getPricableCartLines(cart, products), [cart, products]);
  const storeMode = restaurantSettings?.storeMode ?? "OPEN";
  const orderingStatus = restaurantSettings ? getStoreOrderingStatus(restaurantSettings) : null;
  const outsideOrderingHours = orderingStatus?.outsideOrderingHours ?? false;
  const storeClosed = orderingStatus?.unavailable ?? false;
  const deliveryCoverage = restaurantSettings ? getDeliveryLocationCoverage(deliveryLocation, restaurantSettings) : null;
  const serviceable = deliveryCoverage?.serviceable ?? true;
  const orderingDisabled = storeClosed || !serviceable;
  const statusMessage = orderingStatus?.message ?? "Ordering is controlled by the restaurant.";

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const textMatch = !needle || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(needle);
      const filterMatch = productMatchesMenuFilters(product, activeFilters, categoryOffers);
      return product.available && categoryMatch && textMatch && filterMatch;
    });
  }, [activeCategory, activeFilters, categoryOffers, products, query]);

  const popularProducts = useMemo(() => {
    const bestsellers = visibleProducts.filter((product) => product.bestseller);
    const otherProducts = visibleProducts.filter((product) => !bestsellers.some((item) => item.id === product.id));
    return [...bestsellers, ...otherProducts];
  }, [visibleProducts]);

  const promoSlides = useMemo(() => {
    const slides = initialSlides?.length ? initialSlides : [
      {
        id: "wah-thali-default",
        eyebrow: "Wah Thali",
        title: "Delicious food at your doorstep",
        body: "Meals from Rs 99",
        code: "WAH99",
        image: "/wah-thali-meal-cutout-v2.png",
        active: true,
        sortOrder: 1,
      },
    ];
    return slides;
  }, [initialSlides]);

  useEffect(() => {
    function refreshSession() {
      setCustomerSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    if (promoSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % promoSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [promoSlides.length]);

  useEffect(() => {
    if (validCart.length !== cart.length) {
      writeStoredCart(validCart, cartOwnerId);
    }
  }, [cart, cartOwnerId, validCart]);

  useEffect(() => {
    if (!selectedProduct) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedProduct(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProduct]);

  function persist(next: CartLine[]) {
    writeStoredCart(next, cartOwnerId);
  }

  function addProduct(product: Product, variantId = product.variants[0]?.id ?? "regular", addonIds: string[] = []) {
    if (orderingDisabled) return;
    if (!cartOwnerId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const sortedAddonIds = [...addonIds].sort();
    const existingIndex = validCart.findIndex((line) =>
      line.productId === product.id &&
      line.variantId === variantId &&
      [...line.addonIds].sort().join("|") === sortedAddonIds.join("|"),
    );

    if (existingIndex >= 0) {
      persist(validCart.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line));
      return;
    }

    persist([...validCart, { productId: product.id, variantId, addonIds: sortedAddonIds, quantity: 1 }]);
  }

  function decreaseProduct(product: Product, variantId?: string) {
    const targetIndex = validCart.findIndex((line) =>
      line.productId === product.id && (!variantId || line.variantId === variantId),
    );
    if (targetIndex < 0) return;

    persist(
      validCart
        .map((line, index) => index === targetIndex ? { ...line, quantity: line.quantity - 1 } : line)
        .filter((line) => line.quantity > 0),
    );
  }

  function toggleSaved(product: Product) {
    if (!cartOwnerId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    writeStoredWishlist(
      savedProductIds.includes(product.id)
        ? savedProductIds.filter((id) => id !== product.id)
        : [...savedProductIds, product.id],
      cartOwnerId,
    );
  }

  function toggleFilter(filterId: MenuFilterId) {
    setActiveFilters((current) =>
      current.includes(filterId) ? current.filter((id) => id !== filterId) : [...current, filterId],
    );
  }

  function clearFilters() {
    setActiveFilters([]);
  }

  function closeCartBarWithFlyout() {
    if (cartCount === 0 || cartBarClosing) return;
    setCartBarClosing(true);
    window.setTimeout(() => {
      setHiddenCartCount(cartCount);
      setCartBarClosing(false);
    }, 240);
  }

  const categoryItems = ["All", ...categories];
  const allProductCategories = useMemo(
    () => Array.from(new Set([...categories, ...products.map((product) => product.category)])),
    [categories, products],
  );
  const mobileCategoryProducts = useMemo(() => {
    const source = mobileCategory === "All"
      ? products
      : products.filter((product) => product.category === mobileCategory);
    return source.filter((product) => product.available);
  }, [mobileCategory, products]);
  const searchGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allProductCategories
      .map((category) => {
        const items = products.filter((product) => {
          const matchesCategory = product.category === category;
          const matchesText = !needle || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(needle);
          const filterMatch = productMatchesMenuFilters(product, activeFilters, categoryOffers);
          return product.available && matchesCategory && matchesText && filterMatch;
        });
        return { category, items };
      })
      .filter((group) => group.items.length > 0);
  }, [activeFilters, allProductCategories, categoryOffers, products, query]);
  const cartCount = validCart.reduce((total, line) => total + line.quantity, 0);
  const cartSubtotal = useMemo(
    () => validCart.reduce((total, line) => total + getProductPrice(line, products), 0),
    [products, validCart],
  );
  const isHomePage = pathname === "/";
  const isSearchPage = pathname === "/menu";
  const showCartBar = cartCount > 0 && hiddenCartCount !== cartCount;
  const homeOfferCards = getHomeOfferCards(initialCoupons);

  if (storeClosed) {
    return (
      <main className="min-h-screen bg-white pb-24 text-charcoal">
        <Header showLocation />

        <section className="mx-auto flex min-h-[calc(100vh-170px)] max-w-xl flex-col items-center justify-center px-8 pb-28 text-center lg:min-h-[calc(100vh-74px)]">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[#fff4f5] text-maroon">
            <Store size={48} strokeWidth={2.6} />
          </div>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-red">Wah Thali is offline</p>
          <h1 className="mt-2 text-[30px] font-black leading-tight text-charcoal">Store is closed right now</h1>
          <p className="mt-4 max-w-[420px] text-[17px] font-semibold leading-7 text-muted">
            Please wait, we will start accepting orders during our opening hours.
          </p>
          <div className="mt-6 w-full rounded-[24px] border border-red/15 bg-[#fff8f9] p-5 text-left text-maroon">
            <p className="text-sm font-black uppercase tracking-wide">Opening hours</p>
            <p className="mt-2 text-2xl font-black">{restaurantSettings?.openingHours ?? "Opening hours will be updated soon"}</p>
            <p className="mt-2 text-sm font-bold">
              {outsideOrderingHours ? `Last orders close ${restaurantSettings?.lastOrderBufferMinutes ?? 30} minutes before closing.` : statusMessage}
            </p>
          </div>
          <Link href="/support" className="mt-7 inline-flex h-13 min-w-[220px] items-center justify-center rounded-2xl bg-maroon px-7 text-[16px] font-black text-white shadow-[0_14px_26px_rgba(141,0,33,0.2)]">
            Contact support
          </Link>
        </section>

        <MobileNav />
      </main>
    );
  }

  if (!serviceable) {
    return (
      <main className="min-h-screen bg-white pb-24 text-charcoal">
        <Header showLocation />

        <section className="flex min-h-[calc(100vh-170px)] flex-col items-center justify-center px-8 pb-28 text-center lg:min-h-[calc(100vh-74px)]">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[#fff4f5] text-maroon">
            <MapPin size={48} strokeWidth={2.7} />
          </div>
          <h1 className="mt-7 text-[28px] font-black leading-tight text-charcoal">Service Not Available</h1>
          <p className="mt-4 max-w-[340px] text-[17px] font-semibold leading-7 text-muted">
            {deliveryCoverage?.message ?? "We currently do not deliver to your selected location. Please change your location to explore our products."}
          </p>
          <Link href="/address" className="mt-8 inline-flex h-14 min-w-[230px] items-center justify-center rounded-2xl bg-maroon px-7 text-[17px] font-black text-white shadow-[0_14px_26px_rgba(141,0,33,0.2)]">
            Choose Location
          </Link>
        </section>

        <MobileNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-24 text-charcoal lg:pb-0">
      <div className={mobileMenuView === "category" || isSearchPage ? "hidden lg:block" : undefined}>
        <Header showLocation={isHomePage && mobileMenuView === "home"} />
      </div>

      {isSearchPage ? (
        <section className="min-h-screen bg-[#f7f8fc] px-6 pb-24 pt-1 lg:hidden">
          <div className="rounded-[26px] bg-[#d8f7e9] px-6 py-6 shadow-[0_12px_30px_rgba(17,24,39,0.04)]">
            <h1 className="max-w-[250px] text-[25px] font-black leading-[1.35] text-[#111827]">
              What are you
              <span className="block">looking for today?</span>
            </h1>
            <SearchFilterControl
              query={query}
              setQuery={setQuery}
              activeFilters={activeFilters}
              filtersOpen={filtersOpen}
              onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
              onToggleFilter={toggleFilter}
              onClearFilters={clearFilters}
              placeholder="Search fresh dishes"
              className="mt-6 shadow-[0_6px_16px_rgba(17,24,39,0.05)]"
            />
          </div>

          <div className="mt-4 grid gap-8">
            {searchGroups.length ? searchGroups.map((group) => (
              <section key={group.category}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[22px] font-black text-[#111827]">{shortCategoryName(group.category)}</h2>
                  <span className="text-[14px] font-black text-maroon">{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((product) => (
                    <FoodieProductCard
                      key={product.id}
                      product={product}
                      offer={getProductOffer(product, categoryOffers)}
                      quantity={getQuantity(validCart, product.id)}
                      saved={savedProductIds.includes(product.id)}
                      onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                      onDecrease={() => decreaseProduct(product)}
                      onOpen={() => setSelectedProduct(product)}
                      onToggleSave={() => toggleSaved(product)}
                      orderingDisabled={orderingDisabled}
                    />
                  ))}
                </div>
              </section>
            )) : (
              <div className="rounded-[20px] border border-[#e7ebf2] bg-white p-8 text-center shadow-[0_12px_28px_rgba(17,24,39,0.04)]">
                <Store className="mx-auto text-muted" size={32} />
                <h2 className="mt-4 text-[19px] font-black text-[#111827]">No dishes found</h2>
                <p className="mt-2 text-sm font-semibold text-muted">Try clearing filters or searching another dish.</p>
              </div>
            )}
          </div>
          <section className="pb-10 pt-10 text-center">
            <h2 className="text-[32px] font-black leading-[0.92] text-[#9aa1ad]">
              Live
              <span className="block">it up!</span>
            </h2>
            <p className="mt-3 flex items-center justify-center gap-1 text-[9px] font-black text-[#a7adba]">
              <span>Crafted with</span>
              <Heart size={11} className="fill-[#ff2446] text-[#ff2446]" />
              <span>in Kolkata, India</span>
            </p>
          </section>
        </section>
      ) : null}

      {isSearchPage ? (
        <DesktopSearchPage
          query={query}
          setQuery={setQuery}
          activeFilters={activeFilters}
          filtersOpen={filtersOpen}
          onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
          onToggleFilter={toggleFilter}
          onClearFilters={clearFilters}
          searchGroups={searchGroups}
          categoryOffers={categoryOffers}
          validCart={validCart}
          savedProductIds={savedProductIds}
          orderingDisabled={orderingDisabled}
          onAdd={(product) => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
          onDecrease={decreaseProduct}
          onOpen={setSelectedProduct}
          onToggleSave={toggleSaved}
        />
      ) : null}

      {mobileMenuView === "categories" ? (
        <section className="min-h-[calc(100vh-72px)] bg-[#f7f8fc] px-5 pb-24 pt-6 lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuView("home")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-maroon shadow-[0_8px_18px_rgba(17,24,39,0.06)] ring-1 ring-[#e8edf3]"
              aria-label="Back to home"
            >
              <ArrowLeft size={22} strokeWidth={3} />
            </button>
            <h1 className="text-[22px] font-black leading-tight text-[#111827]">All Categories</h1>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5">
            {categoryItems.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setMobileCategory(category);
                  setActiveCategory(category);
                  setMobileMenuView("category");
                }}
                className="grid h-[86px] place-items-center rounded-[16px] bg-[#f0f4fc] px-1 text-center shadow-[inset_0_0_0_1px_#e1e7f1]"
              >
                <span className="grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-full bg-white shadow-[0_8px_18px_rgba(34,31,32,0.08)]">
                  {category === "All" ? (
                    <Grid3X3 size={21} strokeWidth={3} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-[82%] w-[82%] rounded-full object-cover" loading="lazy" decoding="async" />
                  )}
                </span>
                <span className="max-w-[70px] truncate text-[11px] font-black leading-tight text-[#1f2937]">{shortCategoryName(category)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mobileMenuView === "category" ? (
        <section className="min-h-screen bg-[#f7f8fc] pb-24 lg:hidden">
          <div className="sticky top-0 z-40 grid h-[58px] grid-cols-[46px_1fr_46px] items-center border-b border-[#e7ebf2] bg-white px-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <button className="grid h-10 w-10 place-items-center text-maroon" onClick={() => setMobileMenuView("categories")} aria-label="Back to categories">
              <ArrowLeft size={25} strokeWidth={2.7} />
            </button>
            <h1 className="text-center text-[21px] font-black leading-none text-maroon">{shortCategoryName(mobileCategory)}</h1>
            <Link href="/cart" className="relative grid h-10 w-10 place-items-center text-maroon" aria-label="Cart">
              <ShoppingCart size={27} strokeWidth={2.6} />
              {cartCount ? <span className="absolute right-0.5 top-0 rounded-full bg-maroon px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
            </Link>
          </div>
          <div className="px-6 pt-11">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#111827]">{shortCategoryName(mobileCategory)} Products</h2>
              <span className="text-[18px] font-bold text-[#111827]">{mobileCategoryProducts.length} {mobileCategoryProducts.length === 1 ? "item" : "items"}</span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {mobileCategoryProducts.map((product) => (
                <FoodieProductCard
                  key={product.id}
                  product={product}
                  offer={getProductOffer(product, categoryOffers)}
                  quantity={getQuantity(validCart, product.id)}
                  saved={savedProductIds.includes(product.id)}
                  onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                  onDecrease={() => decreaseProduct(product)}
                  onOpen={() => setSelectedProduct(product)}
                  onToggleSave={() => toggleSaved(product)}
                  orderingDisabled={orderingDisabled}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className={`${isSearchPage ? "hidden" : mobileMenuView === "home" ? "grid" : "hidden lg:grid"} mx-auto w-full max-w-[1180px] gap-6 px-5 pt-3 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-5 xl:px-0`}>
        <aside className="sticky top-[98px] hidden max-h-[calc(100vh-118px)] overflow-y-auto rounded-2xl border border-[#f1e7e4] bg-white p-4 shadow-[0_14px_40px_rgba(34,31,32,0.04)] lg:block">
          <div className="mb-4 flex items-center gap-2 border-b border-[#f1e7e4] pb-4 text-sm font-black uppercase tracking-wide text-muted">
            <BookOpen size={18} />
            Categories
          </div>
          <div className="grid gap-2">
            {categoryItems.slice(0, 9).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`grid h-[50px] grid-cols-[34px_1fr] items-center gap-3 rounded-xl px-3 text-left text-sm font-black ${
                  activeCategory === category ? "bg-[#fff4f5] text-red shadow-sm" : "text-charcoal hover:bg-[#fff8f9]"
                }`}
              >
                <span className={`grid h-7 w-7 place-items-center overflow-hidden rounded-full ${activeCategory === category ? "bg-red text-white" : "bg-[#fff4f5]"}`}>
                  {category === "All" ? (
                    <Grid3X3 size={17} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={useFallbackImage} />
                  )}
                </span>
                <span className="truncate">{shortCategoryName(category)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          {isHomePage ? (
            <section className="relative mb-5 h-[166px] overflow-hidden rounded-[20px] bg-red shadow-[0_10px_24px_rgba(34,31,32,0.08)] lg:hidden">
              <Image
                src={promoSlides[activeSlide]?.image || "/wah-thali-meal-cutout-v2.png"}
                alt={promoSlides[activeSlide]?.title || "Wah Thali offer"}
                fill
                loading="eager"
                unoptimized
                sizes="366px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-red via-red/80 to-red/15" />
              <div className="grid h-full grid-cols-[52%_48%] items-center">
                <div className="relative z-10 px-4 text-white">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/80">Wah Thali offer</p>
                  <h1 className="mt-1 line-clamp-3 max-w-[172px] text-[20px] font-black leading-[1.02]">
                    {promoSlides[activeSlide]?.title || "Delicious food at your doorstep"}
                  </h1>
                  <p className="mt-1 text-[11px] font-black text-white/90">
                    {promoSlides[activeSlide]?.body || `Meals from ${formatRupees(99)}`}
                  </p>
                </div>
                <div className="relative h-full" />
              </div>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(index)}
                    className={`h-1.5 rounded-full ${index === activeSlide ? "w-4 bg-red" : "w-1.5 bg-white/80"}`}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="relative isolate hidden overflow-hidden rounded-[22px] bg-red shadow-[0_16px_36px_rgba(141,0,33,0.18)] lg:block">
            <Image
              src={promoSlides[activeSlide]?.image || "/wah-thali-meal-cutout-v2.png"}
              alt={promoSlides[activeSlide]?.title || "Wah Thali offer"}
              fill
              loading="eager"
              unoptimized
              sizes="(max-width: 1279px) 760px, 1000px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-red via-red/90 to-red/20" />
            <div className="relative grid h-[248px] grid-cols-[minmax(0,45%)_minmax(0,55%)] items-center gap-6 px-10">
              <div className="relative z-10 min-w-0 text-white">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Wah Thali offer</p>
                <h1 className="mt-2 line-clamp-2 max-w-[500px] text-[42px] font-black leading-[1.08]">
                  {promoSlides[activeSlide]?.title || "Delicious food at your doorstep"}
                </h1>
                <p className="mt-3 line-clamp-2 max-w-[440px] text-xl font-semibold text-white/85">
                  {promoSlides[activeSlide]?.body || `Meals from ${formatRupees(99)}`}
                </p>
                <div className="mt-4 inline-flex h-11 max-w-full items-center rounded-xl bg-white px-5 text-sm font-black text-red">
                  {promoSlides[activeSlide]?.code || "Order now"}
                </div>
              </div>
              <div className="relative h-full min-w-0" />
              <div className="absolute bottom-4 left-10 flex gap-2">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    className={`h-2 rounded-full transition-all ${index === activeSlide ? "w-7 bg-white" : "w-2 bg-white/60"}`}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </div>
          </section>

          <SearchFilterControl
            query={query}
            setQuery={setQuery}
            activeFilters={activeFilters}
            filtersOpen={filtersOpen}
            onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
            onToggleFilter={toggleFilter}
            onClearFilters={clearFilters}
            placeholder="Search dishes or cuisines"
            className="mt-5 lg:mt-6"
          />

          {storeMode !== "OPEN" ? (
            <section className="mt-5 rounded-2xl border border-red/20 bg-[#fff8f9] p-4 text-maroon">
              <div className="flex items-start gap-3">
                {storeMode === "BUSY" ? <TimerReset className="mt-0.5 shrink-0" size={22} /> : <Store className="mt-0.5 shrink-0 text-red" size={22} />}
                <div>
                  <p className="text-sm font-black uppercase tracking-wide">
                    {storeMode === "BUSY" ? "Kitchen busy" : storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
                  </p>
                  <p className="mt-1 text-sm font-bold">{statusMessage}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-5 lg:mt-6">
            <div className="flex justify-between gap-2 overflow-x-auto pb-3 lg:justify-between lg:overflow-visible">
              {categoryItems.slice(0, 5).map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    if (category !== "All") {
                      setMobileCategory(category);
                      setMobileMenuView("category");
                    }
                  }}
                  className="grid min-w-[48px] place-items-center gap-2 text-center"
                >
                  <span className={`grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border shadow-[0_8px_22px_rgba(34,31,32,0.06)] sm:h-20 sm:w-20 lg:h-20 lg:w-20 ${
                    activeCategory === category ? "border-red bg-red text-white" : "border-[#f1e7e4] bg-white text-charcoal"
                  }`}>
                    {category === "All" ? (
                      <Grid3X3 size={21} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-[72%] w-[72%] rounded-full object-cover" loading="lazy" decoding="async" onError={useFallbackImage} />
                    )}
                  </span>
                  <span className={`max-w-[54px] truncate text-[10px] font-black sm:max-w-20 sm:text-sm ${activeCategory === category ? "text-red" : "text-charcoal"}`}>
                    {shortCategoryName(category)}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMobileMenuView("categories")}
                className="grid min-w-[48px] place-items-center gap-2 text-center"
              >
                <span className="grid h-[52px] w-[52px] place-items-center rounded-full border border-[#f1e7e4] bg-[#f8fafc] text-charcoal shadow-[0_8px_22px_rgba(34,31,32,0.06)] sm:h-20 sm:w-20 lg:h-20 lg:w-20">
                  <Grid3X3 size={21} />
                </span>
                <span className="max-w-[54px] truncate text-[10px] font-black text-charcoal sm:max-w-20 sm:text-sm">More</span>
              </button>
            </div>
          </section>

          <section id="menu-items" className="mt-6 border-t-[5px] border-[#c8c8c8] pt-7 pb-16 lg:mt-5 lg:border-t-0 lg:pt-0 lg:pb-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="foodie-display text-[30px] leading-none text-charcoal lg:font-sans lg:text-[26px] lg:font-black">Popular Dishes</h2>
              <button onClick={() => setActiveCategory("All")} className="inline-flex items-center gap-1 text-[11px] font-black text-maroon lg:text-xs">
                View all <ChevronRight size={11} />
              </button>
            </div>
            {popularProducts.length ? (
              <>
              <div className="flex snap-x gap-3.5 overflow-x-auto pb-5 lg:hidden">
                {popularProducts.slice(0, 6).map((product) => (
                  <div key={product.id} className="w-[clamp(140px,42vw,178px)] shrink-0 snap-start">
                    <FoodieProductCard
                      product={product}
                      offer={getProductOffer(product, categoryOffers)}
                      quantity={getQuantity(validCart, product.id)}
                      saved={savedProductIds.includes(product.id)}
                      onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                      onDecrease={() => decreaseProduct(product)}
                      onOpen={() => setSelectedProduct(product)}
                      onToggleSave={() => toggleSaved(product)}
                      orderingDisabled={orderingDisabled}
                    />
                  </div>
                ))}
              </div>
              <div className="hidden gap-4 pb-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                {popularProducts.slice(0, 9).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    offer={getProductOffer(product, categoryOffers)}
                    quantity={getQuantity(validCart, product.id)}
                    saved={savedProductIds.includes(product.id)}
                    onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                    onDecrease={() => decreaseProduct(product)}
                    onOpen={() => setSelectedProduct(product)}
                    onToggleSave={() => toggleSaved(product)}
                    orderingDisabled={orderingDisabled}
                  />
                ))}
              </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[#f1e7e4] bg-white p-8 text-center">
                <Store className="mx-auto text-muted" />
                <h3 className="mt-3 text-lg font-black text-charcoal">No items found</h3>
                <p className="mt-1 text-sm text-muted">Try thali, biryani, chicken, paneer, or dessert.</p>
              </div>
            )}
          </section>

          <section className="mt-2 pb-8 lg:mt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-black text-charcoal lg:text-3xl">Best Offers for You</h2>
              <Link href="/offers" className="inline-flex items-center gap-1 text-[11px] font-black text-maroon lg:text-sm">
                View all <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {homeOfferCards.map((offer) => (
                <article key={offer.code} className={`min-h-[96px] rounded-[12px] p-5 lg:min-h-[112px] ${offer.classes}`}>
                  <div className="flex h-full items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-black leading-tight">
                        {offer.title} <span className="text-[10px]">{offer.subtitle}</span>
                      </h3>
                      <p className="mt-4 inline-flex max-w-full rounded-lg bg-white/55 px-3 py-2 text-[9px] font-black">
                        <span className="truncate">Use Code: {offer.code}</span>
                      </p>
                    </div>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/35">
                      <offer.Icon size={29} strokeWidth={2.6} />
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#f1e7e4] pt-5 lg:grid-cols-4 lg:gap-x-10 lg:pt-7">
              {[
                ["No Minimum Order", "Order in for yourself"],
                ["Lightning Delivery", "On selected locations"],
                ["Best Quality", "Satisfaction guaranteed"],
                ["Safe & Secure", "100% secure payments"],
              ].map(([title, body]) => (
                <div key={title} className="grid grid-cols-[24px_1fr] gap-2 lg:grid-cols-[36px_1fr] lg:gap-4">
                  <span className="grid h-6 w-6 place-items-center text-[#ff6b00] lg:h-9 lg:w-9">
                    {title === "No Minimum Order" ? (
                      <ShoppingBag className="h-5 w-5 lg:h-8 lg:w-8" strokeWidth={2.7} />
                    ) : title === "Lightning Delivery" ? (
                      <Zap className="h-5 w-5 lg:h-8 lg:w-8" strokeWidth={2.7} />
                    ) : title === "Best Quality" ? (
                      <BadgeCheck className="h-5 w-5 lg:h-8 lg:w-8" strokeWidth={2.7} />
                    ) : (
                      <LockKeyhole className="h-5 w-5 lg:h-8 lg:w-8" strokeWidth={2.7} />
                    )}
                  </span>
                  <span>
                    <span className="block text-[10px] font-black text-charcoal lg:text-base">{title}</span>
                    <span className="mt-0.5 block text-[8px] font-semibold text-muted lg:mt-1 lg:text-sm">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {isHomePage ? (
            <section className="pb-20 pt-4 text-center lg:pb-14 lg:pt-8">
              <h2 className="text-[32px] font-black leading-[0.92] text-[#9aa1ad] lg:text-[42px]">
                Live
                <span className="block">it up!</span>
              </h2>
              <p className="mt-3 flex items-center justify-center gap-1 text-[9px] font-black text-[#a7adba] lg:text-xs">
                <span>Crafted with</span>
                <Heart size={11} className="fill-[#ff2446] text-[#ff2446]" />
                <span>in Kolkata, India</span>
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <DesktopTrustFooter categories={categoryItems} />

      <div
        className={`fixed bottom-[72px] left-0 right-0 z-[60] px-5 transition-all duration-300 ease-out lg:bottom-6 ${
          cartBarClosing
            ? "pointer-events-none translate-y-3 opacity-0"
            : showCartBar
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
        }`}
        aria-live="polite"
      >
        <div className="mx-auto grid h-14 max-w-[320px] grid-cols-[1fr_auto_34px] items-center gap-3 rounded-[16px] bg-charcoal px-4 text-white shadow-[0_16px_34px_rgba(34,31,32,0.28)] lg:max-w-[380px]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red text-white">
              <ShoppingCart size={16} strokeWidth={3} />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] font-black text-red">
                {cartCount}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black leading-none">{cartCount} {cartCount === 1 ? "Item" : "Items"}</span>
              <span className="mt-1 block text-[11px] font-black leading-none">{formatRupees(cartSubtotal)}</span>
            </span>
          </div>
          <Link href="/cart" className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-5 text-[12px] font-black text-red">
            View Cart <ChevronRight size={15} strokeWidth={3} />
          </Link>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-white/85 hover:bg-white/10"
            onClick={closeCartBarWithFlyout}
            aria-label="Hide cart bar"
          >
            <X size={17} strokeWidth={3} />
          </button>
        </div>
      </div>

      <MobileNav />

      {selectedProduct ? (
        <DishDetailSheet
          key={selectedProduct.id}
          product={selectedProduct}
          getQuantityForVariant={(variantId) => getVariantQuantity(validCart, selectedProduct.id, variantId)}
          onAdd={(variantId, addonIds) => addProduct(selectedProduct, variantId, addonIds)}
          onDecrease={(variantId) => decreaseProduct(selectedProduct, variantId)}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={setSelectedProduct}
          orderingDisabled={orderingDisabled}
          offer={getProductOffer(selectedProduct, categoryOffers)}
          freeDeliveryThreshold={restaurantSettings?.freeDeliveryThreshold}
          relatedProducts={products
            .filter((product) => product.id !== selectedProduct.id && product.available && product.category === selectedProduct.category)
            .slice(0, 4)}
          cartCount={cartCount}
        />
      ) : null}

    </main>
  );
}

function getCategoryImage(category: string, images: Record<string, string>, products: Product[]) {
  const direct = images[slugifyCategory(category)];
  if (direct) return direct;
  const matchingProduct = products.find((product) => product.category === category);
  return matchingProduct?.image ?? "/wah-thali-meal-cutout-v2.png";
}

function useFallbackImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
}

function getProductOffer(product: Product, categoryOffers: CategoryOfferMap) {
  return product.offer?.trim() || categoryOffers[slugifyCategory(product.category)]?.trim() || undefined;
}

function getHomeOfferCards(coupons: Coupon[]) {
  const classes = [
    "bg-[#e8f7ed] text-[#16833d]",
    "bg-[#fff0e8] text-[#c95000]",
    "bg-[#f3ecff] text-[#6c35d5]",
  ];
  const icons = [Truck, Bike, BadgePercent];
  const priorityCodes = ["PARTY", "FREEDEL", "YUMMY"];
  const orderedCoupons = [
    ...priorityCodes.flatMap((code) => coupons.filter((coupon) => coupon.code === code)),
    ...coupons.filter((coupon) => !priorityCodes.includes(coupon.code)),
  ];

  return orderedCoupons.slice(0, 3).map((coupon, index) => ({
    code: coupon.code,
    title: getCouponOfferTitle(coupon),
    subtitle: getCouponOfferSubtitle(coupon),
    classes: classes[index % classes.length],
    Icon: icons[index % icons.length],
  }));
}

function getCouponOfferTitle(coupon: Coupon) {
  if (coupon.label.toLowerCase().includes("free delivery")) return "FREE DELIVERY";
  if (coupon.type === "PERCENT") return `${coupon.value}% OFF`;
  return `SAVE ${formatRupees(coupon.value)}`;
}

function getCouponOfferSubtitle(coupon: Coupon) {
  if (coupon.type === "PERCENT" && coupon.maxDiscount) return `up to ${formatRupees(coupon.maxDiscount)}`;
  if (coupon.minOrder > 0) return `on orders above ${formatRupees(coupon.minOrder)}`;
  return "on your order";
}

function shortCategoryName(category: string) {
  const compact = category
    .replace("Chef's Recommendations", "Chef")
    .replace("Exclusive ", "")
    .replace("Kolkata ", "")
    .replace(" Combo", "");

  return compact.length > 14 ? compact.split(" ")[0] : compact;
}

function foodieCategoryLabel(category: string) {
  return category
    .replace("Exclusive Thali", "Indian, North Indi...")
    .replace("Mini Thali", "Indian")
    .replace("Meal at 99", "Indian")
    .replace("Kolkata Biryani", "Fast Food, Cuisines")
    .replace("Biryani Combo", "Fast Food, Cuisines")
    .replace("Chinese Combo", "Fast Food, Cuisines")
    .replace("Indian Combo", "Indian, North Indi...")
    .replace("Subscription Meals", "Fast Food, Cuisines")
    .toUpperCase();
}

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
