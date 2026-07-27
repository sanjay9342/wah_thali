import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { OrdersClient } from "@/components/orders-client";

export default function OrdersPage() {
  return (
    <>
      <Header />
      <OrdersClient />
      <MobileNav />
    </>
  );
}
