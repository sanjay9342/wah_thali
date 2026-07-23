import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function LoyaltyPage() {
  return (
    <SimpleCustomerPage
      title="Loyalty"
      intro="Earn, redeem, and track points with tier rules controlled from admin settings."
      sections={[
        { title: "240 points available", body: "Earned from recent orders. Redeem safely at checkout after server validation.", action: "Use points", href: "/cart" },
        { title: "Gold tier progress", body: "Rs 1,580 more spending unlocks higher reward rates and priority support." },
      ]}
    />
  );
}
