import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function SupportPage() {
  return (
    <SimpleCustomerPage
      title="Support"
      intro="Create order-related tickets, complaints, refund requests, and WhatsApp handover cases."
      sections={[
        { title: "Order issue", body: "Wrong item, missing item, damaged food, late delivery, refund, cancellation, or payment issue.", action: "Track WT-10021", href: "/order/WT-10021/track" },
        { title: "Complaint SLA", body: "Priority, owner, response time, resolution note, refund status, and repeat complaint flag are tracked for admin." },
        { title: "WhatsApp support", body: "Customer can continue with human handover when automation is not enough.", action: "Open account", href: "/account" },
      ]}
    />
  );
}
