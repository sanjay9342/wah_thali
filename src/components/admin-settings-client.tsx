"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { BellRing, Clock3, CreditCard, ImagePlus, Save, Settings2, Store, Trash2, Truck } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import type { BusinessSettings, HomeSlide } from "@/lib/types";

type AdvancedSettings = {
  storeMode: string;
  storeStatusReason: string;
  busyMessage: string;
  pausedMessage: string;
  closedMessage: string;
  autoAcceptOrders: boolean;
  requireDeclineReason: boolean;
  maxOrdersPerSlot: string;
  defaultPrepMinutes: string;
  rushPrepBufferMinutes: string;
  lastOrderBufferMinutes: string;
  codEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  lowStockAlertThreshold: string;
  newOrderSoundEnabled: boolean;
  whatsappOrderAlerts: boolean;
  adminDailyDigestTime: string;
};

const defaultAdvanced: AdvancedSettings = {
  storeMode: "OPEN",
  storeStatusReason: "",
  busyMessage: "The kitchen is busy right now. Orders are open, but prep time may be longer than usual.",
  pausedMessage: "Ordering is paused for a short time. Please check back soon.",
  closedMessage: "The restaurant is closed right now. Please order during opening hours.",
  autoAcceptOrders: false,
  requireDeclineReason: true,
  maxOrdersPerSlot: "25",
  defaultPrepMinutes: "25",
  rushPrepBufferMinutes: "10",
  lastOrderBufferMinutes: "30",
  codEnabled: true,
  onlinePaymentsEnabled: false,
  lowStockAlertThreshold: "5",
  newOrderSoundEnabled: true,
  whatsappOrderAlerts: true,
  adminDailyDigestTime: "21:00",
};

export function AdminSettingsClient({
  initialSettings,
  initialAdvanced,
  initialSlides,
  initialCategories,
}: {
  initialSettings: BusinessSettings;
  initialAdvanced?: Partial<AdvancedSettings>;
  initialSlides: HomeSlide[];
  initialCategories: string[];
}) {
  const [settings, setSettings] = useState({
    openingHours: initialSettings.openingHours,
    supportPhone: initialSettings.supportPhone,
    whatsappNumber: initialSettings.whatsappNumber,
    minimumOrder: String(initialSettings.minimumOrder),
    deliveryFee: String(initialSettings.deliveryFee),
    freeDeliveryThreshold: String(initialSettings.freeDeliveryThreshold),
    packagingFee: String(initialSettings.packagingFee),
    gstRate: String(initialSettings.gstRate),
    serviceablePins: initialSettings.serviceablePins.join(", "),
  });
  const [advanced, setAdvanced] = useState<AdvancedSettings>({ ...defaultAdvanced, ...initialAdvanced });
  const [slides, setSlides] = useState(initialSlides);
  const [slidesDirty, setSlidesDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function saveSettings() {
    run(async () => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingHours: settings.openingHours,
          supportPhone: settings.supportPhone,
          whatsappNumber: settings.whatsappNumber,
          minimumOrder: Number(settings.minimumOrder),
          deliveryFee: Number(settings.deliveryFee),
          freeDeliveryThreshold: Number(settings.freeDeliveryThreshold),
          packagingFee: Number(settings.packagingFee),
          gstRate: Number(settings.gstRate),
          serviceablePins: settings.serviceablePins.split(",").map((pin) => pin.trim()).filter(Boolean),
          ...advanced,
          maxOrdersPerSlot: Number(advanced.maxOrdersPerSlot),
          defaultPrepMinutes: Number(advanced.defaultPrepMinutes),
          rushPrepBufferMinutes: Number(advanced.rushPrepBufferMinutes),
          lastOrderBufferMinutes: Number(advanced.lastOrderBufferMinutes),
          lowStockAlertThreshold: Number(advanced.lowStockAlertThreshold),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Settings save failed.");
      setMessage("Advanced restaurant settings saved live.");
    });
  }

  function updateSlide(index: number, patch: Partial<HomeSlide>) {
    setSlides((current) => current.map((slide, slideIndex) => (slideIndex === index ? { ...slide, ...patch } : slide)));
    setSlidesDirty(true);
  }

  function addSlide() {
    setSlides((current) => [
      ...current,
      {
        id: `slide-${Date.now()}`,
        eyebrow: "New offer",
        title: "Fresh deal",
        body: "Update this offer text.",
        code: "WAH50",
        image: "/wah-thali-meal-cutout-v2.png",
        targetCategory: current[0]?.targetCategory ?? initialCategories[0] ?? "All",
        active: true,
        sortOrder: current.length + 1,
      },
    ]);
    setSlidesDirty(true);
  }

  function deleteSlide(index: number) {
    const slide = slides[index];
    const confirmed = window.confirm(`Delete slider "${slide?.title ?? "this slide"}"?`);
    if (!confirmed) return;

    setSlides((current) =>
      current
        .filter((_, slideIndex) => slideIndex !== index)
        .map((item, slideIndex) => ({ ...item, sortOrder: slideIndex + 1 })),
    );
    setSlidesDirty(true);
    setMessage("Slide deleted. Click Save slider to publish the change.");
  }

  function saveSlides() {
    run(async () => {
      const response = await fetch("/api/home-slides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Slider save failed.");
      setSlidesDirty(false);
      setMessage("Homepage slider saved live and connected to the website.");
    });
  }

  async function uploadImage(file: File, folder = "home-slides") {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const response = await fetch("/api/storage/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Image upload failed.");
      setMessage("Image uploaded. Click Save slider to publish it on the website.");
      return data.publicUrl as string;
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Configuration</p>
            <h1 className="text-3xl font-black text-maroon">Business settings</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Restaurant modes, order rules, kitchen timing, delivery, payments, and homepage promotions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveSettings} disabled={isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
              <Save size={18} /> Save settings
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <Panel title="Store mode" icon={<Store className="text-red" size={22} />}>
            <label className="grid gap-2 text-sm font-bold text-charcoal">
              Store status
              <select value={advanced.storeMode} onChange={(event) => setAdvanced({ ...advanced, storeMode: event.target.value })} className="h-11 rounded-lg border border-border bg-cream px-3">
                <option value="OPEN">Open</option>
                <option value="BUSY">Busy</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAdvanced({ ...advanced, storeMode: "OPEN", storeStatusReason: "" })}
                className="h-10 rounded-lg bg-maroon px-3 text-sm font-black text-white"
              >
                Store available now
              </button>
              <button
                type="button"
                onClick={() => setAdvanced({ ...advanced, storeMode: "CLOSED", storeStatusReason: "Store is closed right now. Please wait for opening hours." })}
                className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-maroon"
              >
                Close store now
              </button>
            </div>
            <Input label="Customer status reason" value={advanced.storeStatusReason} onChange={(value) => setAdvanced({ ...advanced, storeStatusReason: value })} />
            <Textarea label="Busy message" value={advanced.busyMessage} onChange={(value) => setAdvanced({ ...advanced, busyMessage: value })} />
            <Textarea label="Paused message" value={advanced.pausedMessage} onChange={(value) => setAdvanced({ ...advanced, pausedMessage: value })} />
            <Textarea label="Closed message" value={advanced.closedMessage} onChange={(value) => setAdvanced({ ...advanced, closedMessage: value })} />
            <Toggle label="Auto accept orders" checked={advanced.autoAcceptOrders} onChange={(value) => setAdvanced({ ...advanced, autoAcceptOrders: value })} />
            <Toggle label="Require decline reason" checked={advanced.requireDeclineReason} onChange={(value) => setAdvanced({ ...advanced, requireDeclineReason: value })} />
            <Input label="Opening hours" value={settings.openingHours} onChange={(value) => setSettings({ ...settings, openingHours: value })} />
          </Panel>

          <Panel title="Kitchen timing" icon={<Clock3 className="text-red" size={22} />}>
            <Input label="Default prep minutes" value={advanced.defaultPrepMinutes} onChange={(value) => setAdvanced({ ...advanced, defaultPrepMinutes: value })} />
            <Input label="Rush buffer minutes" value={advanced.rushPrepBufferMinutes} onChange={(value) => setAdvanced({ ...advanced, rushPrepBufferMinutes: value })} />
            <Input label="Last order buffer minutes" value={advanced.lastOrderBufferMinutes} onChange={(value) => setAdvanced({ ...advanced, lastOrderBufferMinutes: value })} />
            <Input label="Max orders per slot" value={advanced.maxOrdersPerSlot} onChange={(value) => setAdvanced({ ...advanced, maxOrdersPerSlot: value })} />
          </Panel>

          <Panel title="Notifications" icon={<BellRing className="text-red" size={22} />}>
            <Toggle label="New order sound" checked={advanced.newOrderSoundEnabled} onChange={(value) => setAdvanced({ ...advanced, newOrderSoundEnabled: value })} />
            <Toggle label="WhatsApp order alerts" checked={advanced.whatsappOrderAlerts} onChange={(value) => setAdvanced({ ...advanced, whatsappOrderAlerts: value })} />
            <Input label="Low stock alert threshold" value={advanced.lowStockAlertThreshold} onChange={(value) => setAdvanced({ ...advanced, lowStockAlertThreshold: value })} />
            <Input label="Daily digest time" value={advanced.adminDailyDigestTime} onChange={(value) => setAdvanced({ ...advanced, adminDailyDigestTime: value })} />
          </Panel>

          <Panel title="Delivery rules" icon={<Truck className="text-red" size={22} />}>
            <Input label="Minimum order" value={settings.minimumOrder} onChange={(value) => setSettings({ ...settings, minimumOrder: value })} />
            <Input label="Delivery fee" value={settings.deliveryFee} onChange={(value) => setSettings({ ...settings, deliveryFee: value })} />
            <Input label="Free delivery threshold" value={settings.freeDeliveryThreshold} onChange={(value) => setSettings({ ...settings, freeDeliveryThreshold: value })} />
            <Input label="Packaging fee" value={settings.packagingFee} onChange={(value) => setSettings({ ...settings, packagingFee: value })} />
          </Panel>

          <Panel title="Payments and tax" icon={<CreditCard className="text-red" size={22} />}>
            <Input label="GST rate" value={settings.gstRate} onChange={(value) => setSettings({ ...settings, gstRate: value })} />
            <Toggle label="COD enabled" checked={advanced.codEnabled} onChange={(value) => setAdvanced({ ...advanced, codEnabled: value })} />
            <Toggle label="Online payments enabled" checked={advanced.onlinePaymentsEnabled} onChange={(value) => setAdvanced({ ...advanced, onlinePaymentsEnabled: value })} />
          </Panel>

          <Panel title="Contact and service area" icon={<Settings2 className="text-red" size={22} />}>
            <Input label="Support phone" value={settings.supportPhone} onChange={(value) => setSettings({ ...settings, supportPhone: value })} />
            <Input label="WhatsApp number" value={settings.whatsappNumber} onChange={(value) => setSettings({ ...settings, whatsappNumber: value })} />
            <label className="grid gap-2 text-sm font-bold text-charcoal">
              Serviceable PINs
              <textarea value={settings.serviceablePins} onChange={(event) => setSettings({ ...settings, serviceablePins: event.target.value })} className="min-h-24 rounded-lg border border-border bg-cream p-3 text-sm font-bold" />
            </label>
          </Panel>
        </section>

        <section className="mt-6 surface rounded-2xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <ImagePlus className="text-red" /> Homepage slider
              </h2>
              <p className="text-sm font-semibold text-muted">
                These images and offers appear on the customer homepage/menu slider.
                {slidesDirty ? " Unsaved slider changes." : " Slider is saved."}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={addSlide} className="h-10 rounded-lg border border-border px-3 text-sm font-black">Add slide</button>
              <button disabled={uploading || isPending || !slidesDirty} onClick={saveSlides} className="h-10 min-w-36 rounded-lg bg-red px-3 text-sm font-black text-white disabled:opacity-60">
                {uploading ? "Uploading..." : isPending ? "Saving..." : slidesDirty ? "Save slider" : "Saved"}
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {slides.map((slide, index) => (
              <div key={slide.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-cream p-4">
                <div className="grid gap-3">
                  <Input label="Eyebrow" value={slide.eyebrow} onChange={(value) => updateSlide(index, { eyebrow: value })} />
                  <Input label="Title" value={slide.title} onChange={(value) => updateSlide(index, { title: value })} />
                  <Input label="Body" value={slide.body} onChange={(value) => updateSlide(index, { body: value })} />
                  <Input label="Coupon code" value={slide.code} onChange={(value) => updateSlide(index, { code: value })} />
                  <label className="grid gap-2 text-sm font-bold text-charcoal">
                    Target category
                    <select value={slide.targetCategory ?? "All"} onChange={(event) => updateSlide(index, { targetCategory: event.target.value })} className="h-11 rounded-lg border border-border bg-white px-3">
                      <option value="All">All food</option>
                      {initialCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-2 text-sm font-bold text-charcoal">
                  <span>Image</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeImage(slide.image)} alt="" className="h-36 w-full rounded-lg object-cover xl:h-40" />
                  <input value={slide.image} onChange={(event) => updateSlide(index, { image: event.target.value })} className="h-11 min-w-0 rounded-lg border border-border bg-white px-3 text-sm" placeholder="Paste image URL or /public path" />
                </div>
                <div className="mt-auto grid gap-2 pt-4">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-maroon px-3 text-sm font-black text-white">
                    Upload using your device
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          updateSlide(index, { image: await uploadImage(file) });
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Image upload failed.");
                        }
                      }}
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Toggle label="Active" checked={slide.active} onChange={(value) => updateSlide(index, { active: value })} />
                    <button type="button" onClick={() => deleteSlide(index)} className="grid h-11 w-12 place-items-center rounded-lg border border-border bg-white text-red" aria-label={`Delete ${slide.title}`}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button disabled={uploading || isPending || !slidesDirty} onClick={saveSlides} className="h-11 min-w-40 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60">
              {uploading ? "Uploading..." : isPending ? "Saving..." : slidesDirty ? "Save slider" : "Saved"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-xl font-black text-maroon">{icon} {title}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-charcoal">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-charcoal">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-20 rounded-lg border border-border bg-cream p-3" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-black ${checked ? "bg-maroon text-white" : "border border-border bg-cream text-maroon"}`}>
      <span className="min-w-0">{label}</span>
      <span>{checked ? "On" : "Off"}</span>
    </button>
  );
}

function safeImage(src?: string) {
  return src?.startsWith("/") ? src : src || "/wah-thali-meal-cutout-v2.png";
}
