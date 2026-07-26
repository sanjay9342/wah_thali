import { AccountClient } from "@/components/account-client";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export default function AccountPage() {
  return (
    <>
      <Header />
      <AccountClient />
      <MobileNav />
    </>
  );
}
