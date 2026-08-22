"use client";

import { useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { BellRing, CheckCircle2, Clock3, CreditCard, ImagePlus, LocateFixed, MapPin, Play, Save, Settings2, Store, Trash2, Truck, Volume2 } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { defaultNewOrderSound, getNewOrderSound, getNewOrderSoundSteps, newOrderSoundOptions } from "@/lib/order-sounds";
import { buildOpeningHours, minutesToTimeInput, parseOpeningHours } from "@/lib/store-hours";
import type { BusinessSettings, HomeSlide, NewOrderSound, StoreMode } from "@/lib/types";

type AdvancedSettings = {
  storeMode: StoreMode;
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
  newOrderSound: NewOrderSound;
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
  newOrderSound: defaultNewOrderSound,
  whatsappOrderAlerts: true,
  adminDailyDigestTime: "21:00",
};

const storeModeOptions: { mode: StoreMode; label: string; helper: string }[] = [
  { mode: "OPEN", label: "Open now", helper: "Accept orders" },
  { mode: "BUSY", label: "Busy", helper: "Orders open" },
  { mode: "PAUSED", label: "Pause", helper: "Stop briefly" },
  { mode: "CLOSED", label: "Close now", helper: "Stop orders" },
];

function defaultStoreModeReason(mode: StoreMode) {
  if (mode === "CLOSED") return "Store is closed right now. Please wait for opening hours.";
  if (mode === "PAUSED") return "Ordering is paused for a short time. Please check back soon.";
  return "";
}

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
  const initialHours = parseOpeningHours(initialSettings.openingHours);
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
    locationRestrictionEnabled: initialSettings.locationRestrictionEnabled,
    kitchenAddress: initialSettings.kitchenAddress,
    kitchenLatitude: initialSettings.kitchenLatitude,
    kitchenLongitude: initialSettings.kitchenLongitude,
    deliveryRadiusKm: String(initialSettings.deliveryRadiusKm),
  });
  const [storeHours, setStoreHours] = useState({
    opensAt: initialHours ? minutesToTimeInput(initialHours.openingMinutes) : "11:30",
    closesAt: initialHours ? minutesToTimeInput(initialHours.closingMinutes) : "22:00",
  });
  const [advanced, setAdvanced] = useState<AdvancedSettings>({
    ...defaultAdvanced,
    ...initialAdvanced,
    newOrderSound: getNewOrderSound(initialAdvanced?.newOrderSound),
    maxOrdersPerSlot: String(initialAdvanced?.maxOrdersPerSlot ?? defaultAdvanced.maxOrdersPerSlot),
    defaultPrepMinutes: String(initialAdvanced?.defaultPrepMinutes ?? defaultAdvanced.defaultPrepMinutes),
    rushPrepBufferMinutes: String(initialAdvanced?.rushPrepBufferMinutes ?? defaultAdvanced.rushPrepBufferMinutes),
    lastOrderBufferMinutes: String(initialAdvanced?.lastOrderBufferMinutes ?? defaultAdvanced.lastOrderBufferMinutes),
    lowStockAlertThreshold: String(initialAdvanced?.lowStockAlertThreshold ?? defaultAdvanced.lowStockAlertThreshold),
  });
  const [slides, setSlides] = useState(initialSlides);
  const [slidesDirty, setSlidesDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [locatingKitchen, setLocatingKitchen] = useState(false);
  const [geocodingKitchen, setGeocodingKitchen] = useState(false);
  const [storeModeSaving, setStoreModeSaving] = useState<StoreMode | null>(null);
  const [lastPreviewedSound, setLastPreviewedSound] = useState<NewOrderSound | null>(null);
  const [previewingSound, setPreviewingSound] = useState<NewOrderSound | null>(null);
  const [isPending, startTransition] = useTransition();
  const soundPreviewContext = useRef<AudioContext | null>(null);
  const kitchenCoordinatesReady = hasValidCoordinate(settings.kitchenLatitude, 90) && hasValidCoordinate(settings.kitchenLongitude, 180);

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
      const openingHours = buildOpeningHours(storeHours.opensAt, storeHours.closesAt);
      if (!openingHours) {
        throw new Error("Please choose valid opening and closing times.");
      }
      if (settings.locationRestrictionEnabled && !kitchenCoordinatesReady) {
        throw new Error("Kitchen latitude and longitude are required before enabling delivery radius restriction.");
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingHours,
          supportPhone: settings.supportPhone,
          whatsappNumber: settings.whatsappNumber,
          minimumOrder: Number(settings.minimumOrder),
          deliveryFee: Number(settings.deliveryFee),
          freeDeliveryThreshold: Number(settings.freeDeliveryThreshold),
          packagingFee: Number(settings.packagingFee),
          gstRate: Number(settings.gstRate),
          serviceablePins: settings.serviceablePins.split(",").map((pin) => pin.trim()).filter(Boolean),
          locationRestrictionEnabled: settings.locationRestrictionEnabled,
          kitchenAddress: settings.kitchenAddress,
          kitchenLatitude: settings.kitchenLatitude,
          kitchenLongitude: settings.kitchenLongitude,
          deliveryRadiusKm: Number(settings.deliveryRadiusKm),
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
      setSettings((current) => ({ ...current, openingHours: data.settings?.openingHours ?? openingHours }));
      window.dispatchEvent(new CustomEvent("wah-thali-admin-alert-settings-updated", {
        detail: {
          enabled: advanced.newOrderSoundEnabled,
          sound: advanced.newOrderSound,
        },
      }));
      const storedSettings = data.settings ?? {};
      const storedSoundEnabled = storedSettings.newOrderSoundEnabled ?? advanced.newOrderSoundEnabled;
      const storedSound = getNewOrderSound(storedSettings.newOrderSound ?? advanced.newOrderSound);
      const storedHours = storedSettings.openingHours ?? openingHours;
      const storedMode = storedSettings.storeMode ?? advanced.storeMode;
      setMessage([
        "Settings saved and stored successfully.",
        `Stored values: Store hours ${storedHours}, Store mode ${storedMode}, New order sound ${storedSoundEnabled ? "On" : "Off"} - ${getSoundLabel(storedSound)}.`,
      ].join("\n"));
    });
  }

  async function previewOrderSound(sound: NewOrderSound) {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setMessage("This browser does not support order sound previews.");
      return;
    }

    const audio = soundPreviewContext.current ?? new AudioContextClass();
    soundPreviewContext.current = audio;
    if (audio.state === "suspended") {
      await audio.resume().catch(() => undefined);
    }
    if (audio.state === "suspended") {
      setMessage("Sound preview is blocked. Click Preview again or allow sound in this browser.");
      return;
    }

    playNewOrderSoundSteps(audio, sound);
    setLastPreviewedSound(sound);
    setPreviewingSound(sound);
    window.setTimeout(() => {
      setPreviewingSound((current) => current === sound ? null : current);
    }, 850);
    setMessage(`Previewing ${newOrderSoundOptions.find((option) => option.id === sound)?.label ?? "order sound"}.`);
  }

  async function publishStoreMode(mode: StoreMode) {
    const nextReason = mode === "OPEN" || mode === "BUSY" ? "" : advanced.storeStatusReason.trim() || defaultStoreModeReason(mode);
    const previous = advanced;

    setAdvanced({ ...advanced, storeMode: mode, storeStatusReason: nextReason });
    setStoreModeSaving(mode);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeMode: mode,
          storeStatusReason: nextReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Store mode update failed.");

      setAdvanced((current) => ({
        ...current,
        storeMode: data.settings?.storeMode ?? mode,
        storeStatusReason: data.settings?.storeStatusReason ?? nextReason,
      }));
      setMessage(mode === "OPEN" ? "Store opened live. Customers can place orders during opening hours." : `Store mode changed to ${mode.toLowerCase()} live.`);
    } catch (error) {
      setAdvanced(previous);
      setMessage(error instanceof Error ? error.message : "Store mode update failed.");
    } finally {
      setStoreModeSaving(null);
    }
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

  function detectKitchenLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("Location detection is not supported on this browser.");
      return;
    }

    setLocatingKitchen(true);
    setMessage("Detecting kitchen location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        let kitchenAddress = settings.kitchenAddress;

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          kitchenAddress = data.display_name || kitchenAddress;
        } catch {
          kitchenAddress = kitchenAddress || "Detected kitchen location";
        }

        setSettings((current) => ({
          ...current,
          kitchenAddress,
          kitchenLatitude: latitude,
          kitchenLongitude: longitude,
          locationRestrictionEnabled: true,
        }));
        setMessage("Kitchen location detected. Click Save settings to publish the delivery radius.");
        setLocatingKitchen(false);
      },
      (error) => {
        setMessage(error.message || "Location permission was denied.");
        setLocatingKitchen(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function findKitchenCoordinatesFromAddress() {
    const address = settings.kitchenAddress.trim();
    if (!address) {
      setMessage("Enter the kitchen address first.");
      return;
    }

    setGeocodingKitchen(true);
    setMessage("Finding kitchen coordinates from address...");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      const first = Array.isArray(data) ? data[0] : null;
      if (!first?.lat || !first?.lon) {
        setMessage("Could not find coordinates for this address. Use device location or enter latitude and longitude manually.");
        return;
      }

      setSettings((current) => ({
        ...current,
        kitchenLatitude: Number(first.lat).toFixed(6),
        kitchenLongitude: Number(first.lon).toFixed(6),
        locationRestrictionEnabled: true,
      }));
      setMessage("Kitchen coordinates found. Click Save settings to publish the delivery radius.");
    } catch {
      setMessage("Could not find kitchen coordinates right now. Use device location or enter latitude and longitude manually.");
    } finally {
      setGeocodingKitchen(false);
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

        {message ? (
          <p className={`mt-4 whitespace-pre-line rounded-lg border px-4 py-3 text-sm font-black ${
            message.startsWith("Settings saved")
              ? "border-[#bfe7cc] bg-[#effaf4] text-[#0f7a45]"
              : "border-border bg-cream text-maroon"
          }`}>
            {message}
          </p>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <Panel title="Store mode" icon={<Store className="text-red" size={22} />}>
            <div className="rounded-2xl border border-border bg-cream p-2">
              <p className="px-2 pb-2 text-xs font-black uppercase tracking-widest text-muted">Live store switch</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {storeModeOptions.map((option) => {
                  const active = advanced.storeMode === option.mode;
                  const saving = storeModeSaving === option.mode;

                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => publishStoreMode(option.mode)}
                      disabled={storeModeSaving !== null}
                      className={`min-h-16 rounded-xl px-4 py-3 text-left shadow-sm transition disabled:cursor-wait disabled:opacity-70 ${
                        active
                          ? "bg-maroon text-white ring-2 ring-maroon"
                          : "border border-border bg-white text-charcoal hover:border-maroon/50 hover:text-maroon"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-base font-black">{saving ? "Updating..." : option.label}</span>
                        <span className={`h-3 w-3 rounded-full ${active ? "bg-white" : option.mode === "OPEN" || option.mode === "BUSY" ? "bg-green-600" : "bg-red"}`} />
                      </span>
                      <span className={`mt-1 block text-xs font-bold ${active ? "text-white/75" : "text-muted"}`}>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-maroon">
                Current live mode: {advanced.storeMode}
              </p>
            </div>
            <Input label="Customer status reason" value={advanced.storeStatusReason} onChange={(value) => setAdvanced({ ...advanced, storeStatusReason: value })} />
            <Textarea label="Busy message" value={advanced.busyMessage} onChange={(value) => setAdvanced({ ...advanced, busyMessage: value })} />
            <Textarea label="Paused message" value={advanced.pausedMessage} onChange={(value) => setAdvanced({ ...advanced, pausedMessage: value })} />
            <Textarea label="Closed message" value={advanced.closedMessage} onChange={(value) => setAdvanced({ ...advanced, closedMessage: value })} />
            <Toggle label="Auto accept orders" checked={advanced.autoAcceptOrders} onChange={(value) => setAdvanced({ ...advanced, autoAcceptOrders: value })} />
            <Toggle label="Require decline reason" checked={advanced.requireDeclineReason} onChange={(value) => setAdvanced({ ...advanced, requireDeclineReason: value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="time" label="Opening time" value={storeHours.opensAt} onChange={(value) => setStoreHours({ ...storeHours, opensAt: value })} />
              <Input type="time" label="Closing time" value={storeHours.closesAt} onChange={(value) => setStoreHours({ ...storeHours, closesAt: value })} />
            </div>
            <p className="rounded-lg border border-border bg-cream px-3 py-2 text-xs font-black text-maroon">
              Customer display: {buildOpeningHours(storeHours.opensAt, storeHours.closesAt) ?? settings.openingHours}
            </p>
          </Panel>

          <Panel title="Kitchen timing" icon={<Clock3 className="text-red" size={22} />}>
            <Input label="Default prep minutes" value={advanced.defaultPrepMinutes} onChange={(value) => setAdvanced({ ...advanced, defaultPrepMinutes: value })} />
            <Input label="Rush buffer minutes" value={advanced.rushPrepBufferMinutes} onChange={(value) => setAdvanced({ ...advanced, rushPrepBufferMinutes: value })} />
            <Input label="Last order buffer minutes" value={advanced.lastOrderBufferMinutes} onChange={(value) => setAdvanced({ ...advanced, lastOrderBufferMinutes: value })} />
            <Input label="Max orders per slot" value={advanced.maxOrdersPerSlot} onChange={(value) => setAdvanced({ ...advanced, maxOrdersPerSlot: value })} />
          </Panel>

          <Panel title="Notifications" icon={<BellRing className="text-red" size={22} />}>
            <Toggle label="New order sound" checked={advanced.newOrderSoundEnabled} onChange={(value) => setAdvanced({ ...advanced, newOrderSoundEnabled: value })} />
            <div className="grid gap-2">
              <p className="text-sm font-black text-charcoal">New order sound style</p>
              <div className="grid gap-2">
                {newOrderSoundOptions.map((option) => {
                  const active = advanced.newOrderSound === option.id;
                  const previewed = lastPreviewedSound === option.id;
                  const playing = previewingSound === option.id;

                  return (
                    <div
                      key={option.id}
                      className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border bg-white px-3 py-2 transition ${
                        active ? "border-maroon bg-[#fff8f9]" : "border-[#e6e9ef]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          active ? "bg-maroon text-white" : "bg-[#f7f8fb] text-maroon ring-1 ring-[#e8edf3]"
                        }`}>
                          {active ? <CheckCircle2 size={16} /> : <Volume2 size={16} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-charcoal">{option.label}</span>
                          {playing ? <span className="block text-[10px] font-black text-[#0f7a45]">Playing</span> : null}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => previewOrderSound(option.id)}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-charcoal text-white"
                        aria-label={`Preview ${option.label}`}
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvanced({ ...advanced, newOrderSound: option.id })}
                        disabled={!previewed && !active}
                        className={`h-9 min-w-16 rounded-lg px-3 text-xs font-black disabled:opacity-45 ${
                          active ? "bg-white text-maroon ring-1 ring-[#efd8de]" : "bg-maroon text-white"
                        }`}
                      >
                        {active ? "Using" : "Use"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <Toggle label="WhatsApp order alerts" checked={advanced.whatsappOrderAlerts} onChange={(value) => setAdvanced({ ...advanced, whatsappOrderAlerts: value })} />
            <Input label="Low stock alert threshold" value={advanced.lowStockAlertThreshold} onChange={(value) => setAdvanced({ ...advanced, lowStockAlertThreshold: value })} />
            <Input label="Daily digest time" value={advanced.adminDailyDigestTime} onChange={(value) => setAdvanced({ ...advanced, adminDailyDigestTime: value })} />
          </Panel>

          <Panel title="Delivery rules" icon={<Truck className="text-red" size={22} />}>
            <Input label="Minimum order" value={settings.minimumOrder} onChange={(value) => setSettings({ ...settings, minimumOrder: value })} />
            <Input label="Delivery fee" value={settings.deliveryFee} onChange={(value) => setSettings({ ...settings, deliveryFee: value })} />
            <Input label="Free delivery threshold" value={settings.freeDeliveryThreshold} onChange={(value) => setSettings({ ...settings, freeDeliveryThreshold: value })} />
            <Input label="Packaging fee" value={settings.packagingFee} onChange={(value) => setSettings({ ...settings, packagingFee: value })} />
            <Toggle label="Allow orders only inside delivery radius" checked={settings.locationRestrictionEnabled} onChange={(value) => setSettings({ ...settings, locationRestrictionEnabled: value })} />
            <Input label="Allowed delivery radius in km" value={settings.deliveryRadiusKm} onChange={(value) => setSettings({ ...settings, deliveryRadiusKm: value })} />
            <Input label="Kitchen address" value={settings.kitchenAddress} onChange={(value) => setSettings({ ...settings, kitchenAddress: value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Kitchen latitude" value={settings.kitchenLatitude} onChange={(value) => setSettings({ ...settings, kitchenLatitude: value })} />
              <Input label="Kitchen longitude" value={settings.kitchenLongitude} onChange={(value) => setSettings({ ...settings, kitchenLongitude: value })} />
            </div>
            {settings.locationRestrictionEnabled && !kitchenCoordinatesReady ? (
              <p className="rounded-lg border border-red/25 bg-[#fff4f5] px-3 py-2 text-xs font-black leading-5 text-maroon">
                Radius restriction is On, but kitchen coordinates are missing. Add latitude and longitude, then save settings.
              </p>
            ) : settings.locationRestrictionEnabled ? (
              <p className="rounded-lg border border-[#c7ecd2] bg-[#effaf4] px-3 py-2 text-xs font-black leading-5 text-[#0f7a45]">
                Strict radius is active. Customers outside {settings.deliveryRadiusKm || "0"} km cannot place orders.
              </p>
            ) : null}
            <button
              type="button"
              onClick={findKitchenCoordinatesFromAddress}
              disabled={geocodingKitchen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-maroon/25 bg-white px-3 text-sm font-black text-maroon disabled:cursor-wait disabled:opacity-60"
            >
              <MapPin size={17} /> {geocodingKitchen ? "Finding..." : "Find coordinates from kitchen address"}
            </button>
            <button
              type="button"
              onClick={detectKitchenLocation}
              disabled={locatingKitchen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-maroon/25 bg-cream px-3 text-sm font-black text-maroon disabled:cursor-wait disabled:opacity-60"
            >
              <LocateFixed size={17} /> {locatingKitchen ? "Detecting..." : "Use this device location as kitchen"}
            </button>
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

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-charcoal">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3" />
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

function getSoundLabel(sound: NewOrderSound) {
  return newOrderSoundOptions.find((option) => option.id === sound)?.label ?? "Classic bell";
}

function playNewOrderSoundSteps(audio: AudioContext, sound: NewOrderSound) {
  const now = audio.currentTime;

  getNewOrderSoundSteps(sound).forEach((step) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = step.wave;
    oscillator.frequency.value = step.frequency;
    oscillator.connect(gain);
    gain.connect(audio.destination);

    const start = now + step.startMs / 1000;
    const end = start + step.durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(step.gain, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}

function hasValidCoordinate(value: string, maxAbs: number) {
  const numeric = Number(value);
  return value.trim() !== "" && Number.isFinite(numeric) && Math.abs(numeric) <= maxAbs;
}
