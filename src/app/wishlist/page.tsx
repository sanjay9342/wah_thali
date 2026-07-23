import { products } from "@/lib/data";
import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function WishlistPage() {
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
