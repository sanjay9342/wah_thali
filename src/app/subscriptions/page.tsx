import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function SubscriptionsPage() {
  return (
    <SimpleCustomerPage
      title="Subscriptions"
      intro="Weekly, monthly, office lunch, and family meal plans with pause, skip, resume, cancel, renew, delivery schedules, and payment history."
      sections={[
        { title: "Weekly plan", body: "Choose meals, days, time slots, spice preference, add-ons, and delivery address.", action: "Start ordering", href: "/menu" },
        { title: "Office lunch", body: "Team meal subscription with GST invoice support and corporate account follow-up.", action: "Corporate enquiry", href: "/corporate" },
      ]}
    />
  );
}
