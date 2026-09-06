"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Ban, CheckCircle2, Clock, EyeOff, MessageCircle, Play, RefreshCcw, Save, Search, ShieldCheck, TestTube2, ToggleLeft, ToggleRight } from "lucide-react";
import { AdminFloatingMessage } from "@/components/admin-floating-message";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch } from "@/lib/admin-client-auth";

type RetentionConfig = {
  enabled: boolean;
  orderLink: string;
  menuLink: string;
  googleReviewLink: string;
  firstReturnCouponCode: string;
  firstReturnDiscountAmount: number;
  winbackCouponCode: string;
  winbackDiscountAmount: number;
  couponExpiryDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  dormantCoolingDays: number;
  dormantWinbackDays: number;
  dormantFinalDays: number;
  steps: unknown[];
};

type CustomerTracker = {
  id: string;
  name: string;
  mobile: string;
  optedIn: boolean;
  optedOut: boolean;
  completedOrderCount: number;
  lastDeliveredOrderNumber?: string | null;
  lastDeliveredOrderAt?: string | null;
  marketingStage?: string | null;
  blockedReason?: string;
  campaign?: { id: string; stage: string; status: string; cancelReason?: string | null } | null;
  nextMessage?: { id: string; templateName: string; status: string; scheduledAt: string; failureReason?: string | null } | null;
  lastMessage?: { id: string; templateName: string; status: string; scheduledAt: string; sentAt?: string | null; failureReason?: string | null } | null;
  complaint?: { id: string; status: string; category: string } | null;
};

type MessageRow = {
  id: string;
  templateName: string;
  stage: string;
  status: string;
  scheduledAt: string;
  failureReason?: string | null;
  customer: { id: string; name: string; mobile: string };
  order?: { orderNumber: string } | null;
};

type TemplateRow = {
  id: string;
  templateName: string;
  label: string;
  category: string;
  stage: string;
  enabled: boolean;
  bodyVariableKeys: string[];
  buttonVariableKeys: string[];
  preview?: string | null;
};

type MessagingStatus = {
  configured: boolean;
  missing: string[];
};

type ApiState = {
  customerTrackers: CustomerTracker[];
  recentMessages: MessageRow[];
  templates: TemplateRow[];
  messagingStatus: MessagingStatus;
  stats: Record<string, number>;
};

const emptyState: ApiState = {
  customerTrackers: [],
  recentMessages: [],
  templates: [],
  messagingStatus: { configured: false, missing: [] },
  stats: {},
};

export function AdminWhatsAppAutomationClient({ initialConfig }: { initialConfig: RetentionConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [serverState, setServerState] = useState<ApiState>(emptyState);
  const [query, setQuery] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [testResults, setTestResults] = useState<Array<{ templateName: string; ok: boolean; error?: string; messageId?: string }>>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAccess?.session?.mobile]);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return serverState.customerTrackers;
    return serverState.customerTrackers.filter((customer) =>
      `${customer.name} ${customer.mobile} ${customer.lastDeliveredOrderNumber ?? ""} ${customer.marketingStage ?? ""} ${customer.blockedReason ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [query, serverState.customerTrackers]);

  const effectiveTestMobile = testMobile.trim() || adminAccess?.session?.mobile || "";

  function run(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessageTone("error");
        setMessage(error instanceof Error ? error.message : "Automation action failed.");
      }
    });
  }

  async function refresh() {
    const response = await adminFetch(adminAccess?.session, "/api/admin/whatsapp-retention", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load automation.");
    setConfig(data.config);
    setServerState({
      customerTrackers: data.customerTrackers ?? [],
      recentMessages: data.recentMessages ?? [],
      templates: data.templates ?? [],
      messagingStatus: data.messagingStatus ?? emptyState.messagingStatus,
      stats: data.stats ?? {},
    });
  }

  function saveConfigPayload(nextConfig: RetentionConfig) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/admin/whatsapp-retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save automation settings.");
      setConfig(data.config);
      setMessageTone("success");
      setMessage(data.config.enabled ? "WhatsApp follow-up automation is enabled and saved." : "WhatsApp follow-up automation is disabled and saved.");
      await refresh();
    });
  }

  function saveConfig() {
    saveConfigPayload(config);
  }

  function cancelCustomerCampaigns(customerId: string) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/admin/whatsapp-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_customer_campaigns", customerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not cancel campaign.");
      setMessageTone("success");
      setMessage(`Cancelled ${data.cancelled ?? 0} active campaign(s).`);
      await refresh();
    });
  }

  function runAutomationAction(action: string, successMessage: (data: Record<string, unknown>) => string, extra: Record<string, unknown> = {}) {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/admin/whatsapp-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Automation action failed.");
      if (Array.isArray(data.results)) setTestResults(data.results);
      setMessageTone(data.ok === false ? "error" : "success");
      setMessage(successMessage(data));
      await refresh();
    });
  }

  function seedTemplates() {
    runAutomationAction("seed_templates", (data) => `Template registry ready: ${Array.isArray(data.templates) ? data.templates.length : 0} templates checked.`);
  }

  function processDueNow() {
    const approved = window.confirm("Process due retention messages now? This can send real queued WhatsApp messages to customers.");
    if (!approved) return;
    runAutomationAction("process_due", (data) => {
      const result = data.result as Record<string, unknown> | undefined;
      return `Processed due queue. Sent: ${result?.sent ?? 0}, skipped: ${result?.skipped ?? 0}, failed: ${result?.failed ?? 0}.`;
    });
  }

  function scheduleDormantNow() {
    const approved = window.confirm("Check dormant customers now? This may schedule new win-back messages for opted-in customers.");
    if (!approved) return;
    runAutomationAction("schedule_dormant", (data) => {
      const result = data.result as Record<string, unknown> | undefined;
      return `Dormant check complete. Scheduled: ${result?.scheduled ?? 0}.`;
    });
  }

  function testTemplate(templateName: string) {
    if (!effectiveTestMobile) {
      setMessageTone("error");
      setMessage("Enter a test mobile number first.");
      return;
    }
    runAutomationAction("test_template", (data) => {
      const result = data.result as Record<string, unknown> | undefined;
      return data.ok ? `${templateName} sent to test mobile.` : `${templateName} failed: ${result?.message ?? "Meta rejected the message."}`;
    }, { templateName, testMobile: effectiveTestMobile });
  }

  function testAllTemplates() {
    if (!effectiveTestMobile) {
      setMessageTone("error");
      setMessage("Enter a test mobile number first.");
      return;
    }
    const approved = window.confirm(`Send every registered WhatsApp template to ${effectiveTestMobile}? This is for testing only and will not message customers.`);
    if (!approved) return;
    runAutomationAction("test_all_templates", (data) => `Template test complete. Sent: ${data.sent ?? 0}, failed: ${data.failed ?? 0}.`, { testMobile: effectiveTestMobile });
  }

  function toggleTemplate(template: TemplateRow) {
    const nextEnabled = !template.enabled;
    const approved = window.confirm(
      nextEnabled
        ? `Enable template ${template.templateName}? It can be used by the website automation after saving.`
        : `Disable template ${template.templateName}? The website automation will stop scheduling this template after saving.`,
    );
    if (!approved) return;

    run(async () => {
      const nextTemplates = serverState.templates.map((item) => ({
        id: item.id,
        templateName: item.templateName,
        label: item.label,
        category: item.category,
        stage: item.stage,
        enabled: item.id === template.id ? nextEnabled : item.enabled,
        preview: item.preview ?? "",
        bodyVariableKeys: item.bodyVariableKeys,
        buttonVariableKeys: item.buttonVariableKeys,
      }));
      const response = await adminFetch(adminAccess?.session, "/api/admin/whatsapp-retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: nextTemplates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update template status.");
      setMessageTone("success");
      setMessage(`${template.templateName} is now ${nextEnabled ? "enabled" : "disabled"}.`);
      await refresh();
    });
  }

  function updateField<K extends keyof RetentionConfig>(key: K, value: RetentionConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function confirmAutomationToggle() {
    const nextEnabled = !config.enabled;
    const approved = window.confirm(
      nextEnabled
        ? "Enable WhatsApp follow-up automation? New delivered orders will start customer follow-up journeys."
        : "Disable WhatsApp follow-up automation? Queued messages stay saved, but due messages will not send while automation is off.",
    );
    if (!approved) return;
    const nextConfig = { ...config, enabled: nextEnabled };
    setConfig(nextConfig);
    setMessageTone("info");
    setMessage(nextEnabled ? "Enabling WhatsApp automation..." : "Disabling WhatsApp automation...");
    saveConfigPayload(nextConfig);
  }

  return (
    <div className="mt-5 grid gap-5">
      {message ? <AdminFloatingMessage message={message} tone={messageTone} /> : null}

      <section className="rounded-xl border border-border bg-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={confirmAutomationToggle}
            className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-black ${config.enabled ? "bg-[#effaf4] text-[#0f7a45]" : "bg-white text-maroon"}`}
          >
            {config.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {config.enabled ? "Automation enabled" : "Automation disabled"}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveConfig} disabled={isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-maroon px-4 text-sm font-black text-white disabled:opacity-60">
              <Save size={17} /> Save
            </button>
            <button type="button" onClick={() => run(refresh)} disabled={isPending} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-black">
              <RefreshCcw size={17} /> Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextInput label="Order link" value={config.orderLink} onChange={(value) => updateField("orderLink", value)} />
          <TextInput label="Menu link" value={config.menuLink} onChange={(value) => updateField("menuLink", value)} />
          <TextInput label="Google review link" value={config.googleReviewLink} onChange={(value) => updateField("googleReviewLink", value)} />
          <TextInput label="First return coupon" value={config.firstReturnCouponCode} onChange={(value) => updateField("firstReturnCouponCode", value.toUpperCase())} />
          <NumberInput label="First return discount" value={config.firstReturnDiscountAmount} onChange={(value) => updateField("firstReturnDiscountAmount", value)} />
          <TextInput label="Win-back coupon" value={config.winbackCouponCode} onChange={(value) => updateField("winbackCouponCode", value.toUpperCase())} />
          <NumberInput label="Win-back discount" value={config.winbackDiscountAmount} onChange={(value) => updateField("winbackDiscountAmount", value)} />
          <NumberInput label="Coupon expiry days" value={config.couponExpiryDays} onChange={(value) => updateField("couponExpiryDays", value)} />
          <TextInput label="Send window start" value={config.sendWindowStart} onChange={(value) => updateField("sendWindowStart", value)} />
          <TextInput label="Send window end" value={config.sendWindowEnd} onChange={(value) => updateField("sendWindowEnd", value)} />
          <NumberInput label="Cooling days" value={config.dormantCoolingDays} onChange={(value) => updateField("dormantCoolingDays", value)} />
          <NumberInput label="Win-back days" value={config.dormantWinbackDays} onChange={(value) => updateField("dormantWinbackDays", value)} />
          <NumberInput label="Final win-back days" value={config.dormantFinalDays} onChange={(value) => updateField("dormantFinalDays", value)} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-black text-maroon"><TestTube2 size={18} /> Testing and safety</h3>
            <p className="mt-1 text-xs font-bold text-muted">Send templates only to a test number, run queues manually, and verify duplicate delivered orders do not create duplicate journeys.</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${serverState.messagingStatus.configured ? "bg-[#effaf4] text-[#0f7a45]" : "bg-[#fff4f5] text-red"}`}>
            {serverState.messagingStatus.configured ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {serverState.messagingStatus.configured ? "Meta messaging configured" : `Missing: ${serverState.messagingStatus.missing.join(", ") || "WhatsApp config"}`}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs font-black text-muted">
            Test mobile number
            <input value={testMobile} onChange={(event) => setTestMobile(event.target.value)} className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal" placeholder={adminAccess?.session?.mobile || "Enter your WhatsApp test number"} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={seedTemplates} disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon disabled:opacity-60">
              <ShieldCheck size={16} /> Seed templates
            </button>
            <button type="button" onClick={processDueNow} disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon disabled:opacity-60">
              <Play size={16} /> Process due
            </button>
            <button type="button" onClick={scheduleDormantNow} disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon disabled:opacity-60">
              <Clock size={16} /> Check dormant
            </button>
            <button type="button" onClick={testAllTemplates} disabled={isPending || !serverState.templates.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-xs font-black text-white disabled:opacity-60">
              <MessageCircle size={16} /> Test all templates
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-cream text-xs font-black uppercase text-muted">
              <tr>
                <th className="w-[46%] px-3 py-3">Template</th>
                <th className="w-[18%] px-3 py-3">Stage</th>
                <th className="w-[20%] px-3 py-3">Status</th>
                <th className="w-[16%] px-3 py-3 text-right">Test</th>
              </tr>
            </thead>
            <tbody>
              {serverState.templates.length ? serverState.templates.map((template) => {
                const testResult = testResults.find((result) => result.templateName === template.templateName);
                return (
                  <tr key={template.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      <p className="font-black text-charcoal">{template.label}</p>
                      <p className="text-xs font-bold text-muted">{template.templateName}</p>
                      {template.preview ? <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted">{template.preview}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-cream px-2 py-1 text-xs font-black text-maroon">{template.stage}</span>
                      <p className="mt-2 text-xs font-bold text-muted">{template.category}</p>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleTemplate(template)}
                        disabled={isPending}
                        className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-60 ${template.enabled ? "bg-[#effaf4] text-[#0f7a45]" : "bg-[#f6f7fb] text-muted"}`}
                      >
                        {template.enabled ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                        {template.enabled ? "Enabled" : "Disabled"}
                      </button>
                      {testResult ? <p className={`mt-2 text-xs font-bold ${testResult.ok ? "text-[#0f7a45]" : "text-red"}`}>{testResult.ok ? "Last test sent" : testResult.error}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => testTemplate(template.templateName)} disabled={isPending || !template.enabled} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-maroon ring-1 ring-border disabled:opacity-50">
                        <MessageCircle size={15} /> Test
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm font-bold text-muted">No templates found. Click Seed templates first.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-black text-maroon"><MessageCircle size={18} /> Customer follow-up tracking</h3>
            <p className="mt-1 text-xs font-bold text-muted">Last delivered order, next follow-up, last WhatsApp result, and blocked/error reason.</p>
          </div>
          <label className="flex h-10 min-w-[260px] items-center gap-2 rounded-lg border border-border bg-cream px-3">
            <Search size={16} className="text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, order" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-cream text-xs font-black uppercase text-muted">
              <tr>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Last delivered</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Campaign</th>
                <th className="px-3 py-3">Next follow-up</th>
                <th className="px-3 py-3">Last message</th>
                <th className="px-3 py-3">Error / block</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length ? filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <p className="font-black text-charcoal">{customer.name}</p>
                    <p className="text-xs font-bold text-muted">{customer.mobile}</p>
                    <p className="mt-1 text-xs font-black text-maroon">{customer.completedOrderCount} delivered order(s)</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-charcoal">{customer.lastDeliveredOrderNumber ?? "-"}</p>
                    <p className="text-xs font-bold text-muted">{customer.lastDeliveredOrderAt ? formatDateTime(customer.lastDeliveredOrderAt) : "No delivered order"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-cream px-2 py-1 text-xs font-black text-maroon">{customer.marketingStage ?? "Not started"}</span>
                    <p className="mt-2 text-xs font-bold text-muted">{customer.optedOut ? "Opted out" : customer.optedIn ? "Opted in" : "No opt-in"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-charcoal">{customer.campaign?.stage ?? "-"}</p>
                    <p className="text-xs font-bold text-muted">{customer.campaign?.status ?? "No campaign"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-charcoal">{customer.nextMessage?.templateName ?? "-"}</p>
                    <p className="text-xs font-bold text-muted">{customer.nextMessage ? formatDateTime(customer.nextMessage.scheduledAt) : "No scheduled follow-up"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-charcoal">{customer.lastMessage?.templateName ?? "-"}</p>
                    <p className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-black ${statusClass(customer.lastMessage?.status ?? "")}`}>{customer.lastMessage?.status ?? "No message"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {customer.blockedReason || customer.lastMessage?.failureReason || customer.campaign?.cancelReason ? (
                      <div className="max-w-[220px] rounded-lg bg-[#fff4f5] p-2 text-xs font-bold text-red">
                        <AlertTriangle size={14} className="mb-1" />
                        {customer.blockedReason || customer.lastMessage?.failureReason || customer.campaign?.cancelReason}
                      </div>
                    ) : (
                      <span className="rounded-md bg-[#effaf4] px-2 py-1 text-xs font-black text-[#0f7a45]">Clear</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {customer.campaign?.status === "ACTIVE" ? (
                      <button type="button" onClick={() => cancelCustomerCampaigns(customer.id)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-red ring-1 ring-border">
                        <Ban size={15} /> Cancel
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-muted">No action</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm font-bold text-muted">No customer follow-up records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h3 className="font-black text-maroon">Recent message errors and sends</h3>
        <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-border">
          {serverState.recentMessages.length ? serverState.recentMessages.map((item) => (
            <div key={item.id} className="grid gap-1 border-b border-border p-3 text-xs font-bold last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-charcoal">{item.templateName}</p>
                <span className={`rounded-md px-2 py-1 ${statusClass(item.status)}`}>{item.status}</span>
              </div>
              <p className="text-muted">{item.customer.name} | {item.customer.mobile} | {item.order?.orderNumber ?? item.stage}</p>
              <p className="text-muted">{formatDateTime(item.scheduledAt)}</p>
              {item.failureReason ? <p className="text-red">{item.failureReason}</p> : null}
            </div>
          )) : <p className="p-3 text-sm font-bold text-muted">No queued messages yet.</p>}
        </div>
      </section>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-black text-muted">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal" />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs font-black text-muted">
      {label}
      <input type="number" value={value} min={0} onChange={(event) => onChange(Number(event.target.value))} className="h-10 min-w-0 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal" />
    </label>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status: string) {
  if (status === "SENT") return "bg-[#effaf4] text-[#0f7a45]";
  if (status === "FAILED" || status === "CANCELLED") return "bg-[#fff4f5] text-red";
  if (status === "SCHEDULED") return "bg-[#fff8ec] text-[#8a4b00]";
  if (status === "SKIPPED") return "bg-[#f6f7fb] text-muted";
  return "bg-cream text-muted";
}
