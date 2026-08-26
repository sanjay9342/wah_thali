import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function PrivacySecurityPage() {
  return (
    <SimpleCustomerPage
      backHref="/account"
      backLabel="Back to Profile"
      title="Privacy and Security"
      intro="Manage sign-in, profile privacy, notifications, and data controls for your Wah Thali account."
      sections={[
        { title: "OTP sign-in", body: "Your account uses verified WhatsApp OTP login for profile and order access.", action: "Open profile", href: "/account" },
        { title: "Notifications", body: "Review account, order, and offer alerts connected to your customer profile.", action: "View alerts", href: "/notifications" },
        { title: "Data controls", body: "Request account or data deletion from the dedicated data deletion page.", action: "Data deletion", href: "/data-deletion" },
        { title: "Support", body: "Need help with account access, order history, or profile details? Contact support.", action: "Get help", href: "/support" },
      ]}
    />
  );
}
