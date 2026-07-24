import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getPolicy } from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy | Wah Thali",
};

export default function PrivacyPolicyPage() {
  return <LegalPage policy={getPolicy("privacy-policy")!} />;
}
