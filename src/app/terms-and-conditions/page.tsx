import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getPolicy } from "@/lib/business";

export const metadata: Metadata = {
  title: "Terms and Conditions | Wah Thali",
};

export default function TermsPage() {
  return <LegalPage policy={getPolicy("terms-and-conditions")!} />;
}
