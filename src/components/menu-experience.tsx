"use client";

import { useDeferredValue, useEffect, useMemo, useState, type SyntheticEvent } from "react";
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
import { DesktopTrustFooter } from "@/components/desktop-trust-footer";
import { categories as fallbackCategories, products as fallbackProducts } from "@/lib/data";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { getDeliveryLocationCoverage, useDeliveryLocationState } from "@/lib/delivery-location";
import { getModifierSelectionIssue, getProductModifierGroups } from "@/lib/product-modifiers";
import { formatRupees, getPricableCartLines, getProductPrice, getProductUnitPricing } from "@/lib/pricing";
import { getStoreOrderingStatus } from "@/lib/store-hours";
import { useStoredCart } from "@/lib/use-stored-cart";
import { useStoredWishlist } from "@/lib/use-stored-wishlist";
import type { CartLine, CategoryOfferMap, CategoryOption, Coupon, HomeSlide, Product, RestaurantSettings } from "@/lib/types";
import { writeStoredWishlist } from "@/lib/wishlist-storage";

function getVariantQuantity(lines: CartLine[], productId: string, variantId: string) {
  return lines
    .filter((line) => line.productId === productId && line.variantId === variantId)
    .reduce((total, line) => total + line.quantity, 0);
}

type MenuFilterId = "veg" | "offers" | "bestseller" | "rating" | "under199";
type PriceSortId = "priceLowHigh" | "priceHighLow";
type SearchGroup = { category: string; itemCount: number; subgroups: { category: string; items: Product[] }[] };

const menuFilterOptions: { id: MenuFilterId; label: string; helper: string }[] = [
  { id: "veg", label: "Pure Veg", helper: "Veg and Jain dishes" },
  { id: "offers", label: "Offers", helper: "Deals and discounts" },
  { id: "bestseller", label: "Bestseller", helper: "Most loved dishes" },
  { id: "rating", label: "Rating 4.5+", helper: "Top rated items" },
  { id: "under199", label: "Under Rs 199", helper: "Budget picks" },
];
const priceSortOptions: { id: PriceSortId; label: string; helper: string }[] = [
  { id: "priceLowHigh", label: "Price Low to High", helper: "Show lowest price first" },
  { id: "priceHighLow", label: "Price High to Low", helper: "Show highest price first" },
];

function MenuFilterIcon({ filterId, className }: { filterId: MenuFilterId; className?: string }) {
  if (filterId === "veg") return <Leaf size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "offers") return <BadgePercent size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "bestseller") return <BadgeCheck size={15} strokeWidth={2.6} className={className} />;
  if (filterId === "rating") return <Star size={15} strokeWidth={2.6} className={className} />;
  return <IndianRupee size={15} strokeWidth={2.6} className={className} />;
}

function productMatchesMenuFilters(product: Product, activeFilters: MenuFilterId[], categoryOffers: CategoryOfferMap) {
  if (!activeFilters.length) return true;

  return activeFilters.every((filterId) => {
    if (filterId === "veg") return product.dietaryType === "VEG" || product.dietaryType === "JAIN";
    if (filterId === "offers") return Boolean(getProductOffer(product, categoryOffers) || product.originalPrice);
    if (filterId === "bestseller") return Boolean(product.bestseller);
    if (filterId === "rating") return product.rating >= 4.5;
    return product.price <= 199;
  });
}

function SearchFilterControl({
  query,
  setQuery,
  activeFilters,
  priceSort,
  filtersOpen,
  onToggleFiltersOpen,
  onToggleFilter,
  onChoosePriceSort,
  onClearFilters,
  placeholder,
  className = "",
}: {
  query: string;
  setQuery: (value: string) => void;
  activeFilters: MenuFilterId[];
  priceSort: PriceSortId | null;
  filtersOpen: boolean;
  onToggleFiltersOpen: () => void;
  onToggleFilter: (filterId: MenuFilterId) => void;
  onChoosePriceSort: (sortId: PriceSortId) => void;
  onClearFilters: () => void;
  placeholder: string;
  className?: string;
}) {
  const activeFilterCount = activeFilters.length + (priceSort ? 1 : 0);

  return (
    <section className={`rounded-[16px] border border-[#eef1f6] bg-white px-2 py-1.5 shadow-[0_8px_22px_rgba(34,31,32,0.05)] ${className}`}>
      <div className="grid h-11 grid-cols-[42px_1fr_auto] items-center gap-1 lg:h-12">
        <Search size={20} className="mx-auto text-[#68707c]" strokeWidth={2.4} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 bg-transparent text-[11px] font-semibold text-charcoal outline-none placeholder:text-muted lg:text-[13px]"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleFiltersOpen}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-2.5 text-[10px] font-black transition-colors lg:px-3 lg:text-[11px] ${
            activeFilterCount ? "bg-red text-white" : "bg-[#f7f8fc] text-charcoal ring-1 ring-[#e7ebf2]"
          }`}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} strokeWidth={2.7} />
          <span>Filters</span>
          {activeFilterCount ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-red">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="wt-horizontal-scroll mt-2 flex gap-2 pb-1">
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
          {priceSortOptions.map((option) => {
            const selected = priceSort === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChoosePriceSort(option.id)}
                title={option.helper}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black transition-colors ${
                  selected
                    ? "border-red bg-red text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]"
                    : "border-[#e5e9f0] bg-white text-[#374151] hover:border-red/40 hover:text-red"
                }`}
                aria-pressed={selected}
              >
                <IndianRupee size={15} strokeWidth={2.6} />
                {option.label}
              </button>
            );
          })}
          {activeFilterCount ? (
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
  disabledLabel = "Closed",
  wide = false,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  disabled: boolean;
  disabledLabel?: string;
  wide?: boolean;
}) {
  if (disabled) {
    return (
      <button disabled className={`${wide ? "min-w-[132px] shrink-0" : ""} h-8 rounded-[8px] bg-[#f2eef0] px-3 text-[10px] font-black text-muted sm:h-9 sm:px-4 sm:text-xs`}>
        {disabledLabel}
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

function BestSellerBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`pointer-events-none inline-flex h-5 items-center rounded-full bg-maroon px-2 text-[8px] font-black uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(141,0,33,0.22)] ${className}`}>
      Best Seller
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
  const unavailable = !product.available;
  const pricing = getProductUnitPricing(product, offer ? { [slugifyCategory(product.category)]: offer } : {});
  return (
    <article className={`group min-w-[104px] overflow-hidden rounded-[20px] border border-[#f0e8e2] bg-white shadow-[0_10px_22px_rgba(34,31,32,0.055)] transition duration-200 hover:-translate-y-1 hover:border-maroon/25 hover:shadow-[0_20px_42px_rgba(34,31,32,0.12)] sm:min-w-0 sm:rounded-[26px] sm:shadow-[0_14px_34px_rgba(34,31,32,0.07)] ${unavailable ? "grayscale" : ""}`}>
      <div className="relative aspect-[1.58/1] w-full overflow-hidden bg-[#f6f1ed] transition duration-300 group-hover:bg-[#fff4f5] sm:aspect-[1.42/1]">
        <button className="block h-full w-full text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className={`h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.08] group-hover:saturate-[1.08] ${unavailable ? "opacity-70" : ""}`} loading="lazy" decoding="async" onError={useFallbackImage} />
        </button>
        <span className="pointer-events-none absolute inset-0 opacity-0 ring-2 ring-inset ring-maroon/25 transition-opacity duration-300 group-hover:opacity-100" />
        {product.bestseller ? <BestSellerBadge className="absolute left-1.5 top-1.5 sm:left-3 sm:top-3" /> : null}
        {unavailable ? <span className="absolute inset-x-3 bottom-3 rounded-lg bg-charcoal/82 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white">Unavailable</span> : null}
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
              <h3 className="line-clamp-1 min-w-0 text-[10px] font-black leading-tight text-charcoal sm:text-[13px]">{product.name}</h3>
              <DietMark type={product.dietaryType} compact />
            </span>
            <p className="mt-1 line-clamp-1 text-[8px] font-black uppercase tracking-wide text-muted sm:text-[10px]">{product.category}</p>
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[8px] font-bold text-muted sm:mt-2.5 sm:gap-2 sm:text-[11px]">
          <span className="inline-flex items-center gap-0.5 rounded-[5px] bg-[#fff3f5] px-1 py-0.5 font-black text-red sm:gap-1 sm:px-2 sm:py-1">
            <Star size={8} className="fill-red sm:h-[11px] sm:w-[11px]" />
            {product.rating}
          </span>
        </div>

        {offer ? <p className="mt-1.5 line-clamp-1 text-[8px] font-black text-maroon sm:mt-2.5 sm:text-[11px]">{offer}</p> : null}

        <div className={`${offer ? "mt-2.5 sm:mt-3" : "mt-2 sm:mt-2.5"} flex items-center justify-between gap-1.5 sm:gap-3`}>
          <span className="min-w-0">
            {pricing.discountPerUnit > 0 ? <span className="block text-[8px] font-bold text-muted line-through sm:text-[11px]">{formatRupees(pricing.originalUnitPrice)}</span> : null}
            <span className="block text-[10px] font-black text-charcoal sm:text-[13px]">{formatRupees(pricing.unitPrice)}</span>
          </span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} disabled={orderingDisabled || unavailable} disabledLabel={unavailable ? "Unavailable" : "Orders closed"} />
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
  const unavailable = !product.available;
  const pricing = getProductUnitPricing(product, offer ? { [slugifyCategory(product.category)]: offer } : {});
  return (
    <article className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_8px_18px_rgba(34,31,32,0.055)] ring-1 ring-[#eef1f6] transition duration-200 hover:-translate-y-1 hover:ring-maroon/25 hover:shadow-[0_18px_38px_rgba(34,31,32,0.12)] ${unavailable ? "grayscale" : ""}`}>
      <div className="relative aspect-[1.55/1] overflow-hidden bg-[#f3f5f8] transition duration-300 group-hover:bg-[#fff4f5]">
        <button className="block h-full w-full text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className={`h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.08] group-hover:saturate-[1.08] ${unavailable ? "opacity-70" : ""}`} loading="lazy" decoding="async" onError={useFallbackImage} />
        </button>
        <span className="pointer-events-none absolute inset-0 opacity-0 ring-2 ring-inset ring-maroon/25 transition-opacity duration-300 group-hover:opacity-100" />
        {product.bestseller ? <BestSellerBadge className="absolute left-2 top-2" /> : null}
        {unavailable ? <span className="absolute inset-x-3 bottom-3 rounded-lg bg-[#111827]/85 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white">Unavailable</span> : null}
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
            <h3 className="line-clamp-1 min-w-0 text-[12px] font-black leading-tight text-[#111827]">{product.name}</h3>
            <DietMark type={product.dietaryType} compact />
          </span>
          <p className="mt-1 line-clamp-1 text-[9px] font-black uppercase tracking-wide text-[#a0a6b0]">{foodieCategoryLabel(product.category)}</p>
        </button>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-extrabold text-[#5f6875]">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-1.5 py-0.5 font-black text-maroon">
            <Star size={10} className="fill-maroon" />
            {product.rating}
          </span>
        </div>
        {offer ? (
          <div className="mt-1.5 border-t border-[#eef1f6] pt-1.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-[#078b52]">
              <BadgePercent size={14} strokeWidth={2.6} />
              {offer}
            </p>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="min-w-0">
            {pricing.discountPerUnit > 0 ? <span className="block text-[10px] font-bold text-[#98a0ad] line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
            <span className="block text-[12px] font-black text-[#111827]">{formatRupees(pricing.unitPrice)}</span>
          </span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} disabled={orderingDisabled || unavailable} disabledLabel={unavailable ? "Unavailable" : "Orders closed"} />
        </div>
      </div>
    </article>
  );
}

function DesktopSearchPage({
  query,
  setQuery,
  activeFilters,
  priceSort,
  filtersOpen,
  onToggleFiltersOpen,
  onToggleFilter,
  onChoosePriceSort,
  onClearFilters,
  searchGroups,
  categoryOffers,
  quantityByProduct,
  savedProductIdSet,
  orderingDisabled,
  onAdd,
  onDecrease,
  onOpen,
  onToggleSave,
}: {
  query: string;
  setQuery: (value: string) => void;
  activeFilters: MenuFilterId[];
  priceSort: PriceSortId | null;
  filtersOpen: boolean;
  onToggleFiltersOpen: () => void;
  onToggleFilter: (filterId: MenuFilterId) => void;
  onChoosePriceSort: (sortId: PriceSortId) => void;
  onClearFilters: () => void;
  searchGroups: SearchGroup[];
  categoryOffers: CategoryOfferMap;
  quantityByProduct: Map<string, number>;
  savedProductIdSet: Set<string>;
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
              priceSort={priceSort}
              filtersOpen={filtersOpen}
              onToggleFiltersOpen={onToggleFiltersOpen}
              onToggleFilter={onToggleFilter}
              onChoosePriceSort={onChoosePriceSort}
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
                <h2 className="text-[26px] font-black text-[#111827]">{group.category}</h2>
                <span className="rounded-full bg-[#fff4f5] px-3 py-1 text-xs font-black text-maroon">{group.itemCount} {group.itemCount === 1 ? "item" : "items"}</span>
              </div>
              <div className="grid gap-7">
                {group.subgroups.map((subgroup) => (
                  <div key={`${group.category}-${subgroup.category}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-black uppercase text-[#667085]">{subgroup.category}</h3>
                      <span className="text-[11px] font-black text-maroon">{subgroup.items.length} {subgroup.items.length === 1 ? "item" : "items"}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-5">
                      {subgroup.items.map((product) => (
                        <FoodieProductCard
                          key={product.id}
                          product={product}
                          offer={getProductOffer(product, categoryOffers)}
                          quantity={quantityByProduct.get(product.id) ?? 0}
                          saved={savedProductIdSet.has(product.id)}
                          onAdd={() => onAdd(product)}
                          onDecrease={() => onDecrease(product)}
                          onOpen={() => onOpen(product)}
                          onToggleSave={() => onToggleSave(product)}
                          orderingDisabled={orderingDisabled}
                        />
                      ))}
                    </div>
                  </div>
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
  saved,
  onToggleSave,
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
  saved: boolean;
  onToggleSave: () => void;
}) {
  const defaultVariantId = product.variants[0]?.id ?? "regular";
  const variants = product.variants.length ? product.variants : [{ id: defaultVariantId, name: "Regular", price: 0 }];
  const modifierGroups = useMemo(() => getProductModifierGroups(product), [product]);
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
  const pricing = getProductUnitPricing(product, offer ? { [slugifyCategory(product.category)]: offer } : {}, selectedVariant.price, addonTotal);
  const totalPrice = pricing.unitPrice;
  const unavailable = !product.available;
  const modifierSelectionIssue = getModifierSelectionIssue(modifierGroups, addonQuantities);
  const addDisabled = orderingDisabled || unavailable || Boolean(modifierSelectionIssue);

  function canSelectMore(groupId: string) {
    const group = modifierGroups.find((item) => item.id === groupId);
    if (!group || group.max <= 0) return true;
    const selectedCount = group.options.reduce((total, option) => total + (addonQuantities[option.id] ?? 0), 0);
    return selectedCount < group.max;
  }

  function selectSingleAddon(groupId: string, addonId: string) {
    setAddonQuantities((current) => ({
      ...Object.fromEntries(
        Object.entries(current).filter(([currentAddonId]) => {
          const group = modifierGroups.find((item) => item.id === groupId);
          return !group?.options.some((option) => option.id === currentAddonId);
        }),
      ),
      [addonId]: 1,
    }));
  }

  function toggleMultiAddon(groupId: string, addonId: string) {
    setAddonQuantities((current) => {
      if (current[addonId]) {
        const next = { ...current };
        delete next[addonId];
        return next;
      }
      if (!canSelectMore(groupId)) return current;
      return { ...current, [addonId]: 1 };
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
        <div className="pointer-events-none fixed left-1/2 top-4 z-[3] flex w-full max-w-[430px] -translate-x-1/2 items-center justify-between px-4">
          <button
            type="button"
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/95 text-charcoal shadow-lg ring-1 ring-white/70"
            onClick={onClose}
            aria-label="Close dish details"
          >
            <ArrowLeft size={22} strokeWidth={3} />
          </button>
          <Link href="/cart" className="pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full bg-white/95 text-maroon shadow-lg ring-1 ring-white/70" aria-label="Open cart">
            <ShoppingCart size={21} strokeWidth={2.7} />
            {cartCount ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-maroon px-1.5 text-[9px] font-black text-white ring-2 ring-white">{cartCount}</span> : null}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+92px)]">
          <div className="relative h-[242px] bg-[#f6f1ed]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-b from-charcoal/24 via-transparent to-charcoal/10" />
            <span className="absolute bottom-4 left-4">
              <DietMark type={product.dietaryType} />
            </span>
          </div>

          <div className="px-5 pt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">{product.category}</p>
            <h2 id="dish-detail-title" className="mt-1.5 text-[22px] font-black leading-tight text-charcoal">
                {product.name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-black text-muted">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck size={12} className="text-maroon" /> {product.rating}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2.5">
              <span className="text-[26px] font-black leading-none text-charcoal">{formatRupees(totalPrice)}</span>
              {pricing.discountPerUnit > 0 ? <span className="text-sm font-bold text-muted line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
            </div>

          {product.variants.length ? (
          <div className="mt-4">
            <h3 className="text-[12px] font-semibold text-charcoal">Select Size</h3>
            <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2.5">
              {variants.map((variant) => {
                const active = variant.id === selectedVariant.id;
                const variantPricing = getProductUnitPricing(product, offer ? { [slugifyCategory(product.category)]: offer } : {}, variant.price);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`min-h-[74px] rounded-[13px] border bg-white p-2 text-center shadow-[0_8px_16px_rgba(17,24,39,0.04)] transition-colors ${
                      active ? "border-maroon text-maroon" : "border-[#eef1f6] text-muted"
                    }`}
                  >
                    <span className={`mx-auto grid h-4 w-4 place-items-center rounded-full ${active ? "bg-maroon text-white" : "bg-[#f2f4f7] text-transparent"}`}>
                      <BadgeCheck size={10} strokeWidth={3} />
                    </span>
                    <span className="mt-1.5 block text-[10px] font-semibold">{variant.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold">{formatRupees(variantPricing.unitPrice)}</span>
                    {variantPricing.discountPerUnit > 0 ? <span className="mt-0.5 block text-[9px] font-medium text-muted line-through">{formatRupees(variantPricing.originalUnitPrice)}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          ) : null}

          {modifierGroups.length ? (
            <div className="mt-4 grid gap-3">
              {modifierGroups.map((group) => {
                const selectedCount = group.options.reduce((total, option) => total + (addonQuantities[option.id] ?? 0), 0);
                const helper = group.required
                  ? `Required - Select ${Math.max(1, group.min) === 1 ? "any 1 option" : `any ${Math.max(1, group.min)} options`}`
                  : group.max > 0
                    ? `Select up to ${group.max} ${group.max === 1 ? "option" : "options"}`
                    : "Optional";

                return (
                  <div key={group.id} className="overflow-hidden rounded-[14px] bg-white shadow-[0_8px_18px_rgba(17,24,39,0.045)] ring-1 ring-[#eef1f6]">
                    <div className="border-b border-[#eef1f6] px-4 py-2.5">
                      <h3 className="text-[13px] font-semibold capitalize text-charcoal">{group.title}</h3>
                      <p className="mt-0.5 text-[10px] font-medium text-muted">{helper}</p>
                    </div>
                    <div className="divide-y divide-[#eef1f6]">
                      {group.options.map((addon) => {
                        const selected = Boolean(addonQuantities[addon.id]);
                        const disabled = group.kind === "multi" && !selected && !canSelectMore(group.id);

                        return (
                          <button
                            key={addon.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => group.kind === "single" ? selectSingleAddon(group.id, addon.id) : toggleMultiAddon(group.id, addon.id)}
                            className="grid min-h-[48px] w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-2 text-left disabled:opacity-45"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <DietMark type={addon.dietaryType ?? product.dietaryType} compact />
                              <span className="min-w-0">
                                <span className="block truncate text-[12px] font-medium text-charcoal">{addon.name}</span>
                                {addon.price > 0 ? <span className="mt-0.5 block text-[10px] font-semibold text-maroon">+{formatRupees(addon.price)}</span> : null}
                              </span>
                            </span>
                            <span className={`grid h-5 w-5 place-items-center border-2 ${
                              group.kind === "single" ? "rounded-full" : "rounded-[4px]"
                            } ${selected ? "border-red" : "border-[#ff5b70]"}`}>
                              <span className={`${group.kind === "single" ? "h-2.5 w-2.5 rounded-full" : "h-3 w-3 rounded-[2px]"} ${selected ? "bg-red" : "bg-transparent"}`} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {group.max > 0 && group.kind === "multi" ? (
                      <p className="border-t border-[#eef1f6] bg-[#f8fafc] px-4 py-1.5 text-[10px] font-medium text-muted">
                        {selectedCount}/{group.max} selected
                      </p>
                    ) : null}
                  </div>
                );
              })}
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
              <div className="wt-horizontal-scroll flex gap-3 pb-2">
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
          {unavailable ? <p className="mb-2 rounded-xl bg-[#f2f4f7] px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-[#4b5563]">Currently unavailable</p> : null}
          {modifierSelectionIssue ? <p className="mb-2 rounded-xl bg-[#fff4f5] px-3 py-2 text-center text-xs font-black text-maroon">{modifierSelectionIssue}</p> : null}
          <div className={`grid items-center gap-3 ${selectedQuantity > 0 ? "grid-cols-[minmax(0,1fr)_112px]" : "grid-cols-[minmax(0,1fr)_58px]"}`}>
            <button
              type="button"
              onClick={() => onAdd(selectedVariant.id, selectedAddonIds)}
              disabled={addDisabled}
              className="grid h-13 min-w-0 grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 rounded-[15px] bg-maroon px-4 text-white shadow-[0_12px_28px_rgba(141,0,33,0.25)] disabled:bg-muted/40"
            >
              <ShoppingCart size={20} strokeWidth={3} />
              <span className="truncate text-left text-[13px] font-black">{modifierSelectionIssue || (orderingDisabled ? "ORDERS CLOSED" : selectedQuantity ? "ADD MORE" : "ADD TO CART")}</span>
              <span className="text-[13px] font-black">{formatRupees(totalPrice)}</span>
            </button>
            {selectedQuantity > 0 ? (
              <DetailQuantityControl quantity={selectedQuantity} onAdd={() => onAdd(selectedVariant.id, selectedAddonIds)} onDecrease={() => onDecrease(selectedVariant.id)} disabled={orderingDisabled || unavailable} />
            ) : (
              <button
                type="button"
                onClick={onToggleSave}
                className={`grid h-13 place-items-center rounded-[15px] border bg-white transition-colors ${
                  saved ? "border-maroon text-maroon" : "border-[#e0e3ea] text-muted hover:border-maroon/35 hover:text-maroon"
                }`}
                aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
                aria-pressed={saved}
              >
                <Heart size={24} className={saved ? "fill-maroon" : ""} />
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
  initialCategoryOptions = [],
  initialProducts = fallbackProducts,
  initialSlides,
  initialCategoryImages = {},
  initialCategoryOffers = {},
  initialCoupons = [],
  restaurantSettings,
  initialActiveCategory,
  initialHomeDishCategories = [],
  categoryPage = false,
}: {
  initialCategories?: string[];
  initialCategoryOptions?: CategoryOption[];
  initialProducts?: Product[];
  initialSlides?: HomeSlide[];
  initialCategoryImages?: Record<string, string>;
  initialCategoryOffers?: CategoryOfferMap;
  initialCoupons?: Coupon[];
  restaurantSettings?: RestaurantSettings;
  initialActiveCategory?: string;
  initialHomeDishCategories?: string[];
  categoryPage?: boolean;
}) {
  const categoryOptions = useMemo(
    () => initialCategoryOptions.length
      ? initialCategoryOptions
      : initialCategories.map((name, index) => ({ id: name, name, parentId: null, sortOrder: index + 1, visible: true })),
    [initialCategories, initialCategoryOptions],
  );
  const topLevelCategories = useMemo(
    () => categoryOptions.filter((category) => !category.parentId).map((category) => category.name),
    [categoryOptions],
  );
  const categories = initialCategories;
  const products = initialProducts;
  const categoryOffers = initialCategoryOffers;
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";
  const isSearchPage = pathname === "/menu";
  const isCategoryPage = categoryPage || pathname.startsWith("/category/");
  const { location: deliveryLocation, ready: deliveryLocationReady } = useDeliveryLocationState();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<MenuFilterId[]>([]);
  const [priceSort, setPriceSort] = useState<PriceSortId | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!initialActiveCategory || initialActiveCategory === "All") return "All";
    return categoryOptions.some((category) => category.name === initialActiveCategory) ? initialActiveCategory : "All";
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mobileMenuView, setMobileMenuView] = useState<"home" | "categories" | "category">("home");
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [mobileCategory, setMobileCategory] = useState("All");
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<Set<string>>(() => new Set());
  const [hiddenCartCount, setHiddenCartCount] = useState(0);
  const [cartBarClosing, setCartBarClosing] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const cartOwnerId = customerSession?.mobile;
  const cart = useStoredCart(cartOwnerId);
  const savedProductIds = useStoredWishlist(cartOwnerId);
  const validCart = useMemo(() => getPricableCartLines(cart, products), [cart, products]);
  const quantityByProduct = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const line of validCart) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    }
    return quantities;
  }, [validCart]);
  const savedProductIdSet = useMemo(() => new Set(savedProductIds), [savedProductIds]);
  const storeMode = restaurantSettings?.storeMode ?? "OPEN";
  const orderingStatus = restaurantSettings ? getStoreOrderingStatus(restaurantSettings) : null;
  const outsideOrderingHours = orderingStatus?.outsideOrderingHours ?? false;
  const storeClosed = orderingStatus?.unavailable ?? false;
  const deliveryCoverage = restaurantSettings ? getDeliveryLocationCoverage(deliveryLocation, restaurantSettings) : null;
  const serviceable = deliveryLocationReady ? deliveryCoverage?.serviceable ?? true : true;
  const orderingDisabled = storeClosed || !serviceable;
  const statusMessage = orderingStatus?.message ?? "Ordering is controlled by the restaurant.";
  const configuredHomeCategories = useMemo(
    () => initialHomeDishCategories.filter((category) => categories.includes(category)),
    [categories, initialHomeDishCategories],
  );
  const usingConfiguredHomeDishes = isHomePage && activeCategory === "All" && !deferredQuery.trim() && activeFilters.length === 0 && configuredHomeCategories.length > 0;

  const visibleProducts = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const matchingProducts = products.filter((product) => {
      const categoryMatch = activeCategory === "All" || productMatchesCategory(product, activeCategory);
      const textMatch = !needle || `${product.name} ${product.category} ${product.parentCategory ?? ""} ${product.description}`.toLowerCase().includes(needle);
      const filterMatch = productMatchesMenuFilters(product, activeFilters, categoryOffers);
      return categoryMatch && textMatch && filterMatch;
    });

    return sortProductsForMenu(matchingProducts, categoryOffers, priceSort);
  }, [activeCategory, activeFilters, categoryOffers, deferredQuery, priceSort, products]);

  const homeProducts = useMemo(() => {
    if (usingConfiguredHomeDishes) {
      return visibleProducts.filter((product) => configuredHomeCategories.some((category) => productMatchesCategory(product, category)));
    }

    if (activeCategory === "All" && !deferredQuery.trim() && activeFilters.length === 0) {
      const bestsellers = visibleProducts.filter((product) => product.bestseller);
      return bestsellers.length ? bestsellers : visibleProducts;
    }

    return visibleProducts;
  }, [activeCategory, activeFilters.length, configuredHomeCategories, deferredQuery, usingConfiguredHomeDishes, visibleProducts]);
  const homeProductGroups = useMemo(() => {
    if (usingConfiguredHomeDishes) {
      return configuredHomeCategories
        .map((category) => ({
          category,
          products: homeProducts.filter((product) => productMatchesCategory(product, category)),
        }))
        .filter((group) => group.products.length > 0);
    }

    if (isCategoryPage && activeCategory !== "All") {
      const selectedCategory = categoryOptions.find((category) => category.name === activeCategory);
      const childCategories = selectedCategory
        ? categoryOptions.filter((category) => category.parentId === selectedCategory.id).map((category) => category.name)
        : [];
      const activeGroups = childCategories.length
        ? [
            {
              category: activeCategory,
              products: homeProducts.filter((product) => product.category === activeCategory),
            },
            ...childCategories.map((category) => ({
              category,
              products: homeProducts.filter((product) => product.category === category),
            })),
          ].filter((group) => group.products.length > 0)
        : [{ category: activeCategory, products: homeProducts }];
      return activeGroups;
    }

    return [{ category: activeCategory === "All" ? "" : activeCategory, products: homeProducts }];
  }, [activeCategory, categoryOptions, configuredHomeCategories, homeProducts, isCategoryPage, usingConfiguredHomeDishes]);
  const categoryPageShowcaseGroups = useMemo(() => {
    if (!(isCategoryPage || isHomePage) || activeCategory === "All" || !configuredHomeCategories.length) return [];

    return configuredHomeCategories
      .map((category) => ({
        category,
        products: sortProductsForMenu(
          products.filter((product) => productMatchesCategory(product, category)),
          categoryOffers,
          priceSort,
        ),
      }))
      .filter((group) => group.products.length > 0);
  }, [activeCategory, categoryOffers, configuredHomeCategories, isCategoryPage, isHomePage, priceSort, products]);
  const hasHomeProductGroups = homeProductGroups.some((group) => group.products.length > 0);

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

  function openPromoSlide(slide?: HomeSlide) {
    const targetCategory = slide?.targetCategory && categories.includes(slide.targetCategory) ? slide.targetCategory : "All";
    openMenuCategory(targetCategory);
  }

  useEffect(() => {
    function refreshSession() {
      setCustomerSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    function syncCategoryFromUrl() {
      const categoryFromPath = getCategoryFromPath(window.location.pathname, categoryOptions);
      if (categoryFromPath) {
        setActiveCategory(categoryFromPath);
        setMobileCategory(categoryFromPath);
        return;
      }

      const category = new URLSearchParams(window.location.search).get("category");
      if (!category || category === "All") {
        setActiveCategory("All");
        setMobileCategory("All");
        return;
      }
      if (!categories.includes(category)) return;
      setActiveCategory(category);
      setMobileCategory(category);
    }

    syncCategoryFromUrl();
    window.addEventListener("popstate", syncCategoryFromUrl);
    return () => window.removeEventListener("popstate", syncCategoryFromUrl);
  }, [categories, categoryOptions]);

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
    writeStoredWishlist(
      savedProductIdSet.has(product.id)
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

  function choosePriceSort(sortId: PriceSortId) {
    setPriceSort((current) => current === sortId ? null : sortId);
  }

  function clearFilters() {
    setActiveFilters([]);
    setPriceSort(null);
  }

  function selectHomeCategory(category: string) {
    setActiveCategory(category);
    setMobileCategory(category);
    setMobileMenuView("home");
    setShowMoreCategories(false);

    if (isHomePage || isSearchPage || isCategoryPage) {
      updateMenuUrl(category, "replace");
      window.requestAnimationFrame(() => document.getElementById("menu-items")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }

  function openMenuCategory(category: string) {
    setActiveCategory(category);
    setMobileCategory(category);
    setMobileMenuView("home");
    setShowMoreCategories(false);

    if (isSearchPage || isCategoryPage) {
      selectHomeCategory(category);
      return;
    }

    window.requestAnimationFrame(() => document.getElementById("menu-items")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    updateMenuUrl(category, "push");
  }

  function updateMenuUrl(category: string, mode: "push" | "replace") {
    const targetPath = getMenuUrlForCategory(category, isHomePage);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === targetPath) return;
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", targetPath);
  }

  function toggleMobileCategoryGroup(category: string) {
    setExpandedMobileCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function closeCartBarWithFlyout() {
    if (cartCount === 0 || cartBarClosing) return;
    setCartBarClosing(true);
    window.setTimeout(() => {
      setHiddenCartCount(cartCount);
      setCartBarClosing(false);
    }, 240);
  }

  const categoryItems = useMemo(
    () => ["All", ...(topLevelCategories.length ? topLevelCategories : categories)],
    [categories, topLevelCategories],
  );
  const homeCategoryItems = useMemo(
    () => (topLevelCategories.length ? topLevelCategories : categories).filter((category) => category !== "All"),
    [categories, topLevelCategories],
  );
  const mobileCategoryGroups = useMemo(() => getCategoryGroups(categoryOptions), [categoryOptions]);
  const mobileCategoryProducts = useMemo(() => {
    const source = mobileCategory === "All"
      ? products
      : products.filter((product) => productMatchesCategory(product, mobileCategory));
    return sortProductsForMenu(source, categoryOffers, priceSort);
  }, [categoryOffers, mobileCategory, priceSort, products]);
  const searchGroups = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const matchingProducts = products.filter((product) => {
      const matchesText = !needle || `${product.name} ${product.category} ${product.parentCategory ?? ""} ${product.description}`.toLowerCase().includes(needle);
      const filterMatch = productMatchesMenuFilters(product, activeFilters, categoryOffers);
      return matchesText && filterMatch;
    });

    return buildSearchGroups(matchingProducts, categoryOptions, categoryOffers, priceSort);
  }, [activeFilters, categoryOffers, categoryOptions, deferredQuery, priceSort, products]);
  const cartCount = validCart.reduce((total, line) => total + line.quantity, 0);
  const cartSubtotal = useMemo(
    () => validCart.reduce((total, line) => total + getProductPrice(line, products, categoryOffers), 0),
    [categoryOffers, products, validCart],
  );
  const showCartBar = cartCount > 0 && hiddenCartCount !== cartCount;
  const homeOfferCards = getHomeOfferCards(initialCoupons);
  const mobileCategoryScreenOpen = mobileMenuView === "categories" || mobileMenuView === "category";

  if (deliveryLocationReady && !serviceable) {
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
    <main className={`wt-soft-type min-h-screen text-charcoal ${mobileCategoryScreenOpen ? "bg-[#f7f8fc] pb-0" : `bg-white ${isSearchPage ? "pb-0" : "pb-24 lg:pb-0"}`}`}>
      <div className={mobileMenuView === "category" || isSearchPage ? "hidden lg:block" : undefined}>
        <Header showLocation={isHomePage && mobileMenuView === "home"} />
      </div>

      {storeClosed && orderingStatus ? (
        <ClosedOrderingNotice
          title={orderingStatus.title}
          message={statusMessage}
          openingHours={restaurantSettings?.openingHours}
          lastOrderBufferMinutes={restaurantSettings?.lastOrderBufferMinutes}
          outsideOrderingHours={outsideOrderingHours}
        />
      ) : null}

      {isSearchPage ? (
        <section className="min-h-screen bg-white px-6 pb-24 pt-1 lg:hidden">
          <div className="rounded-[26px] bg-[#d8f7e9] px-6 py-6 shadow-[0_12px_30px_rgba(17,24,39,0.04)]">
            <h1 className="max-w-[250px] text-[25px] font-black leading-[1.35] text-[#111827]">
              What are you
              <span className="block">looking for today?</span>
            </h1>
            <SearchFilterControl
              query={query}
              setQuery={setQuery}
              activeFilters={activeFilters}
              priceSort={priceSort}
              filtersOpen={filtersOpen}
              onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
              onToggleFilter={toggleFilter}
              onChoosePriceSort={choosePriceSort}
              onClearFilters={clearFilters}
              placeholder="Search fresh dishes"
              className="mt-6 shadow-[0_6px_16px_rgba(17,24,39,0.05)]"
            />
          </div>

          <div className="mt-4 grid gap-8">
            {searchGroups.length ? searchGroups.map((group) => (
              <section key={group.category}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[22px] font-black text-[#111827]">{group.category}</h2>
                  <span className="text-[14px] font-black text-maroon">{group.itemCount} {group.itemCount === 1 ? "item" : "items"}</span>
                </div>
                <div className="grid gap-6">
                  {group.subgroups.map((subgroup) => (
                    <div key={`${group.category}-${subgroup.category}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-[10px] font-black uppercase text-[#7b8492]">{subgroup.category}</h3>
                        <span className="text-[11px] font-black text-maroon">{subgroup.items.length} {subgroup.items.length === 1 ? "item" : "items"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {subgroup.items.map((product) => (
                          <FoodieProductCard
                            key={product.id}
                            product={product}
                            offer={getProductOffer(product, categoryOffers)}
                            quantity={quantityByProduct.get(product.id) ?? 0}
                            saved={savedProductIdSet.has(product.id)}
                            onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                            onDecrease={() => decreaseProduct(product)}
                            onOpen={() => setSelectedProduct(product)}
                            onToggleSave={() => toggleSaved(product)}
                            orderingDisabled={orderingDisabled}
                          />
                        ))}
                      </div>
                    </div>
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
          priceSort={priceSort}
          filtersOpen={filtersOpen}
          onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
          onToggleFilter={toggleFilter}
          onChoosePriceSort={choosePriceSort}
          onClearFilters={clearFilters}
          searchGroups={searchGroups}
          categoryOffers={categoryOffers}
          quantityByProduct={quantityByProduct}
          savedProductIdSet={savedProductIdSet}
          orderingDisabled={orderingDisabled}
          onAdd={(product) => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
          onDecrease={decreaseProduct}
          onOpen={setSelectedProduct}
          onToggleSave={toggleSaved}
        />
      ) : null}

      {mobileMenuView === "categories" ? (
        <section className="min-h-screen bg-[#f7f8fc] px-5 pb-20 pt-6 lg:hidden">
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
          <CategoryListPanel
            groups={mobileCategoryGroups}
            expandedCategories={expandedMobileCategories}
            onToggleGroup={toggleMobileCategoryGroup}
            onChoose={openMenuCategory}
            className="mt-6"
          />
        </section>
      ) : null}

      {mobileMenuView === "category" ? (
        <section className="min-h-screen bg-white pb-24 lg:hidden">
          <div className="sticky top-0 z-40 grid h-[58px] grid-cols-[46px_1fr_46px] items-center border-b border-[#e7ebf2] bg-white px-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <button className="grid h-10 w-10 place-items-center text-maroon" onClick={() => setMobileMenuView("categories")} aria-label="Back to categories">
              <ArrowLeft size={25} strokeWidth={2.7} />
            </button>
            <h1 className="min-w-0 text-center text-[19px] font-black leading-tight text-maroon">{mobileCategory}</h1>
            <Link href="/cart" className="relative grid h-10 w-10 place-items-center text-maroon" aria-label="Cart">
              <ShoppingCart size={27} strokeWidth={2.6} />
              {cartCount ? <span className="absolute right-0.5 top-0 rounded-full bg-maroon px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
            </Link>
          </div>
          <div className="px-6 pt-11">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="min-w-0 text-[18px] font-bold leading-tight text-[#111827]">{mobileCategory} Products</h2>
              <span className="text-[18px] font-bold text-[#111827]">{mobileCategoryProducts.length} {mobileCategoryProducts.length === 1 ? "item" : "items"}</span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {mobileCategoryProducts.map((product) => (
                <FoodieProductCard
                  key={product.id}
                  product={product}
                  offer={getProductOffer(product, categoryOffers)}
                  quantity={quantityByProduct.get(product.id) ?? 0}
                  saved={savedProductIdSet.has(product.id)}
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

      <div className={`${isSearchPage ? "hidden" : mobileMenuView === "home" ? "grid" : "hidden lg:grid"} mx-auto w-full max-w-[1180px] min-w-0 gap-6 px-5 pt-3 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-5 xl:px-0`}>
        <aside className="sticky top-[98px] hidden max-h-[calc(100vh-118px)] overflow-y-auto rounded-2xl border border-[#f1e7e4] bg-white p-4 shadow-[0_14px_40px_rgba(34,31,32,0.04)] lg:block">
          <div className="mb-4 flex items-center gap-2 border-b border-[#f1e7e4] pb-4 text-xs font-black uppercase tracking-wide text-muted">
            <BookOpen size={18} />
            Categories
          </div>
          <div className="grid gap-2">
            <DesktopCategorySidebar
              groups={mobileCategoryGroups}
              activeCategory={activeCategory}
              categoryImages={initialCategoryImages}
              products={products}
              onChoose={openMenuCategory}
            />
          </div>
        </aside>

        <div className="min-w-0">
          {isHomePage ? (
            <section
              className="relative mb-5 aspect-[390/166] w-full cursor-pointer overflow-hidden rounded-[20px] bg-red shadow-[0_10px_24px_rgba(34,31,32,0.08)] lg:hidden"
              role="button"
              tabIndex={0}
              onClick={() => openPromoSlide(promoSlides[activeSlide])}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openPromoSlide(promoSlides[activeSlide]);
              }}
              aria-label={`Open ${promoSlides[activeSlide]?.targetCategory || "All"} category`}
            >
              <Image
                src={promoSlides[activeSlide]?.mobileImage || promoSlides[activeSlide]?.image || "/wah-thali-meal-cutout-v2.png"}
                alt={promoSlides[activeSlide]?.targetCategory || "Wah Thali slider image"}
                fill
                loading="eager"
                unoptimized
                sizes="(max-width: 1023px) calc(100vw - 40px), 366px"
                className="object-cover"
              />
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveSlide(index);
                    }}
                    className={`h-1.5 rounded-full shadow-sm ${index === activeSlide ? "w-4 bg-red" : "w-1.5 bg-white/90"}`}
                    aria-label={`Show slider image ${index + 1}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!isCategoryPage ? (
          <section
            className="relative isolate hidden aspect-[1434/248] w-full cursor-pointer overflow-hidden rounded-[22px] bg-[#fff7f1] shadow-[0_16px_36px_rgba(141,0,33,0.18)] lg:block"
            role="button"
            tabIndex={0}
            onClick={() => openPromoSlide(promoSlides[activeSlide])}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openPromoSlide(promoSlides[activeSlide]);
            }}
            aria-label={`Open ${promoSlides[activeSlide]?.targetCategory || "All"} category`}
          >
            <Image
              src={promoSlides[activeSlide]?.desktopImage || promoSlides[activeSlide]?.image || "/wah-thali-meal-cutout-v2.png"}
              alt={promoSlides[activeSlide]?.targetCategory || "Wah Thali slider image"}
              fill
              loading="eager"
              unoptimized
              sizes="(max-width: 1279px) calc(100vw - 288px), 956px"
              className="object-cover"
            />
            <div className="absolute inset-0">
              <div className="absolute bottom-4 left-10 flex gap-2">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveSlide(index);
                    }}
                    className={`h-2 rounded-full shadow-sm transition-all ${index === activeSlide ? "w-7 bg-white" : "w-2 bg-white/70"}`}
                    aria-label={`Show slider image ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>
          ) : null}

          <SearchFilterControl
            query={query}
            setQuery={setQuery}
            activeFilters={activeFilters}
            priceSort={priceSort}
            filtersOpen={filtersOpen}
            onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
            onToggleFilter={toggleFilter}
            onChoosePriceSort={choosePriceSort}
            onClearFilters={clearFilters}
            placeholder="Search dishes or cuisines"
            className="mt-3 lg:mt-6"
          />

          {storeMode === "BUSY" ? (
            <section className="mt-5 rounded-2xl border border-red/20 bg-[#fff8f9] p-4 text-maroon">
              <div className="flex items-start gap-3">
                <TimerReset className="mt-0.5 shrink-0" size={22} />
                <div>
                  <p className="text-sm font-black uppercase tracking-wide">Kitchen busy</p>
                  <p className="mt-1 text-sm font-bold">{statusMessage}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-3 lg:mt-6" aria-label="Menu categories">
            <div className="wt-horizontal-scroll flex gap-2 px-1 py-0 pb-1.5 sm:gap-4 sm:pb-3">
              {homeCategoryItems.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    openMenuCategory(category);
                  }}
                  className="group grid w-[66px] shrink-0 snap-start place-items-center gap-1 text-center sm:w-[90px] sm:gap-1.5"
                >
                  <span className={`grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border shadow-[0_8px_22px_rgba(34,31,32,0.06)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:shadow-[0_14px_30px_rgba(34,31,32,0.12)] sm:h-20 sm:w-20 ${
                    activeCategory === category ? "border-maroon bg-maroon text-white" : "border-[#f1e7e4] bg-white text-charcoal group-hover:border-maroon/30 group-hover:bg-[#fff4f5] group-hover:text-maroon"
                  }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-[72%] w-[72%] rounded-full object-cover transition duration-300 group-hover:scale-110 group-hover:saturate-[1.08]" loading="lazy" decoding="async" onError={useFallbackImage} />
                  </span>
                  <span
                    className={`w-full whitespace-normal break-words px-0.5 text-center font-black transition-colors ${activeCategory === category ? "text-maroon" : "text-charcoal group-hover:text-maroon"}`}
                    style={getCompactCategoryLabelStyle(category)}
                    title={category}
                  >
                    {category}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuView("categories");
                  setShowMoreCategories((current) => !current);
                }}
                aria-expanded={showMoreCategories}
                className="group grid w-[66px] shrink-0 snap-start place-items-center gap-1 text-center sm:w-[90px] sm:gap-1.5"
              >
                <span className={`grid h-[52px] w-[52px] place-items-center rounded-full border shadow-[0_8px_22px_rgba(34,31,32,0.06)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:border-maroon/30 group-hover:bg-maroon group-hover:text-white group-hover:shadow-[0_14px_30px_rgba(141,0,33,0.18)] sm:h-20 sm:w-20 ${showMoreCategories ? "border-maroon bg-maroon text-white" : "border-[#f1e7e4] bg-[#f8fafc] text-charcoal"}`}>
                  <Grid3X3 size={21} />
                </span>
                <span className={`w-full whitespace-nowrap px-0.5 text-center text-[9px] font-black leading-none transition-colors group-hover:text-maroon sm:text-[12px] ${showMoreCategories ? "text-maroon" : "text-charcoal"}`}>
                  {showMoreCategories ? "Less" : "More"}
                </span>
              </button>
            </div>
            {showMoreCategories && categoryItems.length > 5 ? (
              <>
                <DesktopCategoryPanel
                  groups={mobileCategoryGroups}
                  activeCategory={activeCategory}
                  categoryImages={initialCategoryImages}
                  products={products}
                  onClose={() => setShowMoreCategories(false)}
                  onChoose={openMenuCategory}
                />
              </>
            ) : null}
          </section>

          <section id="menu-items" className="mt-3 border-t-[5px] border-[#c8c8c8] pt-4 pb-16 lg:mt-5 lg:border-t-0 lg:pt-0 lg:pb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted lg:text-[10px]">
                  {activeCategory === "All" ? "Home favourites" : `${homeProducts.length} ${homeProducts.length === 1 ? "dish" : "dishes"}`}
                </p>
                <h2 className="mt-1 font-sans text-[20px] font-semibold leading-tight text-charcoal lg:text-[20px]">
                  {activeCategory === "All"
                    ? usingConfiguredHomeDishes && configuredHomeCategories.length === 1
                      ? `${configuredHomeCategories[0]} Dishes`
                      : usingConfiguredHomeDishes
                        ? "Today's Dishes"
                        : "Best Sellers"
                    : `${activeCategory} Dishes`}
                </h2>
              </div>
              {activeCategory !== "All" || activeFilters.length || query ? (
                <button
                  onClick={() => {
                    setQuery("");
                    clearFilters();
                    selectHomeCategory("All");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-[#fff4f5] px-3 text-[10px] font-semibold text-maroon lg:text-[11px]"
                >
                  View all <ChevronRight size={11} />
                </button>
              ) : (
                <Link href="/menu" className="inline-flex h-8 items-center gap-1 rounded-full bg-[#fff4f5] px-3 text-[10px] font-semibold text-maroon lg:text-[11px]">
                  Full menu <ChevronRight size={11} />
                </Link>
              )}
            </div>
            {hasHomeProductGroups ? (
              <div className="grid min-w-0 gap-7">
                {homeProductGroups.map((group) => (
                  <section key={group.category || "all-dishes"} className="min-w-0">
                    {group.category ? (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="min-w-0 text-[15px] font-black leading-tight text-charcoal lg:text-[17px]">{group.category}</h3>
                        <Link href={getCategoryHref(group.category)} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-maroon lg:text-[11px]">
                          View all <ChevronRight size={12} />
                        </Link>
                      </div>
                    ) : null}
                    <div className="wt-horizontal-scroll flex gap-3.5 pb-5 lg:hidden">
                      {group.products.slice(0, 8).map((product) => (
                        <div key={product.id} className="w-[calc((100%_-_14px)/2)] min-w-[132px] max-w-[174px] shrink-0">
                          <FoodieProductCard
                            product={product}
                            offer={getProductOffer(product, categoryOffers)}
                            quantity={quantityByProduct.get(product.id) ?? 0}
                            saved={savedProductIdSet.has(product.id)}
                            onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                            onDecrease={() => decreaseProduct(product)}
                            onOpen={() => setSelectedProduct(product)}
                            onToggleSave={() => toggleSaved(product)}
                            orderingDisabled={orderingDisabled}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="hidden gap-4 pb-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(220px,260px))] lg:justify-start">
                      {group.products.slice(0, 12).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          offer={getProductOffer(product, categoryOffers)}
                          quantity={quantityByProduct.get(product.id) ?? 0}
                          saved={savedProductIdSet.has(product.id)}
                          onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                          onDecrease={() => decreaseProduct(product)}
                          onOpen={() => setSelectedProduct(product)}
                          onToggleSave={() => toggleSaved(product)}
                          orderingDisabled={orderingDisabled}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                {categoryPageShowcaseGroups.length ? (
                  <section className="grid min-w-0 gap-7 border-t border-[#f1e7e4] pt-7">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted lg:text-[10px]">Home favourites</p>
                        <h2 className="mt-1 font-sans text-[20px] font-semibold leading-tight text-charcoal lg:text-[20px]">Today&apos;s Dishes</h2>
                      </div>
                      <Link href="/menu" className="inline-flex h-8 items-center gap-1 rounded-full bg-[#fff4f5] px-3 text-[10px] font-semibold text-maroon lg:text-[11px]">
                        Full menu <ChevronRight size={11} />
                      </Link>
                    </div>
                    {categoryPageShowcaseGroups.map((group) => (
                      <section key={`showcase-${group.category}`} className="min-w-0">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="min-w-0 text-[15px] font-black leading-tight text-charcoal lg:text-[17px]">{group.category}</h3>
                          <Link href={getCategoryHref(group.category)} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-maroon lg:text-[11px]">
                            View all <ChevronRight size={12} />
                          </Link>
                        </div>
                        <div className="wt-horizontal-scroll flex gap-3.5 pb-5 lg:hidden">
                          {group.products.slice(0, 8).map((product) => (
                            <div key={product.id} className="w-[calc((100%_-_14px)/2)] min-w-[132px] max-w-[174px] shrink-0">
                              <FoodieProductCard
                                product={product}
                                offer={getProductOffer(product, categoryOffers)}
                                quantity={quantityByProduct.get(product.id) ?? 0}
                                saved={savedProductIdSet.has(product.id)}
                                onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                                onDecrease={() => decreaseProduct(product)}
                                onOpen={() => setSelectedProduct(product)}
                                onToggleSave={() => toggleSaved(product)}
                                orderingDisabled={orderingDisabled}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="hidden gap-4 pb-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(220px,260px))] lg:justify-start">
                          {group.products.slice(0, 12).map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              offer={getProductOffer(product, categoryOffers)}
                              quantity={quantityByProduct.get(product.id) ?? 0}
                              saved={savedProductIdSet.has(product.id)}
                              onAdd={() => needsDishDetail(product) ? setSelectedProduct(product) : addProduct(product)}
                              onDecrease={() => decreaseProduct(product)}
                              onOpen={() => setSelectedProduct(product)}
                              onToggleSave={() => toggleSaved(product)}
                              orderingDisabled={orderingDisabled}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#f1e7e4] bg-white p-8 text-center">
                <Store className="mx-auto text-muted" />
                <h3 className="mt-3 text-[14px] font-semibold text-charcoal">No items found</h3>
                <p className="mt-1 text-xs text-muted">Try thali, biryani, chicken, paneer, or dessert.</p>
              </div>
            )}
          </section>

          <section className="mt-2 pb-8 lg:mt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-charcoal lg:text-[20px]">Best Offers for You</h2>
              <Link href="/offers" className="inline-flex items-center gap-1 text-[10px] font-semibold text-maroon lg:text-[12px]">
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
                  <span className="grid h-6 w-6 place-items-center text-maroon lg:h-9 lg:w-9">
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
              <h2 className="text-[26px] font-semibold leading-[0.98] text-[#9aa1ad] lg:text-[34px]">
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
          saved={savedProductIdSet.has(selectedProduct.id)}
          onToggleSave={() => toggleSaved(selectedProduct)}
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

function ClosedOrderingNotice({
  title,
  message,
  openingHours,
  lastOrderBufferMinutes,
  outsideOrderingHours,
}: {
  title: string;
  message: string;
  openingHours?: string;
  lastOrderBufferMinutes?: number;
  outsideOrderingHours: boolean;
}) {
  return (
    <section className="mx-auto mt-3 w-full max-w-[1180px] px-5 sm:px-6 xl:px-0">
      <div className="rounded-[14px] border border-[#d9dde3] bg-[#f8f9fb] px-3.5 py-3 text-[#111827] shadow-[0_8px_18px_rgba(17,24,39,0.045)] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-4">
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#4b5563]">Menu open for browsing</span>
          <span className="mt-1 block text-[12px] font-black leading-4 text-charcoal">{title}</span>
          <span className="mt-0.5 block text-[11px] font-bold leading-4 text-[#4b5563]">
            Orders are not being accepted right now. {outsideOrderingHours && openingHours ? "Please check the ordering hours below." : message}
          </span>
        </span>
        {openingHours ? (
          <span className="mt-2 block rounded-[10px] bg-white px-3 py-2 text-[11px] font-black leading-4 text-[#111827] ring-1 ring-[#d9dde3] sm:mt-0">
            {openingHours}
            {outsideOrderingHours ? <span className="ml-1 text-[10px] text-muted sm:block sm:ml-0">Last order {lastOrderBufferMinutes ?? 30} min before close</span> : null}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function getProductOffer(product: Product, categoryOffers: CategoryOfferMap) {
  return product.offer?.trim() || categoryOffers[slugifyCategory(product.category)]?.trim() || undefined;
}

function CategoryListPanel({
  groups,
  expandedCategories,
  onToggleGroup,
  onChoose,
  className = "",
}: {
  groups: { category: CategoryOption; children: CategoryOption[] }[];
  expandedCategories: Set<string>;
  onToggleGroup: (category: string) => void;
  onChoose: (category: string) => void;
  className?: string;
}) {
  return (
    <div className={`${className} overflow-hidden rounded-[18px] border border-[#edf0f5] bg-white shadow-[0_10px_28px_rgba(17,24,39,0.04)]`}>
      <button
        type="button"
        onClick={() => onChoose("All")}
        className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-[#edf0f5] px-4 py-3 text-left"
      >
        <span className="text-[17px] font-black text-[#111827]">All</span>
        <Grid3X3 size={18} className="text-maroon" />
      </button>
      {groups.map((group) => {
        const expanded = expandedCategories.has(group.category.name);
        if (!group.children.length) {
          return (
            <button
              key={group.category.id}
              type="button"
              onClick={() => onChoose(group.category.name)}
              className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-[#edf0f5] px-4 py-3 text-left last:border-b-0"
            >
              <span className="break-words text-[17px] font-black leading-tight text-[#111827]">{group.category.name}</span>
              <ChevronRight size={19} className="text-[#334155]" />
            </button>
          );
        }

        return (
          <div key={group.category.id} className="border-b border-[#edf0f5] last:border-b-0">
            <button
              type="button"
              onClick={() => onToggleGroup(group.category.name)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={expanded}
            >
              <span className="break-words text-[18px] font-black leading-tight text-[#111827]">{group.category.name}</span>
              <ChevronRight size={20} className={`shrink-0 text-[#334155] transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
            {expanded ? (
              <div className="border-t border-[#f3f5f8] bg-[#fbfcfe]">
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onChoose(child.name)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-[#edf0f5] px-4 py-3 pl-7 text-left last:border-b-0"
                  >
                    <span className="break-words text-[15px] font-bold leading-tight text-[#667085]">{child.name}</span>
                    <ChevronRight size={18} className="shrink-0 text-[#334155]" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DesktopCategorySidebar({
  groups,
  activeCategory,
  categoryImages,
  products,
  onChoose,
}: {
  groups: { category: CategoryOption; children: CategoryOption[] }[];
  activeCategory: string;
  categoryImages: Record<string, string>;
  products: Product[];
  onChoose: (category: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onChoose("All")}
        className={`group grid min-h-[58px] grid-cols-[34px_1fr] items-center gap-3 rounded-xl px-3 text-left text-[13px] font-black transition duration-200 ${
          activeCategory === "All" ? "bg-[#fff4f5] text-maroon shadow-sm" : "text-charcoal hover:bg-[#fff4f5] hover:text-maroon"
        }`}
      >
        <span className={`grid h-8 w-8 place-items-center rounded-full transition duration-200 ${activeCategory === "All" ? "bg-maroon text-white" : "bg-[#fff4f5] group-hover:bg-maroon group-hover:text-white"}`}>
          <Grid3X3 size={17} />
        </span>
        <span className="min-w-0 leading-tight">All</span>
      </button>

      {groups.map((group) => {
        const selected = activeCategory === group.category.name;
        const childSelected = group.children.some((child) => child.name === activeCategory);
        return (
          <div key={group.category.id} className="grid gap-1">
            <button
              type="button"
              onClick={() => onChoose(group.category.name)}
              className={`group grid min-h-[52px] grid-cols-[34px_1fr] items-center gap-3 rounded-xl px-3 text-left text-[13px] font-black transition duration-200 ${
                selected || childSelected ? "bg-[#fff4f5] text-maroon shadow-sm" : "text-charcoal hover:bg-[#fff4f5] hover:text-maroon"
              }`}
            >
              <span className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full ring-1 ring-transparent transition duration-200 group-hover:scale-110 group-hover:ring-maroon/25 ${selected || childSelected ? "bg-[#fff4f5]" : "bg-[#fff4f5]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getCategoryImage(group.category.name, categoryImages, products)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-110 group-hover:saturate-[1.08]" loading="lazy" decoding="async" onError={useFallbackImage} />
              </span>
              <span className="min-w-0 break-words leading-tight">{group.category.name}</span>
            </button>

            {group.children.length ? (
              <div className="ml-[34px] grid gap-1 border-l border-[#f1e7e4] pl-3">
                {group.children.map((child) => {
                  const childActive = activeCategory === child.name;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onChoose(child.name)}
                      className={`min-h-9 rounded-lg px-2 text-left text-[11px] font-black leading-tight transition ${
                        childActive ? "bg-maroon text-white shadow-sm" : "text-[#667085] hover:bg-[#fff4f5] hover:text-maroon"
                      }`}
                    >
                      {child.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function DesktopCategoryPanel({
  groups,
  activeCategory,
  categoryImages,
  products,
  onClose,
  onChoose,
}: {
  groups: { category: CategoryOption; children: CategoryOption[] }[];
  activeCategory: string;
  categoryImages: Record<string, string>;
  products: Product[];
  onClose: () => void;
  onChoose: (category: string) => void;
}) {
  const visibleGroups = groups.filter((group) => group.category.name !== "All");

  return (
    <div className="mt-3 hidden overflow-hidden rounded-[18px] border border-[#edf0f5] bg-white shadow-[0_16px_40px_rgba(17,24,39,0.07)] lg:block">
      <div className="flex items-center justify-between gap-4 border-b border-[#edf0f5] bg-[#f8fafc] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-maroon shadow-[0_8px_18px_rgba(17,24,39,0.06)] ring-1 ring-[#e8edf3] transition hover:bg-[#fff4f5]"
            aria-label="Close all categories"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </button>
          <span className="min-w-0">
            <h3 className="text-[22px] font-black leading-tight text-[#111827]">All Categories</h3>
            <span className="mt-1 block text-[12px] font-bold text-muted">{visibleGroups.length} menu categories</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChoose("All")}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[12px] font-black transition ${
            activeCategory === "All" ? "bg-maroon text-white" : "bg-white text-maroon ring-1 ring-[#eadfe5] hover:bg-[#fff4f5]"
          }`}
        >
          <Grid3X3 size={16} strokeWidth={2.8} />
          All dishes
        </button>
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-3 lg:grid-cols-2">
        {visibleGroups.map((group) => {
          const selected = activeCategory === group.category.name;
          return (
            <div key={group.category.id} className={`overflow-hidden rounded-[14px] border bg-white transition ${selected ? "border-maroon shadow-[0_12px_28px_rgba(141,0,33,0.08)]" : "border-[#edf0f5]"}`}>
              <button
                type="button"
                onClick={() => onChoose(group.category.name)}
                className={`group grid min-h-[74px] w-full grid-cols-[48px_minmax(0,1fr)_20px] items-center gap-3 px-4 py-3 text-left transition ${
                  selected ? "bg-[#fff4f5]" : "hover:bg-[#fff4f5]"
                }`}
              >
                <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#fff4f5] ring-1 ring-[#f0e4df]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCategoryImage(group.category.name, categoryImages, products)}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-110 group-hover:saturate-[1.08]"
                    loading="lazy"
                    decoding="async"
                    onError={useFallbackImage}
                  />
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] font-black leading-tight ${selected ? "text-maroon" : "text-[#111827] group-hover:text-maroon"}`}>
                    {group.category.name}
                  </span>
                  <span className="mt-1 block text-[11px] font-bold leading-4 text-muted">
                    {group.children.length ? `${group.children.length} subcategories` : "View dishes"}
                  </span>
                </span>
                <ChevronRight size={18} className="text-[#334155]" />
              </button>

              {group.children.length ? (
                <div className="grid border-t border-[#edf0f5] bg-[#fbfcfe]">
                  {group.children.map((child) => {
                    const childActive = activeCategory === child.name;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onChoose(child.name)}
                        className={`flex min-h-[44px] items-center justify-between gap-3 px-5 py-2.5 pl-[76px] text-left text-[13px] font-bold transition ${
                          childActive ? "bg-maroon text-white" : "text-[#667085] hover:bg-[#fff4f5] hover:text-maroon"
                        }`}
                      >
                        <span className="min-w-0 break-words leading-tight">
                        {child.name}
                        </span>
                        <ChevronRight size={16} className="shrink-0" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function productMatchesCategory(product: Product, category: string) {
  return product.category === category || product.parentCategory === category;
}

function getCategoryGroups(categories: CategoryOption[]) {
  const byParent = new Map<string | null, CategoryOption[]>();
  for (const category of categories) {
    const parentId = category.parentId ?? null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), category]);
  }

  return (byParent.get(null) ?? []).map((category) => ({
    category,
    children: byParent.get(category.id) ?? [],
  }));
}

function buildSearchGroups(products: Product[], categoryOptions: CategoryOption[], categoryOffers: CategoryOfferMap, priceSort: PriceSortId | null): SearchGroup[] {
  const categoryByName = new Map(categoryOptions.map((category) => [category.name, category]));
  const parentNameById = new Map(categoryOptions.map((category) => [category.id, category.name]));
  const categoryOrder = new Map(categoryOptions.map((category, index) => [category.name, index]));
  const groups = new Map<string, Map<string, Product[]>>();

  for (const product of products) {
    const category = categoryByName.get(product.category);
    const mainCategory = product.parentCategory ?? (category?.parentId ? parentNameById.get(category.parentId) : undefined) ?? product.category;
    const subcategory = mainCategory === product.category ? "All dishes" : product.category;
    const subgroups = groups.get(mainCategory) ?? new Map<string, Product[]>();
    subgroups.set(subcategory, [...(subgroups.get(subcategory) ?? []), product]);
    groups.set(mainCategory, subgroups);
  }

  return Array.from(groups, ([category, subgroups]) => ({
    category,
    itemCount: Array.from(subgroups.values()).reduce((total, items) => total + items.length, 0),
    subgroups: Array.from(subgroups, ([subcategory, items]) => ({
      category: subcategory,
      items: sortProductsForMenu(items, categoryOffers, priceSort),
    })).sort((a, b) => getCategorySortOrder(a.category, categoryOrder) - getCategorySortOrder(b.category, categoryOrder)),
  })).sort((a, b) => getCategorySortOrder(a.category, categoryOrder) - getCategorySortOrder(b.category, categoryOrder));
}

function getCategorySortOrder(category: string, categoryOrder: Map<string, number>) {
  return categoryOrder.get(category) ?? Number.MAX_SAFE_INTEGER;
}

function getCompactCategoryLabelStyle(category: string) {
  const compactLength = category.replace(/\s+/g, "").length;
  const fontSize = compactLength > 17 ? 5.7 : compactLength > 14 ? 6.3 : compactLength > 11 ? 7.1 : 8.2;

  return {
    fontSize: `${fontSize}px`,
    lineHeight: "1",
  };
}

function sortProductsForMenu(products: Product[], categoryOffers: CategoryOfferMap, priceSort: PriceSortId | null) {
  return [...products].sort((a, b) => {
    const availabilitySort = Number(b.available) - Number(a.available);
    if (availabilitySort) return availabilitySort;

    if (priceSort) {
      const aPrice = getProductUnitPricing(a, categoryOffers).unitPrice;
      const bPrice = getProductUnitPricing(b, categoryOffers).unitPrice;
      const priceDifference = priceSort === "priceLowHigh" ? aPrice - bPrice : bPrice - aPrice;
      if (priceDifference) return priceDifference;
    }

    return a.name.localeCompare(b.name);
  });
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

function getCategoryHref(category: string) {
  return `/category/${slugifyCategory(category)}`;
}

function getMenuUrlForCategory(category: string, homePage: boolean) {
  if (homePage) {
    return category === "All" ? "/" : `/?category=${encodeURIComponent(category)}`;
  }

  return category === "All" ? "/menu" : getCategoryHref(category);
}

function getCategoryFromPath(pathname: string, categories: CategoryOption[]) {
  if (!pathname.startsWith("/category/")) return null;
  const slug = decodeURIComponent(pathname.replace(/^\/category\//, "").split("/")[0] ?? "");
  return categories.find((category) => slugifyCategory(category.name) === slug)?.name ?? null;
}
