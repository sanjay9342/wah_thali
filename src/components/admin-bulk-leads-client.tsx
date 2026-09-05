"use client";

import { AlertTriangle, MessageCircle, Phone, Save, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { AdminFloatingMessage } from "@/components/admin-floating-message";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch } from "@/lib/admin-client-auth";
import { useAdminAccess } from "@/components/admin-access-gate";
import type { AdminLead } from "@/lib/types";

export function AdminBulkLeadsClient({ leads, initialLeadWhatsAppNumber }: { leads: AdminLead[]; initialLeadWhatsAppNumber: string }) {
  const adminAccess = useAdminAccess();
  const [visibleLeads, setVisibleLeads] = useState(leads);
  const [leadWhatsAppNumber, setLeadWhatsAppNumber] = useState(initialLeadWhatsAppNumber);
  const [message, setMessage] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  function saveLeadNumber() {
    setMessage("");
    startTransition(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/admin/bulk-leads/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadWhatsAppNumber }),
      });
      const data = await response.json().catch(() => null) as { error?: string; settings?: { leadWhatsAppNumber?: string } } | null;

      if (!response.ok) {
        setMessage(data?.error || "Could not save WhatsApp notification number.");
        return;
      }

      setLeadWhatsAppNumber(data?.settings?.leadWhatsAppNumber ?? leadWhatsAppNumber);
      setMessage("Bulk enquiry WhatsApp notification number saved.");
    });
  }

  function deleteAllLeads() {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setMessage("Type DELETE to confirm removing all bulk enquiries.");
      return;
    }

    setMessage("");
    startDeleteTransition(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/admin/bulk-leads", {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null) as { error?: string; deleted?: number } | null;

      if (!response.ok) {
        setMessage(data?.error || "Could not delete bulk enquiries.");
        return;
      }

      setVisibleLeads([]);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText("");
      setMessage(`Deleted ${data?.deleted ?? visibleLeads.length} bulk enquiries.`);
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Wah Thali Admin</p>
            <h1 className="text-3xl font-black text-maroon">Bulk order enquiries</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Filled forms are saved here and sent to the WhatsApp notification number.</p>
          </div>
        </div>
        <AdminSectionNav />

        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <MessageCircle className="text-red" size={22} /> Form WhatsApp notify
            </h2>
            <label className="mt-4 grid gap-2 text-sm font-black text-maroon">
              Notification number
              <input
                value={leadWhatsAppNumber}
                onChange={(event) => setLeadWhatsAppNumber(event.target.value)}
                className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal outline-none focus:border-maroon"
                placeholder="Example: 917001323730"
              />
            </label>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">Used only when customers submit the Bulk Orders form. Include country code without +.</p>
            {message ? <AdminFloatingMessage message={message} tone={getAdminMessageTone(message)} /> : null}
            <button
              type="button"
              onClick={saveLeadNumber}
              disabled={isPending || !leadWhatsAppNumber.trim()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-maroon px-4 text-sm font-black text-white disabled:opacity-60"
            >
              <Save size={17} /> {isPending ? "Saving..." : "Save number"}
            </button>
          </aside>

          <section className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-black text-maroon">Form filled customers</h2>
              <p className="text-sm font-semibold text-muted">{visibleLeads.length ? `${visibleLeads.length} recent enquiries` : "No form submissions yet."}</p>
            </div>
            <div className="divide-y divide-border">
              {visibleLeads.length ? visibleLeads.map((lead) => (
                <article key={lead.id} className="grid gap-3 p-5 lg:grid-cols-[240px_1fr_auto]">
                  <div>
                    <h3 className="font-black text-charcoal">{lead.name}</h3>
                    <a href={`tel:${lead.phone}`} className="mt-1 block text-sm font-black text-maroon">{lead.phone}</a>
                    {lead.customer?.email ? <p className="mt-1 text-xs font-bold text-muted">{lead.customer.email}</p> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-charcoal">{lead.source.replace(/^Website\s+/, "")}</p>
                    {lead.note ? <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-cream p-3 text-xs font-semibold leading-5 text-charcoal">{lead.note}</pre> : null}
                  </div>
                  <div className="flex items-start gap-2 lg:justify-end">
                    <span className="rounded-lg bg-[#fff4f5] px-3 py-1 text-xs font-black text-maroon">{lead.stage}</span>
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon"
                    >
                      <Phone size={14} /> Call
                    </a>
                    <a
                      href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(`Hi ${lead.name}, this is Wah Thali. We received your bulk order enquiry.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-maroon px-3 text-xs font-black text-white"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </div>
                </article>
              )) : (
                <div className="p-8 text-center">
                  <p className="text-lg font-black text-charcoal">No bulk enquiries yet</p>
                  <p className="mt-2 text-sm font-semibold text-muted">When a customer fills the Bulk Orders form, it will appear here automatically.</p>
                </div>
              )}
            </div>
            {visibleLeads.length ? (
              <div className="border-t border-border bg-[#fff9fa] p-5">
                {deleteConfirmOpen ? (
                  <div className="grid gap-4 lg:grid-cols-[1fr_260px_auto] lg:items-end">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-black text-maroon">
                        <AlertTriangle size={19} /> Delete all bulk enquiries?
                      </h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                        This removes every bulk enquiry shown here and its status history. Type DELETE to unlock the final button.
                      </p>
                    </div>
                    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-maroon">
                      Confirmation
                      <input
                        value={deleteConfirmText}
                        onChange={(event) => setDeleteConfirmText(event.target.value)}
                        className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal outline-none focus:border-maroon"
                        placeholder="Type DELETE"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmOpen(false);
                          setDeleteConfirmText("");
                          setMessage("");
                        }}
                        disabled={isDeletePending}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-black text-charcoal disabled:opacity-60"
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={deleteAllLeads}
                        disabled={isDeletePending || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-maroon px-4 text-sm font-black text-white disabled:opacity-60"
                      >
                        <Trash2 size={16} /> {isDeletePending ? "Deleting..." : "Delete all"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-black text-maroon">Danger zone</h3>
                      <p className="mt-1 text-sm font-semibold text-muted">Use this only after saving any enquiry details you still need.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmOpen(true);
                        setMessage("");
                      }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-maroon bg-white px-4 text-sm font-black text-maroon"
                    >
                      <Trash2 size={16} /> Delete all enquiries
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function getAdminMessageTone(message: string) {
  return /failed|error|could not|invalid|required|confirm/i.test(message) ? "error" : "success";
}
