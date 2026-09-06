import { Bot, MessageCircleHeart, Send, Timer, Users } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { AdminWhatsAppAutomationClient } from "@/components/admin-whatsapp-automation-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getWhatsAppRetentionConfig } from "@/lib/whatsapp-retention";

export const dynamic = "force-dynamic";

export default async function AdminAutomationPage() {
  await requireAdminPagePermission("automation", "/admin/automation");
  const config = await getWhatsAppRetentionConfig();
  const stats = isDatabaseConfigured()
    ? await Promise.all([
        prisma.customer.count({ where: { whatsappMarketingOptIn: true, whatsappMarketingOptOut: false } }),
        prisma.retentionCampaign.count({ where: { status: "ACTIVE" } }),
        prisma.retentionMessage.count({ where: { status: "SCHEDULED" } }),
        prisma.retentionMessage.count({ where: { status: "SENT" } }),
      ])
    : [0, 0, 0, 0];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">WhatsApp CRM</p>
            <h1 className="text-3xl font-black text-maroon">Follow-up automation</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Manage the 3-7-14 retention strategy, templates, scheduled sends, opt-outs, and dormant win-backs.</p>
          </div>
        </div>
        <AdminSectionNav />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Bot, "Automation", config.enabled ? "On" : "Off", "Master switch"],
            [Users, "Opted-in", String(stats[0]), "Allowed marketing audience"],
            [Timer, "Active journeys", String(stats[1]), "Running campaigns"],
            [Send, "Queued / sent", `${stats[2]} / ${stats[3]}`, "WhatsApp retention messages"],
          ].map(([Icon, label, value, detail]) => (
            <div key={String(label)} className="surface rounded-2xl p-5">
              <Icon className="text-red" size={24} />
              <p className="mt-4 text-sm font-bold text-muted">{String(label)}</p>
              <p className="text-2xl font-black text-maroon">{String(value)}</p>
              <p className="mt-1 text-xs font-bold text-muted">{String(detail)}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <MessageCircleHeart className="text-red" /> Strategy controls
          </h2>
          <AdminWhatsAppAutomationClient initialConfig={config} />
        </section>
      </div>
    </main>
  );
}
