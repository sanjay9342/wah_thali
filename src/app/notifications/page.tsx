import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationsClient } from "@/components/notifications-client";

export default function NotificationsPage() {
  return (
    <>
      <Header />
      <NotificationsClient />
      <MobileNav />
    </>
  );
}
