import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getPolicy } from "@/lib/business";

export const metadata: Metadata = {
  title: "User Data Deletion Instructions | Wah Thali",
};

export default function DataDeletionPage() {
  return <LegalPage policy={getPolicy("data-deletion")!} />;
}

