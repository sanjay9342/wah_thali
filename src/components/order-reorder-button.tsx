"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession } from "@/lib/customer-session";
import type { CartLine } from "@/lib/types";

type ReorderItem = {
  productId: string;
  quantity: number;
};

export function OrderReorderButton({
  items,
  className = "inline-flex h-12 items-center gap-2 rounded-xl bg-maroon px-5 text-[15px] font-black text-white",
}: {
  items: ReorderItem[];
  className?: string;
}) {
  const router = useRouter();

  function reorder() {
    const cartLines = buildCartLines(items);
    if (!cartLines.length) {
      router.push("/menu");
      return;
    }

    const session = readCustomerSession();
    writeStoredCart(cartLines, session?.mobile);
    router.push("/cart");
  }

  return (
    <button type="button" onClick={reorder} className={className}>
      <RotateCcw size={18} /> Reorder
    </button>
  );
}

function buildCartLines(items: ReorderItem[]): CartLine[] {
  const lines = new Map<string, CartLine>();

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    const existing = lines.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      lines.set(item.productId, {
        productId: item.productId,
        variantId: "regular",
        addonIds: [],
        quantity: item.quantity,
      });
    }
  }

  return [...lines.values()];
}
