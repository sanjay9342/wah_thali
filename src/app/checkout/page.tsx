import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { CheckoutForm } from "@/components/checkout-form";

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black text-maroon">Checkout</h1>
        <CheckoutForm />
      </main>
      <MobileNav />
    </>
  );
}
