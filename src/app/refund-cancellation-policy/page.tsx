import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getPolicy } from "@/lib/business";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | Wah Thali",
};

export default function RefundCancellationPage() {
  return <LegalPage policy={getPolicy("refund-cancellation-policy")!} />;
}
