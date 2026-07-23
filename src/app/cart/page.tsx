import { CartClient } from "@/components/cart-client";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <Header showContact={false} />
      <main className="bg-cream px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        <CartClient addProductId={params.add} />
      </main>
      <MobileNav />
    </>
  );
}
