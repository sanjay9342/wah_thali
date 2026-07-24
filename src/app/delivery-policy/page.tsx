import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getPolicy } from "@/lib/business";

export const metadata: Metadata = {
  title: "Delivery Policy | Wah Thali",
};

export default function DeliveryPolicyPage() {
  return <LegalPage policy={getPolicy("delivery-policy")!} />;
}
