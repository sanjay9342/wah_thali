import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { CheckoutForm } from "@/components/checkout-form";
import { getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const restaurantSettings = await getRestaurantSettingsFromDb();

  return (
    <>
      <Header whatsappNumber={restaurantSettings.whatsappNumber} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black text-maroon">Checkout</h1>
        <CheckoutForm restaurantSettings={restaurantSettings} />
      </main>
      <MobileNav />
    </>
  );
}
