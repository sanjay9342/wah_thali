import { WishlistClient } from "@/components/wishlist-client";
import { getProductsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const products = await getProductsFromDb();

  return <WishlistClient products={products} />;
}
