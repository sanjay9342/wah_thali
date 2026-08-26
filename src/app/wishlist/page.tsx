import { WishlistClient } from "@/components/wishlist-client";
import { getPublicWishlistPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export default async function WishlistPage() {
  const { products } = await getPublicWishlistPageDataFromDb();

  return <WishlistClient products={products} />;
}
