"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { BellRing, CheckCircle2, Clock3, CreditCard, ImagePlus, LocateFixed, MapPin, Play, Save, Settings2, Square, Store, Trash2, Truck, Volume2, VolumeX } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { adminFetch } from "@/lib/admin-client-auth";
import { defaultNewOrderSound, getNewOrderSound, getNewOrderSoundAudioSrc, getNewOrderSoundDurationMs, getNewOrderSoundSteps, newOrderSoundOptions } from "@/lib/order-sounds";
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
  ownerWhatsAppOrderAlerts: boolean;
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
  whatsappOrderAlerts: false,
  ownerWhatsAppOrderAlerts: true,
  adminDailyDigestTime: "21:00",
};

const storeModeOptions: { mode: StoreMode; label: string; helper: string }[] = [
  { mode: "OPEN", label: "Open now", helper: "Accept orders" },
  { mode: "BUSY", label: "Busy", helper: "Orders open" },
  { mode: "PAUSED", label: "Pause", helper: "Stop briefly" },
  { mode: "CLOSED", label: "Close now", helper: "Stop orders" },
];

const deliveryFeeModeOptions: { mode: "FLAT" | "PERCENT" | "DISTANCE"; label: string; helper: string }[] = [
  { mode: "FLAT", label: "Flat fee", helper: "Same charge for every delivery order" },
  { mode: "PERCENT", label: "Percentage", helper: "Charge a percent of the item total" },
  { mode: "DISTANCE", label: "Distance slabs", helper: "Set fees by customer distance in km" },
];

export function AdminSettingsClient({
  initialSettings,
  initialAdvanced,
  initialSlides,
  initialCategories,
  initialHomeDishCategories = [],
}: {
  initialSettings: BusinessSettings;
  initialAdvanced?: Partial<AdvancedSettings>;
  initialSlides: HomeSlide[];
  initialCategories: string[];
  initialHomeDishCategories?: string[];
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
    gstRate: formatPercentInput(initialSettings.gstRate),
    deliveryFeeMode: initialSettings.deliveryFeeMode,
    deliveryFeePercent: String(initialSettings.deliveryFeePercent),
    deliveryDistanceSlabs: formatDeliveryDistanceSlabs(initialSettings.deliveryDistanceSlabs),
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
  const [homeDishCategories, setHomeDishCategories] = useState(() =>
    initialHomeDishCategories.filter((category) => initialCategories.includes(category)),
  );
  const [homeDishesDirty, setHomeDishesDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [locatingKitchen, setLocatingKitchen] = useState(false);
  const [geocodingKitchen, setGeocodingKitchen] = useState(false);
  const [storeModeSaving, setStoreModeSaving] = useState<StoreMode | null>(null);
  const [lastPreviewedSound, setLastPreviewedSound] = useState<NewOrderSound | null>(null);
  const [previewingSound, setPreviewingSound] = useState<NewOrderSound | null>(null);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const soundPreviewContext = useRef<AudioContext | null>(null);
  const soundPreviewAudio = useRef<HTMLAudioElement | null>(null);
  const soundPreviewOscillators = useRef<OscillatorNode[]>([]);
  const soundPreviewTimer = useRef<number | null>(null);
  const adminAccess = useAdminAccess();
  const kitchenCoordinatesReady = hasValidCoordinate(settings.kitchenLatitude, 90) && hasValidCoordinate(settings.kitchenLongitude, 180);
  const deliverySlabRows = parseDeliveryDistanceSlabRows(settings.deliveryDistanceSlabs);
  const deliverySlabCount = parseDeliveryDistanceSlabs(settings.deliveryDistanceSlabs).length;

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
      const deliveryDistanceSlabs = parseDeliveryDistanceSlabs(settings.deliveryDistanceSlabs);
      if (settings.deliveryFeeMode === "DISTANCE" && deliveryDistanceSlabs.length === 0) {
        throw new Error("Add at least one distance slab before saving distance wise delivery charges.");
      }

      const response = await adminFetch(adminAccess?.session, "/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingHours,
          supportPhone: settings.supportPhone,
          whatsappNumber: settings.whatsappNumber,
          minimumOrder: Number(settings.minimumOrder),
          deliveryFee: Number(settings.deliveryFee),
          deliveryFeeMode: settings.deliveryFeeMode,
          deliveryFeePercent: Number(settings.deliveryFeePercent),
          deliveryDistanceSlabs,
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
          storeStatusReason: "",
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

  function applyDeliveryDistanceFormat() {
    const currentSlabs = parseDeliveryDistanceSlabs(settings.deliveryDistanceSlabs);
    const fallbackFee = Number(settings.deliveryFee);
    const starterFee = Number.isFinite(fallbackFee) && fallbackFee >= 0 ? fallbackFee : 20;
    setSettings({
      ...settings,
      deliveryFeeMode: "DISTANCE",
      deliveryDistanceSlabs: currentSlabs.length ? formatDeliveryDistanceSlabs(currentSlabs) : `1=${starterFee}`,
    });
    setMessage("Distance wise delivery is ready. Add each km slab and fee, then save delivery rules.");
  }

  function addNextDeliverySlab() {
    const currentSlabs = parseDeliveryDistanceSlabs(settings.deliveryDistanceSlabs);
    const lastSlab = currentSlabs.at(-1);
    const nextKm = lastSlab ? Math.ceil(lastSlab.upToKm) + 1 : 1;
    const fallbackFee = Number(settings.deliveryFee);
    const nextFee = lastSlab ? lastSlab.fee + 10 : (Number.isFinite(fallbackFee) && fallbackFee > 0 ? fallbackFee : 20);
    const nextSlabs = [...currentSlabs, { upToKm: nextKm, fee: nextFee }];

    setSettings({
      ...settings,
      deliveryFeeMode: "DISTANCE",
      deliveryDistanceSlabs: formatDeliveryDistanceSlabs(nextSlabs),
    });
    setMessage(`Added ${nextKm} km delivery slab. Update the fee if needed, then save.`);
  }

  function updateDeliverySlabRow(index: number, field: "upToKm" | "fee", value: string) {
    const rows = deliverySlabRows.length ? deliverySlabRows : [{ upToKm: "1", fee: "" }];
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    setSettings({ ...settings, deliveryFeeMode: "DISTANCE", deliveryDistanceSlabs: formatDeliveryDistanceSlabRows(nextRows) });
  }

  function removeDeliverySlabRow(index: number) {
    const nextRows = deliverySlabRows.filter((_, rowIndex) => rowIndex !== index);
    setSettings({ ...settings, deliveryFeeMode: "DISTANCE", deliveryDistanceSlabs: formatDeliveryDistanceSlabRows(nextRows) });
    setMessage(nextRows.length ? "Delivery slab removed. Review the remaining fees, then save." : "All distance slabs removed. Add at least one slab before saving.");
  }

  function stopOrderSoundPreview() {
    if (soundPreviewTimer.current !== null) {
      window.clearTimeout(soundPreviewTimer.current);
      soundPreviewTimer.current = null;
    }

    if (soundPreviewAudio.current) {
      soundPreviewAudio.current.pause();
      soundPreviewAudio.current.currentTime = 0;
    }
    soundPreviewAudio.current = null;
    soundPreviewOscillators.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Oscillators may already have ended.
      }
    });
    soundPreviewOscillators.current = [];
    setPreviewingSound(null);
  }

  useEffect(() => {
    return () => {
      stopOrderSoundPreview();
      void soundPreviewContext.current?.close();
    };
  }, []);

  async function previewOrderSound(sound: NewOrderSound) {
    if (previewingSound === sound) {
      stopOrderSoundPreview();
      setMessage(`${getSoundLabel(sound)} preview stopped.`);
      return;
    }

    stopOrderSoundPreview();
    const audioSrc = getNewOrderSoundAudioSrc(sound);
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.loop = false;
      soundPreviewAudio.current = audio;
      audio.currentTime = 0;
      const played = await audio.play().then(() => true).catch(() => false);
      if (!played) {
        soundPreviewAudio.current = null;
        setMessage("Sound preview is blocked. Click Preview again or allow sound in this browser.");
        return;
      }
      setLastPreviewedSound(sound);
      setPreviewingSound(sound);
      audio.addEventListener("ended", () => {
        if (soundPreviewAudio.current !== audio) return;
        soundPreviewTimer.current = null;
        soundPreviewAudio.current = null;
        setPreviewingSound((current) => current === sound ? null : current);
      }, { once: true });
      soundPreviewTimer.current = window.setTimeout(() => {
        soundPreviewTimer.current = null;
        if (soundPreviewAudio.current === audio) {
          audio.pause();
          audio.currentTime = 0;
          soundPreviewAudio.current = null;
        }
        setPreviewingSound((current) => current === sound ? null : current);
      }, getNewOrderSoundDurationMs(sound));
      setMessage(`Previewing ${newOrderSoundOptions.find((option) => option.id === sound)?.label ?? "order sound"}.`);
      return;
    }

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

    soundPreviewOscillators.current = playNewOrderSoundSteps(audio, sound);
    setLastPreviewedSound(sound);
    setPreviewingSound(sound);
    soundPreviewTimer.current = window.setTimeout(() => {
      soundPreviewTimer.current = null;
      soundPreviewOscillators.current = [];
      setPreviewingSound((current) => current === sound ? null : current);
    }, getNewOrderSoundDurationMs(sound));
    setMessage(`Previewing ${newOrderSoundOptions.find((option) => option.id === sound)?.label ?? "order sound"}.`);
  }

  async function publishNotificationSetting(patch: Partial<Pick<AdvancedSettings, "newOrderSoundEnabled" | "newOrderSound" | "whatsappOrderAlerts" | "ownerWhatsAppOrderAlerts" | "adminDailyDigestTime">>) {
    const previous = advanced;
    const nextAdvanced = { ...advanced, ...patch };
    setAdvanced(nextAdvanced);
    setNotificationSaving(true);
    setMessage("");

    if (patch.newOrderSoundEnabled === false) {
      stopOrderSoundPreview();
    }

    try {
      const response = await adminFetch(adminAccess?.session, "/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Notification setting save failed.");

      const storedSettings = data.settings ?? {};
      const storedSound = getNewOrderSound(storedSettings.newOrderSound ?? nextAdvanced.newOrderSound);
      const storedSoundEnabled = storedSettings.newOrderSoundEnabled ?? nextAdvanced.newOrderSoundEnabled;
      setAdvanced((current) => ({
        ...current,
        ...patch,
        newOrderSoundEnabled: storedSoundEnabled,
        newOrderSound: storedSound,
        whatsappOrderAlerts: storedSettings.whatsappOrderAlerts ?? nextAdvanced.whatsappOrderAlerts,
        ownerWhatsAppOrderAlerts: storedSettings.ownerWhatsAppOrderAlerts ?? nextAdvanced.ownerWhatsAppOrderAlerts,
        adminDailyDigestTime: storedSettings.adminDailyDigestTime ?? nextAdvanced.adminDailyDigestTime,
      }));
      window.dispatchEvent(new CustomEvent("wah-thali-admin-alert-settings-updated", {
        detail: {
          enabled: storedSoundEnabled,
          sound: storedSound,
        },
      }));
      setMessage(`Notification setting saved. New order sound ${storedSoundEnabled ? "On" : "Off"} - ${getSoundLabel(storedSound)}.`);
    } catch (error) {
      setAdvanced(previous);
      setMessage(error instanceof Error ? error.message : "Notification setting save failed.");
    } finally {
      setNotificationSaving(false);
    }
  }

  async function publishStoreMode(mode: StoreMode) {
    const nextReason = "";
    const previous = advanced;

    setAdvanced({ ...advanced, storeMode: mode, storeStatusReason: nextReason });
    setStoreModeSaving(mode);
    setMessage("");

    try {
      const response = await adminFetch(adminAccess?.session, "/api/settings", {
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
        eyebrow: "Slider image",
        title: "Slider image",
        body: "Image-only slider",
        code: "SLIDER",
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
    const confirmed = window.confirm(`Delete slider image for "${slide?.targetCategory ?? "All"}"?`);
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
      const response = await adminFetch(adminAccess?.session, "/api/home-slides", {
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

  function toggleHomeDishCategory(category: string) {
    setHomeDishCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
    setHomeDishesDirty(true);
  }

  function saveHomeDishCategories() {
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeDishCategories }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Home dishes save failed.");
      setHomeDishesDirty(false);
      setMessage(homeDishCategories.length ? "Home dishes saved. The home screen now uses your selected categories." : "Home dishes reset. The home screen will show popular dishes.");
    });
  }

  async function uploadImage(file: File, folder = "home-slides") {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const response = await adminFetch(adminAccess?.session, "/api/storage/upload", { method: "POST", body });
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
          const response = await fetch(`/api/maps/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`, { cache: "no-store" });
          const data = await response.json();
          kitchenAddress = data.result?.formattedAddress || data.result?.area || kitchenAddress;
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
      const response = await fetch(`/api/maps/geocode?address=${encodeURIComponent(address)}`, { cache: "no-store" });
      const data = await response.json();
      const result = data.result;
      if (!result?.latitude || !result?.longitude) {
        setMessage("Could not find coordinates for this address. Use device location or enter latitude and longitude manually.");
        return;
      }

      setSettings((current) => ({
        ...current,
        kitchenLatitude: result.latitude,
        kitchenLongitude: result.longitude,
        kitchenAddress: result.formattedAddress || current.kitchenAddress,
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
            <Toggle
              label="New order sound"
              checked={advanced.newOrderSoundEnabled}
              onChange={(value) => void publishNotificationSetting({ newOrderSoundEnabled: value })}
              disabled={notificationSaving}
            />
            <div className="grid gap-2">
              <p className="text-sm font-black text-charcoal">New order sound style</p>
              <div className="grid gap-2">
                {newOrderSoundOptions.map((option) => {
                  const active = advanced.newOrderSound === option.id;
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
                          <span className={`block text-[10px] font-black ${playing ? "text-[#0f7a45]" : "text-muted"}`}>
                            {playing ? "Playing" : lastPreviewedSound === option.id ? "Preview ready" : option.helper}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => previewOrderSound(option.id)}
                        className={`grid h-9 w-9 place-items-center rounded-lg text-white ${playing ? "bg-maroon" : "bg-charcoal"}`}
                        aria-label={playing ? `Stop ${option.label}` : `Preview ${option.label}`}
                      >
                        {playing ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void publishNotificationSetting({ newOrderSound: option.id })}
                        disabled={notificationSaving}
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
            <Toggle
              label="Customer WhatsApp updates"
              checked={advanced.whatsappOrderAlerts}
              onChange={(value) => void publishNotificationSetting({ whatsappOrderAlerts: value })}
              disabled={notificationSaving}
            />
            <Toggle
              label="Owner WhatsApp alerts"
              checked={advanced.ownerWhatsAppOrderAlerts}
              onChange={(value) => void publishNotificationSetting({ ownerWhatsAppOrderAlerts: value })}
              disabled={notificationSaving}
            />
            <Input label="Daily digest time" value={advanced.adminDailyDigestTime} onChange={(value) => setAdvanced({ ...advanced, adminDailyDigestTime: value })} onBlur={() => void publishNotificationSetting({ adminDailyDigestTime: advanced.adminDailyDigestTime })} />
            {notificationSaving ? <p className="text-xs font-black text-muted">Saving notification setting...</p> : null}
          </Panel>

          <Panel title="Delivery rules" icon={<Truck className="text-red" size={22} />}>
            <Input label="Minimum order" value={settings.minimumOrder} onChange={(value) => setSettings({ ...settings, minimumOrder: value })} />
            <Input
              label="Flat / fallback delivery fee"
              value={settings.deliveryFee}
              onChange={(value) => setSettings({ ...settings, deliveryFee: value })}
              helper="Used for flat delivery, and as fallback if distance cannot be calculated."
            />
            <div className="grid gap-3 text-sm font-bold text-charcoal">
              <div>
                <p>Delivery charge type</p>
                <p className="mt-1 text-xs font-bold leading-5 text-muted">Choose how customers are charged for delivery.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {deliveryFeeModeOptions.map((option) => {
                  const active = settings.deliveryFeeMode === option.mode;

                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => {
                        if (option.mode === "DISTANCE") {
                          applyDeliveryDistanceFormat();
                          return;
                        }
                        setSettings({ ...settings, deliveryFeeMode: option.mode as "FLAT" | "PERCENT" | "DISTANCE" });
                      }}
                      aria-pressed={active}
                      className={`grid min-h-20 content-center gap-1 rounded-lg px-4 py-3 text-left transition ${
                        active
                          ? "bg-maroon text-white"
                          : "border border-border bg-cream text-charcoal hover:border-maroon/40 hover:bg-white"
                      }`}
                    >
                      <span className={`text-sm font-black ${active ? "text-white" : "text-maroon"}`}>{option.label}</span>
                      <span className={`text-xs font-bold leading-5 ${active ? "text-white/85" : "text-muted"}`}>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {settings.deliveryFeeMode === "PERCENT" ? (
              <Input
                label="Delivery percentage"
                value={settings.deliveryFeePercent}
                onChange={(value) => setSettings({ ...settings, deliveryFeePercent: value })}
                helper="Example: 5 means delivery fee is 5% of item total after discount."
              />
            ) : null}
            {settings.deliveryFeeMode === "DISTANCE" ? (
              <div className="grid gap-4 rounded-xl border border-border bg-white p-4 text-sm font-bold text-charcoal">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-black text-charcoal">Distance wise delivery charges</p>
                    <p className="mt-1 max-w-xl text-xs font-bold leading-5 text-muted">
                      Set the delivery fee for each distance range. Customers are charged from the first slab that covers their distance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addNextDeliverySlab}
                    className="min-h-10 rounded-lg bg-maroon px-4 text-xs font-black text-white sm:min-w-28"
                  >
                    Add slab
                  </button>
                </div>

                {deliverySlabRows.length ? (
                  <div className="grid gap-3">
                    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 px-1 text-xs font-black uppercase text-muted sm:grid">
                      <span>Up to distance</span>
                      <span>Delivery fee</span>
                      <span />
                    </div>
                    {deliverySlabRows.map((slab, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-border bg-cream p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] sm:items-end">
                        <label className="grid gap-2">
                          <span className="text-xs font-black text-muted">Up to km</span>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={slab.upToKm}
                            onChange={(event) => updateDeliverySlabRow(index, "upToKm", event.target.value)}
                            className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-black text-charcoal"
                            aria-label={`Delivery slab ${index + 1} up to km`}
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-xs font-black text-muted">Fee Rs</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={slab.fee}
                            onChange={(event) => updateDeliverySlabRow(index, "fee", event.target.value)}
                            className="h-11 rounded-lg border border-border bg-white px-3 text-sm font-black text-charcoal"
                            aria-label={`Delivery slab ${index + 1} fee`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeDeliverySlabRow(index)}
                          className="grid h-11 w-full place-items-center rounded-lg border border-border bg-white text-red sm:w-11"
                          aria-label={`Remove delivery slab ${index + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-maroon/25 bg-cream px-4 py-5 text-sm font-bold leading-6 text-muted">
                    No distance charges added yet. Add a slab to start delivery pricing.
                  </div>
                )}

                <div className="flex flex-col gap-2 text-xs font-bold leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>Example: up to 3 km with fee Rs 40 means a 2.8 km order pays Rs 40.</span>
                  <span className="w-fit rounded-full bg-cream px-3 py-1 font-black text-maroon">{deliverySlabCount} valid slabs</span>
                </div>
              </div>
            ) : null}
            <Input
              label="Free delivery above order price"
              value={settings.freeDeliveryThreshold}
              onChange={(value) => setSettings({ ...settings, freeDeliveryThreshold: value })}
              helper="Example: 499 means orders of Rs 499 and above get free delivery. Use 0 to keep delivery fee on every order."
            />
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
            <button
              type="button"
              onClick={saveSettings}
              disabled={isPending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
            >
              <Save size={17} /> {isPending ? "Saving..." : "Save delivery rules"}
            </button>
          </Panel>

          <Panel title="Payments and tax" icon={<CreditCard className="text-red" size={22} />}>
            <Input
              label="GST percentage"
              value={settings.gstRate}
              onChange={(value) => setSettings({ ...settings, gstRate: value })}
              helper="Example: enter 5 for 5% GST. It is calculated as a percentage of order price plus fees."
            />
            <Toggle label="COD enabled" checked={advanced.codEnabled} onChange={(value) => setAdvanced({ ...advanced, codEnabled: value })} />
            <Toggle label="Online payments enabled" checked={advanced.onlinePaymentsEnabled} onChange={(value) => setAdvanced({ ...advanced, onlinePaymentsEnabled: value })} />
          </Panel>

          <Panel title="Contact numbers" icon={<Settings2 className="text-red" size={22} />}>
            <Input
              label="Support phone"
              value={settings.supportPhone}
              onChange={(value) => setSettings({ ...settings, supportPhone: value })}
              helper="Shown on customer Call buttons. Example: 7001323730."
            />
            <Input
              label="WhatsApp number"
              value={settings.whatsappNumber}
              onChange={(value) => setSettings({ ...settings, whatsappNumber: value })}
              helper="Used for customer WhatsApp buttons and owner new/cancelled order alerts. Include country code without +. Example: 917001323730."
            />
            <p className="rounded-lg border border-[#c7ecd2] bg-[#effaf4] px-3 py-2 text-xs font-black leading-5 text-[#0f7a45]">
              Delivery availability is controlled by the kilometer radius settings above. These contact numbers update the website call and WhatsApp links after saving.
            </p>
          </Panel>
        </section>

        <section className="mt-6 surface rounded-2xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <CheckCircle2 className="text-red" /> Home dishes
              </h2>
              <p className="text-sm font-semibold text-muted">
                Choose the daily categories shown in the home screen dishes section.
                {homeDishesDirty ? " Unsaved home dishes changes." : " Home dishes are saved."}
              </p>
            </div>
            <button disabled={isPending || !homeDishesDirty} onClick={saveHomeDishCategories} className="h-10 min-w-40 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60">
              {isPending ? "Saving..." : homeDishesDirty ? "Save home dishes" : "Saved"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {initialCategories.map((category) => {
              const selected = homeDishCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleHomeDishCategory(category)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
                    selected
                      ? "border-maroon bg-maroon text-white"
                      : "border-border bg-white text-charcoal hover:border-maroon/40 hover:text-maroon"
                  }`}
                  aria-pressed={selected}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded border ${selected ? "border-white bg-white text-maroon" : "border-border bg-cream text-transparent"}`}>
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </span>
                  {category}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setHomeDishCategories([]); setHomeDishesDirty(true); }} className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-black text-maroon">
              Use popular dishes
            </button>
            <p className="text-xs font-bold leading-5 text-muted">
              {homeDishCategories.length ? `${homeDishCategories.length} selected: ${homeDishCategories.join(", ")}` : "No category selected. Home will show popular dishes."}
            </p>
          </div>
        </section>

        <section className="mt-6 surface rounded-2xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <ImagePlus className="text-red" /> Homepage slider
              </h2>
              <p className="text-sm font-semibold text-muted">
                Upload image-only slider banners and connect each banner to a customer category.
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
                  <label className="grid gap-2 text-sm font-bold text-charcoal">
                    Click opens category
                    <select value={slide.targetCategory ?? "All"} onChange={(event) => updateSlide(index, { targetCategory: event.target.value })} className="h-11 rounded-lg border border-border bg-white px-3">
                      <option value="All">All food</option>
                      {initialCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-2 text-sm font-bold text-charcoal">
                  <span>Slider image</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeImage(slide.image)} alt="" className="aspect-[390/166] w-full rounded-lg object-cover" />
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
                    <button type="button" onClick={() => deleteSlide(index)} className="grid h-11 w-12 place-items-center rounded-lg border border-border bg-white text-red" aria-label={`Delete slider image ${index + 1}`}>
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

function Input({ label, value, onChange, onBlur, type = "text", helper }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; type?: string; helper?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-charcoal">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className="h-11 rounded-lg border border-border bg-cream px-3" />
      {helper ? <span className="text-xs font-bold leading-5 text-muted">{helper}</span> : null}
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

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} disabled={disabled} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-black disabled:cursor-wait disabled:opacity-70 ${checked ? "bg-maroon text-white" : "border border-border bg-cream text-maroon"}`}>
      <span className="flex min-w-0 items-center gap-2">
        {label === "New order sound" ? (checked ? <Volume2 size={16} /> : <VolumeX size={16} />) : null}
        <span className="min-w-0">{label}</span>
      </span>
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

function formatPercentInput(rate: number) {
  if (!Number.isFinite(rate)) return "0";
  const percent = rate <= 1 ? rate * 100 : rate;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
}

function formatDeliveryDistanceSlabs(slabs: BusinessSettings["deliveryDistanceSlabs"]) {
  return slabs.map((slab) => `${slab.upToKm}=${slab.fee}`).join("\n");
}

function formatDeliveryDistanceSlabRows(rows: { upToKm: string; fee: string }[]) {
  return rows.map((row) => `${row.upToKm}=${row.fee}`).join("\n");
}

function parseDeliveryDistanceSlabRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const [upToKm = "", fee = ""] = line.split(/[=,:\-]/).map((part) => part.trim());
      return { upToKm, fee };
    })
    .filter((item) => item.upToKm || item.fee)
    .slice(0, 20);
}

function parseDeliveryDistanceSlabs(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const [upToKm, fee] = line.split(/[=,:\-]/).map((part) => part.trim());
      return { upToKm: Number(upToKm), fee: Number(fee) };
    })
    .filter((item) => Number.isFinite(item.upToKm) && item.upToKm > 0 && Number.isFinite(item.fee) && item.fee >= 0)
    .sort((a, b) => a.upToKm - b.upToKm)
    .slice(0, 20);
}

function playNewOrderSoundSteps(audio: AudioContext, sound: NewOrderSound) {
  const now = audio.currentTime;
  const oscillators: OscillatorNode[] = [];

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
    oscillators.push(oscillator);
  });

  return oscillators;
}

function hasValidCoordinate(value: string, maxAbs: number) {
  const numeric = Number(value);
  return value.trim() !== "" && Number.isFinite(numeric) && Math.abs(numeric) <= maxAbs;
}
