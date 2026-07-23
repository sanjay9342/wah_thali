import { SimpleCustomerPage } from "@/components/simple-customer-page";

export default function CorporatePage() {
  return (
    <SimpleCustomerPage
      title="Corporate meals"
      intro="Capture company meal enquiries and start a CRM follow-up workflow for tastings, proposals, contracts, GST invoices, and monthly billing."
      sections={[
        { title: "Enquiry form", body: "Company, contact, phone, email, employee count, dates, area, budget, GST, requirements, attachment, and remarks." },
        { title: "Sales pipeline", body: "Submissions create a corporate lead, assign owner, start follow-up, send acknowledgement, and notify admin.", action: "View admin CRM", href: "/admin/customers" },
      ]}
    />
  );
}
