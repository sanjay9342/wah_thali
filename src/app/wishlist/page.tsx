import { SimpleCustomerPage } from "@/components/simple-customer-page";
import { getProductsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const products = await getProductsFromDb();

  return (
    <SimpleCustomerPage
      title="Wishlist"
      intro="Saved favourites help repeat customers order faster."
      sections={products.slice(0, 4).map((product) => ({
        title: product.name,
        body: product.description,
        action: "Add to cart",
        href: `/cart?add=${product.id}`,
      }))}
    />
  );
}
