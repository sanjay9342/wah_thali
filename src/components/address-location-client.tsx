"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  Home,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { extractPinCode, getDeliveryLocationCoverage, saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import type { RestaurantSettings } from "@/lib/types";

type AddressTag = "Home" | "Work" | "Other";
type ScreenMode = "select" | "add";

type SavedAddress = {
  id: string;
  tag: AddressTag;
  label?: string;
  area: string;
  details: string;
  pinCode: string;
  receiver: string;
  phone: string;
  distance: string;
  latitude?: string;
  longitude?: string;
};

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  pinCode: string;
  latitude: string;
  longitude: string;
};

type PinPosition = {
  x: number;
  y: number;
};

const storageKey = "wah-thali-addresses";
const defaultArea = "Select delivery location";

function readSavedAddresses() {
  if (typeof window === "undefined") return [] as SavedAddress[];

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as SavedAddress[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item.id?.startsWith("address-")) : [];
  } catch {
    return [];
  }
}

function getAddressLabel(tag: AddressTag, customLabel?: string) {
  if (tag !== "Other") return tag;
  return customLabel?.trim() || "Other";
}

function getAreaFromNominatim(data: Record<string, unknown>, fallback: string) {
  const address = (data.address ?? {}) as Record<string, string | undefined>;
  const parts = [
    address.suburb,
    address.neighbourhood,
    address.village,
    address.town,
    address.city,
    address.county,
    address.state,
  ].filter(Boolean);

  return parts.slice(0, 3).join(", ") || (typeof data.display_name === "string" ? data.display_name : fallback);
}

function getSearchTitle(data: Record<string, unknown>) {
  const address = (data.address ?? {}) as Record<string, string | undefined>;
  return (
    address.suburb ||
    address.neighbourhood ||
    address.village ||
    address.town ||
    address.city ||
    (typeof data.name === "string" ? data.name : "") ||
    "Selected location"
  );
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export function AddressLocationClient({ restaurantSettings }: { restaurantSettings: RestaurantSettings }) {
  const router = useRouter();
  const deliveryLocation = useDeliveryLocation();
  const supportMobile = cleanPhone(restaurantSettings.supportPhone);
  const supportMobileRef = useRef(supportMobile);
  supportMobileRef.current = supportMobile;
  const [mode, setMode] = useState<ScreenMode>("select");
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedAddressesLoaded, setSavedAddressesLoaded] = useState(false);
  const [activeAddressActionsId, setActiveAddressActionsId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [markerPosition, setMarkerPosition] = useState<PinPosition>({ x: 50, y: 43 });
  const [address, setAddress] = useState({
    area: deliveryLocation.address === defaultArea ? "" : deliveryLocation.address,
    details: "",
    pinCode: deliveryLocation.pinCode ?? extractPinCode(deliveryLocation.address),
    receiver: "",
    phone: "",
    tag: "Home" as AddressTag,
    customLabel: "",
    latitude: deliveryLocation.latitude ?? "",
    longitude: deliveryLocation.longitude ?? "",
  });

  const currentArea = address.area || (deliveryLocation.address === defaultArea ? "" : deliveryLocation.address);
  const recentAddresses = useMemo(() => savedAddresses.slice(0, 5), [savedAddresses]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedSupportMobile = supportMobileRef.current;
      setSavedAddresses(readSavedAddresses().map((item) => ({
        ...item,
        receiver: item.receiver === "Customer" && cleanPhone(item.phone) === storedSupportMobile ? "" : item.receiver,
        phone: cleanPhone(item.phone) === storedSupportMobile ? "" : cleanPhone(item.phone),
      })));
      setSavedAddressesLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!savedAddressesLoaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(savedAddresses));
  }, [savedAddresses, savedAddressesLoaded]);

  useEffect(() => {
    function refreshSession() {
      const session = readCustomerSession();
      setCustomerSession(session);
      if (!session) return;

      setAddress((current) => ({
        ...current,
        receiver: session.name,
        phone: session.mobile,
      }));
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    const searchText = query.trim();
    if (searchText.length < 3) {
      const timeoutId = window.setTimeout(() => {
        setSearchResults([]);
        setSearching(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(searchText)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as Array<Record<string, unknown>>;
        setSearchResults(
          data.map((item, index) => {
            const displayName = typeof item.display_name === "string" ? item.display_name : searchText;
            const title = getSearchTitle(item);
            return {
              id: String(item.place_id ?? `${displayName}-${index}`),
              title,
              subtitle: displayName,
              pinCode: extractPinCode(displayName),
              latitude: typeof item.lat === "string" ? Number(item.lat).toFixed(6) : "",
              longitude: typeof item.lon === "string" ? Number(item.lon).toFixed(6) : "",
            };
          }),
        );
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  async function syncAddressToCustomer(item: SavedAddress, isDefault: boolean) {
    const session = readCustomerSession();
    if (!session?.mobile) {
      setMessage("Location saved on this device. Login to sync it to your profile.");
      return;
    }

    try {
      const response = await fetch("/api/customers/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: session.mobile,
          label: item.label || item.tag,
          line1: item.details,
          area: item.area,
          city: "",
          state: "",
          pinCode: item.pinCode,
          landmark: [item.receiver, item.phone].filter(Boolean).length ? `Receiver: ${[item.receiver, item.phone].filter(Boolean).join(", ")}` : undefined,
          isDefault,
        }),
      });
      const data = (await response.json()) as { error?: string };
      setMessage(response.ok ? "Location saved to your customer profile." : data.error || "Saved here, but profile sync failed.");
    } catch {
      setMessage("Saved here, but profile sync failed. Please try again.");
    }
  }

  function upsertSavedAddress(next: SavedAddress) {
    setSavedAddresses((current) => [
      next,
      ...current.filter((item) => {
        if (item.id === next.id) return false;
        const sameCoordinates = item.latitude && next.latitude && item.latitude === next.latitude && item.longitude === next.longitude;
        const sameAddress = `${item.details}, ${item.area}`.toLowerCase() === `${next.details}, ${next.area}`.toLowerCase();
        return !sameCoordinates && !sameAddress;
      }),
    ]);
  }

  function buildSavedAddress(partial: Partial<SavedAddress> & { area: string }) {
    const session = readCustomerSession();
    const label = partial.label || getAddressLabel(address.tag, address.customLabel);
    return {
      id: partial.id || `address-${Date.now()}`,
      tag: partial.tag || address.tag,
      label,
      area: partial.area,
      details: partial.details?.trim() || partial.area,
      pinCode: partial.pinCode || extractPinCode(`${partial.details ?? ""}, ${partial.area}`),
      receiver: partial.receiver ?? session?.name ?? address.receiver,
      phone: cleanPhone(partial.phone ?? session?.mobile ?? address.phone ?? ""),
      distance: partial.distance || (partial.latitude ? "0 m" : "Saved"),
      latitude: partial.latitude || address.latitude,
      longitude: partial.longitude || address.longitude,
    } satisfies SavedAddress;
  }

  async function saveDetectedAddress(area: string, pinCode: string, latitude: string, longitude: string) {
    const next = buildSavedAddress({
      tag: "Home",
      label: "Home",
      area,
      details: area,
      pinCode,
      latitude,
      longitude,
      distance: "0 m",
    });

    setMarkerPosition({ x: 50, y: 43 });
    setAddress((current) => ({
      ...current,
      area,
      details: current.details,
      pinCode,
      latitude,
      longitude,
      receiver: next.receiver,
      phone: next.phone,
      tag: "Home",
    }));
    saveDeliveryLocation({ label: next.label || "Home", address: area, pinCode, latitude, longitude });
    upsertSavedAddress(next);
    await syncAddressToCustomer(next, true);
  }

  async function updateLocationFromMovedPin(position: PinPosition) {
    if (!address.latitude || !address.longitude) {
      setMessage("Detecting your current location first...");
      void detectLocation(true);
      return;
    }

    const latitude = (Number(address.latitude) - (position.y - 43) * 0.00008).toFixed(6);
    const longitude = (Number(address.longitude) + (position.x - 50) * 0.00008).toFixed(6);
    let area = address.area || "Selected location";
    let pinCode = address.pinCode;

    setLocating(true);
    setMessage("Detecting moved pin location...");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`);
      const data = (await response.json()) as Record<string, unknown>;
      const displayName = typeof data.display_name === "string" ? data.display_name : "";
      area = getAreaFromNominatim(data, area);
      pinCode = extractPinCode(displayName) || pinCode;
    } catch {
      area = address.area || "Moved pin location";
    }

    setAddress((current) => ({ ...current, area, pinCode, latitude, longitude }));
    saveDeliveryLocation({ label: getAddressLabel(address.tag, address.customLabel), address: area, pinCode, latitude, longitude });
    setMessage("Moved pin location detected.");
    setLocating(false);
  }

  async function detectLocation(openAddScreen = false) {
    if (!("geolocation" in navigator)) {
      setMessage("Location detection is not supported on this browser.");
      return;
    }

    setLocating(true);
    setMessage("Detecting your current location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        let area = query.trim() || "Current location";
        let pinCode = "";

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`);
          const data = (await response.json()) as Record<string, unknown>;
          const displayName = typeof data.display_name === "string" ? data.display_name : "";
          area = getAreaFromNominatim(data, area);
          pinCode = extractPinCode(displayName);
        } catch {
          area = query.trim() || "Current location";
        }

        await saveDetectedAddress(area, pinCode, latitude, longitude);
        if (openAddScreen) setMode("add");
        setLocating(false);
      },
      (error) => {
        setMessage(error.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function chooseSearchResult(result: SearchResult) {
    setQuery(result.title);
    setSearchResults([]);
    setAddress((current) => ({
      ...current,
      area: result.title,
      pinCode: result.pinCode || current.pinCode,
      latitude: result.latitude,
      longitude: result.longitude,
    }));

    const next = buildSavedAddress({
      area: result.title,
      details: result.subtitle,
      pinCode: result.pinCode,
      latitude: result.latitude,
      longitude: result.longitude,
      distance: "Saved",
    });
    saveDeliveryLocation({ label: next.label || next.tag, address: result.title, pinCode: result.pinCode, latitude: result.latitude, longitude: result.longitude });
    upsertSavedAddress(next);
    void syncAddressToCustomer(next, true);
  }

  function saveAddress() {
    const area = address.area.trim() || query.trim();
    if (!area) {
      setMessage("Please search or use current location first.");
      return;
    }

    if (!address.details.trim()) {
      setMessage("Please enter address details.");
      return;
    }

    const pinCode = address.pinCode.trim() || extractPinCode(`${address.details}, ${area}`);
    const deliveryCoverage = getDeliveryLocationCoverage({
      label: getAddressLabel(address.tag, address.customLabel),
      address: `${address.details}, ${area}`,
      pinCode,
      latitude: address.latitude,
      longitude: address.longitude,
    }, restaurantSettings);

    if (!deliveryCoverage.serviceable) {
      setMessage(deliveryCoverage.message);
      return;
    }

    const label = getAddressLabel(address.tag, address.customLabel);
    const next = buildSavedAddress({
      tag: address.tag,
      label,
      id: editingAddressId || undefined,
      area,
      details: address.details,
      pinCode,
      receiver: address.receiver,
      phone: address.phone,
      latitude: address.latitude,
      longitude: address.longitude,
      distance: address.latitude ? "0 m" : "Saved",
    });

    upsertSavedAddress(next);
    saveDeliveryLocation({
      label,
      address: `${next.details}, ${next.area}`,
      pinCode,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    void syncAddressToCustomer(next, true);
    setEditingAddressId(null);
    setMode("select");
  }

  function chooseAddress(item: SavedAddress) {
    const label = item.label || item.tag;
    saveDeliveryLocation({ label, address: `${item.details}, ${item.area}`, pinCode: item.pinCode, latitude: item.latitude, longitude: item.longitude });
    setAddress((current) => ({
      ...current,
      area: item.area,
      details: item.details === item.area ? "" : item.details,
      pinCode: item.pinCode,
      receiver: item.receiver,
      phone: item.phone,
      tag: item.tag,
      customLabel: item.tag === "Other" ? label : current.customLabel,
      latitude: item.latitude || "",
      longitude: item.longitude || "",
    }));
    setMessage(`${label} selected.`);
  }

  function editAddress(item: SavedAddress) {
    const label = item.label || item.tag;
    setEditingAddressId(item.id);
    setActiveAddressActionsId(null);
    setQuery(item.area);
    setAddress((current) => ({
      ...current,
      area: item.area,
      details: item.details === item.area ? "" : item.details,
      pinCode: item.pinCode,
      receiver: item.receiver,
      phone: cleanPhone(item.phone),
      tag: item.tag,
      customLabel: item.tag === "Other" ? label : "",
      latitude: item.latitude || "",
      longitude: item.longitude || "",
    }));
    setMarkerPosition({ x: 50, y: 43 });
    setMode("add");
  }

  function deleteAddress(item: SavedAddress) {
    setSavedAddresses((current) => current.filter((saved) => saved.id !== item.id));
    setActiveAddressActionsId(null);
    if (editingAddressId === item.id) setEditingAddressId(null);
    setMessage(`${item.label || item.tag} location deleted.`);
  }

  function goBack() {
    if (mode === "add") {
      setEditingAddressId(null);
      setMode("select");
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/menu");
  }

  return (
    <section className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f5f6fb] text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.08)] sm:my-5 sm:overflow-hidden sm:rounded-[28px] lg:max-w-[1120px]">
      {mode === "select" ? (
        <div className="px-5 pb-28 pt-7 lg:grid lg:min-h-[560px] lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-7 lg:px-7 lg:py-7">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <button type="button" onClick={goBack} className="grid h-9 w-9 place-items-center rounded-full text-charcoal" aria-label="Back">
                <ArrowLeft size={27} strokeWidth={3} />
              </button>
              <h1 className="text-[21px] font-black leading-none text-charcoal lg:text-[19px]">Select a location</h1>
            </div>

            <SearchBox
              query={query}
              setQuery={setQuery}
              onTyped={(value) => setAddress((current) => ({ ...current, pinCode: extractPinCode(value) || current.pinCode }))}
            />
            <SearchResults searching={searching} results={searchResults} onChoose={chooseSearchResult} />

            <div className="mt-8 overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-black/5 lg:mt-6 lg:rounded-[18px]">
              <button
                type="button"
                onClick={() => void detectLocation(false)}
                className="grid min-h-24 w-full grid-cols-[46px_1fr_auto] items-center gap-3 px-5 py-5 text-left lg:min-h-[74px] lg:grid-cols-[36px_1fr_auto] lg:px-4 lg:py-4"
              >
                <LocateFixed className={`h-[30px] w-[30px] text-maroon lg:h-6 lg:w-6 ${locating ? "animate-spin" : ""}`} strokeWidth={2.7} />
                <span className="min-w-0">
                  <span className="block text-[16px] font-black text-maroon lg:text-[14px]">{locating ? "Detecting location" : "Use current location"}</span>
                  <span className="mt-1 block truncate text-[14px] font-black text-muted lg:text-[12px]">
                    {currentArea || "Detect with GPS"}
                  </span>
                </span>
                <ChevronRight className="h-[25px] w-[25px] text-muted lg:h-5 lg:w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingAddressId(null);
                  setMode("add");
                }}
                className="grid h-[86px] w-full grid-cols-[46px_1fr_auto] items-center gap-3 border-t border-border px-5 text-left lg:h-[68px] lg:grid-cols-[36px_1fr_auto] lg:px-4"
              >
                <Plus className="h-[30px] w-[30px] text-maroon lg:h-6 lg:w-6" strokeWidth={3} />
                <span className="text-[16px] font-black text-maroon lg:text-[14px]">Add Address</span>
                <ChevronRight className="h-[25px] w-[25px] text-muted lg:h-5 lg:w-5" />
              </button>
            </div>
          </div>

          <aside className="mt-8 min-w-0 lg:mt-0">
            <h2 className="text-[15px] font-black uppercase tracking-[0.18em] text-muted lg:text-[13px] lg:tracking-[0.16em]">Recent Locations</h2>
            <div className="mt-5 grid gap-4 lg:mt-4 lg:grid-cols-2 lg:gap-3">
              {recentAddresses.length ? (
                recentAddresses.map((item) => (
                  <SavedAddressCard
                    key={item.id}
                    item={item}
                    actionsOpen={activeAddressActionsId === item.id}
                    onChoose={() => chooseAddress(item)}
                    onToggleActions={() => setActiveAddressActionsId((current) => current === item.id ? null : item.id)}
                    onEdit={() => editAddress(item)}
                    onDelete={() => deleteAddress(item)}
                  />
                ))
              ) : (
                <div className="rounded-[22px] bg-white p-6 text-center shadow-sm ring-1 ring-black/5 lg:col-span-2 lg:p-5">
                  <Clock3 className="mx-auto text-muted" size={32} />
                  <p className="mt-3 text-[14px] font-black text-charcoal lg:text-[13px]">No recent locations</p>
                  <p className="mt-1 text-[13px] font-bold leading-5 text-muted lg:text-[12px]">Use current location to save it automatically here.</p>
                </div>
              )}
            </div>
            <div className="mt-5 hidden rounded-[18px] bg-white p-5 shadow-sm ring-1 ring-black/5 lg:block">
              <p className="text-[14px] font-black text-maroon">Fast delivery starts with the right location</p>
              <p className="mt-2 text-[12px] font-bold leading-5 text-muted">Search, detect GPS, or add complete delivery details. Logged-in customer details sync automatically.</p>
            </div>
            <p className="mt-7 text-center text-[15px] font-bold text-muted lg:text-[13px]">
              powered by <span className="font-black text-maroon">Wah Thali Maps</span>
            </p>
          </aside>
        </div>
      ) : (
        <div className="min-h-screen bg-white lg:grid lg:h-[calc(100vh-40px)] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[82px_minmax(0,1fr)] lg:overflow-hidden">
          <div className="relative z-20 flex items-center gap-3 bg-white px-5 pb-5 pt-7 shadow-[0_5px_18px_rgba(34,31,32,0.08)] lg:col-span-2 lg:px-6 lg:py-4">
            <button type="button" onClick={goBack} className="grid h-10 w-10 shrink-0 place-items-center text-charcoal lg:h-9 lg:w-9" aria-label="Back">
              <ArrowLeft size={27} className="lg:h-6 lg:w-6" strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <SearchBox
                query={query}
                compact
                setQuery={setQuery}
                onTyped={(value) => setAddress((current) => ({ ...current, pinCode: extractPinCode(value) || current.pinCode }))}
              />
            </div>
          </div>
          <SearchResults searching={searching} results={searchResults} onChoose={chooseSearchResult} overlay />

          <MapPreview
            area={currentArea || "Move pin to your exact location"}
            latitude={address.latitude}
            longitude={address.longitude}
            locating={locating}
            onLocate={() => void detectLocation(true)}
            pinPosition={markerPosition}
            onPinMove={setMarkerPosition}
            onPinDrop={(position) => void updateLocationFromMovedPin(position)}
          />

          <div className="relative -mt-9 rounded-t-[28px] bg-white px-5 pb-28 pt-7 shadow-[0_-8px_24px_rgba(34,31,32,0.08)] lg:mt-0 lg:min-h-0 lg:overflow-y-auto lg:rounded-none lg:px-5 lg:pb-5 lg:pt-5 lg:shadow-none">
            <p className="text-[13px] font-black text-muted lg:text-xs">Delivery details</p>
            <button
              type="button"
              onClick={() => void detectLocation(true)}
              className="mt-4 grid h-[78px] w-full grid-cols-[50px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-white px-4 text-left lg:mt-3 lg:h-16 lg:grid-cols-[42px_1fr_auto] lg:rounded-xl lg:px-3"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-maroon text-white lg:h-9 lg:w-9">
                <MapPin size={25} className="lg:h-5 lg:w-5" fill="currentColor" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-black text-charcoal lg:text-sm">{currentArea || "Use current location"}</span>
                {address.latitude ? <span className="mt-0.5 block truncate text-[12px] font-bold text-muted lg:text-[11px]">{address.latitude}, {address.longitude}</span> : null}
              </span>
              <ChevronRight size={25} className="text-muted lg:h-5 lg:w-5" />
            </button>

            <label className="mt-8 block lg:mt-5">
              <textarea
                value={address.details}
                onChange={(event) => setAddress({ ...address, details: event.target.value })}
                className="min-h-24 w-full resize-none rounded-2xl border border-border bg-white px-5 py-6 text-[14px] font-bold text-charcoal outline-none placeholder:text-muted/70 focus:border-maroon lg:min-h-20 lg:rounded-xl lg:px-4 lg:py-4 lg:text-[13px]"
                placeholder="Address details*"
              />
              <span className="mt-2 block text-[12px] font-black text-muted lg:text-[11px]">E.g. Floor, House no.</span>
            </label>

            <label className="mt-5 block lg:mt-4">
              <input
                value={address.pinCode}
                onChange={(event) => setAddress({ ...address, pinCode: event.target.value.replace(/\D/g, "").slice(0, 6) })}
                inputMode="numeric"
                className="h-14 w-full rounded-2xl border border-border bg-white px-5 text-[14px] font-black text-charcoal outline-none placeholder:text-muted/70 focus:border-maroon lg:h-12 lg:rounded-xl lg:px-4 lg:text-[13px]"
                placeholder="PIN code*"
              />
            </label>

            <p className="mt-6 text-[13px] font-black text-muted lg:mt-5 lg:text-xs">Receiver details for this address <span className="font-bold">(optional)</span></p>
            <div className="mt-3 grid gap-3 lg:gap-2">
              <label className="grid h-14 grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border border-border bg-white px-4 lg:h-12 lg:rounded-xl">
                <Phone size={21} className="text-charcoal lg:h-5 lg:w-5" />
                <input
                  value={address.receiver}
                  onChange={(event) => setAddress({ ...address, receiver: event.target.value })}
                  className="min-w-0 bg-transparent text-[13px] font-black text-charcoal outline-none placeholder:text-muted/70 lg:text-xs"
                  placeholder="Receiver name"
                />
              </label>
              <label className="grid h-14 grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border border-border bg-white px-4 lg:h-12 lg:rounded-xl">
                <Phone size={21} className="text-charcoal lg:h-5 lg:w-5" />
                <input
                  value={address.phone}
                  onChange={(event) => setAddress({ ...address, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
                  inputMode="tel"
                  className="min-w-0 bg-transparent text-[13px] font-black text-charcoal outline-none placeholder:text-muted/70 lg:text-xs"
                  placeholder="Receiver mobile number"
                />
              </label>
            </div>
            {customerSession ? (
              <p className="mt-2 text-[12px] font-bold text-muted">Using logged-in customer: {customerSession.name}</p>
            ) : null}

            <p className="mt-7 text-[13px] font-black text-muted lg:mt-5 lg:text-xs">Save address as</p>
            <div className="mt-4 grid grid-cols-3 gap-3 lg:mt-3 lg:gap-2">
              {(["Home", "Work", "Other"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setAddress({ ...address, tag, customLabel: tag === "Other" ? address.customLabel : "" })}
                  className={`inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 text-[13px] font-black lg:h-10 lg:text-xs ${
                    address.tag === tag ? "border-maroon bg-[#fff4f5] text-maroon" : "border-border bg-white text-charcoal"
                  }`}
                >
                  {tag === "Home" ? <Home size={17} /> : tag === "Work" ? <BriefcaseBusiness size={17} /> : <MapPin size={17} />}
                  {tag}
                </button>
              ))}
            </div>

            {address.tag === "Other" ? (
              <input
                value={address.customLabel}
                onChange={(event) => setAddress({ ...address, customLabel: event.target.value })}
                className="mt-4 h-12 w-full rounded-xl border border-border bg-white px-4 text-[13px] font-bold text-charcoal outline-none placeholder:text-muted focus:border-maroon lg:h-10 lg:text-xs"
                placeholder="Name this address"
              />
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-border bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 lg:static lg:mt-5 lg:max-w-none lg:border-t-0 lg:px-0 lg:pb-0 lg:pt-0">
              <button type="button" onClick={saveAddress} className="h-16 w-full rounded-xl bg-maroon text-[18px] font-black text-white shadow-[0_14px_28px_rgba(141,0,33,0.2)] lg:h-12 lg:text-base">
                {editingAddressId ? "Update address" : "Save address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {message ? (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-[430px] px-5">
          <p className="rounded-2xl bg-charcoal px-4 py-3 text-center text-xs font-black leading-5 text-white shadow-xl">{message}</p>
        </div>
      ) : null}
    </section>
  );
}

function SearchBox({
  query,
  setQuery,
  onTyped,
  compact = false,
}: {
  query: string;
  setQuery: (value: string) => void;
  onTyped: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={`${compact ? "mt-0 h-[58px] lg:h-12" : "mt-7 h-20 lg:mt-6 lg:h-16"} flex items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/10 lg:rounded-[18px]`}>
      <Search className={`${compact ? "h-[27px] w-[27px] lg:h-6 lg:w-6" : "h-[33px] w-[33px] lg:h-7 lg:w-7"} shrink-0 text-maroon`} strokeWidth={3.2} />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onTyped(event.target.value);
        }}
        className="min-w-0 flex-1 bg-transparent text-[14px] font-black text-charcoal outline-none placeholder:text-muted/80 lg:text-[13px]"
        placeholder="Search for area, street name..."
      />
    </label>
  );
}

function SearchResults({
  results,
  searching,
  onChoose,
  overlay = false,
}: {
  results: SearchResult[];
  searching: boolean;
  onChoose: (result: SearchResult) => void;
  overlay?: boolean;
}) {
  if (!searching && !results.length) return null;

  return (
    <div className={`${overlay ? "absolute left-5 right-5 top-[92px] z-30" : "mt-3"} overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10`}>
      {searching ? <p className="px-4 py-3 text-sm font-black text-muted">Searching locations...</p> : null}
      {results.map((result) => (
        <button
          key={result.id}
          type="button"
          onClick={() => onChoose(result)}
          className="grid w-full grid-cols-[34px_1fr] gap-3 border-t border-border px-4 py-3 text-left first:border-t-0"
        >
          <MapPin size={22} className="mt-0.5 text-maroon" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-black text-charcoal">{result.title}</span>
            <span className="mt-0.5 block line-clamp-2 text-[11px] font-bold leading-4 text-muted">{result.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function SavedAddressCard({
  item,
  actionsOpen,
  onChoose,
  onToggleActions,
  onEdit,
  onDelete,
}: {
  item: SavedAddress;
  actionsOpen: boolean;
  onChoose: () => void;
  onToggleActions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = item.tag === "Home" ? Home : item.tag === "Work" ? BriefcaseBusiness : MapPin;

  return (
    <div className="relative rounded-[22px] bg-white shadow-sm ring-1 ring-black/5 lg:rounded-[18px]">
      <button type="button" onClick={onChoose} className="grid w-full grid-cols-[48px_1fr_32px] gap-4 p-5 pr-3 text-left lg:grid-cols-[38px_1fr_30px] lg:gap-3 lg:p-4 lg:pr-3">
        <span className="grid justify-items-center">
          <Icon className="h-[31px] w-[31px] text-muted lg:h-7 lg:w-7" />
          <span className="mt-1 text-[11px] font-black text-muted lg:text-[10px]">{item.distance}</span>
        </span>
        <span className="min-w-0">
          <span className="line-clamp-3 text-[16px] font-black leading-snug text-charcoal lg:text-[13px]">{item.area}</span>
          <span className="mt-1 line-clamp-2 text-[14px] font-bold leading-snug text-muted lg:text-[12px]">{item.details === item.area ? "India" : item.details}</span>
          {item.receiver || item.phone ? (
            <span className="mt-2 block truncate text-[11px] font-black text-muted lg:text-[10px]">
              {[item.receiver, item.phone].filter(Boolean).join(", ")}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggleActions}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#fff4f5] text-maroon ring-1 ring-maroon/10"
        aria-label={`Actions for ${item.label || item.tag} address`}
        aria-expanded={actionsOpen}
      >
        <MoreHorizontal size={18} strokeWidth={2.8} />
      </button>

      {actionsOpen ? (
        <div className="absolute right-3 top-12 z-20 w-36 overflow-hidden rounded-2xl bg-white text-sm font-black shadow-xl ring-1 ring-black/10">
          <button type="button" onClick={onEdit} className="flex h-11 w-full items-center gap-2 px-4 text-left text-charcoal hover:bg-[#fff4f5]">
            <Pencil size={15} className="text-maroon" /> Edit
          </button>
          <button type="button" onClick={onDelete} className="flex h-11 w-full items-center gap-2 border-t border-border px-4 text-left text-red hover:bg-[#fff4f5]">
            <Trash2 size={15} /> Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MapPreview({
  area,
  latitude,
  longitude,
  locating,
  onLocate,
  pinPosition,
  onPinMove,
  onPinDrop,
}: {
  area: string;
  latitude: string;
  longitude: string;
  locating: boolean;
  onLocate: () => void;
  pinPosition: PinPosition;
  onPinMove: (position: PinPosition) => void;
  onPinDrop: (position: PinPosition) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef(pinPosition);

  function getPositionFromPointer(clientX: number, clientY: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return pinPosition;

    return {
      x: Math.min(88, Math.max(12, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(72, Math.max(20, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    draggingRef.current = true;
    dragStartRef.current = pinPosition;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPinMove(getPositionFromPointer(event.clientX, event.clientY));
  }

  function movePin(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    onPinMove(getPositionFromPointer(event.clientX, event.clientY));
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const nextPosition = getPositionFromPointer(event.clientX, event.clientY);
    const dragDistance = Math.hypot(nextPosition.x - dragStartRef.current.x, nextPosition.y - dragStartRef.current.y);
    onPinMove(nextPosition);
    if (dragDistance > 1.5) onPinDrop(nextPosition);
  }

  return (
    <div ref={mapRef} className="relative h-[330px] overflow-hidden bg-[#eef1f6] touch-none lg:h-full lg:min-h-0">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(28deg, transparent 0 41%, rgba(255,255,255,0.95) 41% 47%, transparent 47%), linear-gradient(115deg, transparent 0 48%, rgba(255,255,255,0.95) 48% 54%, transparent 54%), linear-gradient(90deg,#d9dee8 1px,transparent 1px), linear-gradient(#d9dee8 1px,transparent 1px)",
          backgroundSize: "260px 180px, 260px 180px, 82px 82px, 82px 82px",
        }}
      />
      <div className="absolute left-[8%] top-[10%] h-16 w-28 rounded-sm bg-[#dde2ec]" />
      <div className="absolute right-[10%] top-[13%] h-20 w-32 rounded-sm bg-[#dde2ec]" />
      <div className="absolute left-[3%] top-[47%] h-24 w-36 rounded-sm bg-[#dde2ec]" />
      <div className="absolute right-[7%] top-[50%] h-20 w-28 rounded-sm bg-[#dde2ec]" />
      <span className="absolute left-1/2 top-[38%] grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-[#2ca8ff]/20 text-[#2ca8ff]">
        <span className="h-7 w-7 rounded-full border-4 border-white bg-[#2ca8ff] shadow-md" />
      </span>
      <button
        type="button"
        className="absolute z-10 grid h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-maroon text-white shadow-2xl active:scale-95"
        style={{ left: `${pinPosition.x}%`, top: `${pinPosition.y}%` }}
        onPointerDown={startDrag}
        onPointerMove={movePin}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        aria-label="Move delivery pin"
      >
        <MapPin size={42} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onLocate}
        className="absolute bottom-14 left-1/2 z-20 inline-flex h-12 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-5 text-[13px] font-black text-maroon shadow-xl lg:bottom-12 lg:h-10 lg:rounded-xl lg:text-xs"
      >
        <LocateFixed size={19} className={locating ? "animate-spin" : ""} /> Use current location
      </button>
      <div className="absolute bottom-3 left-4 right-4 rounded-2xl bg-white/90 px-4 py-2 text-center text-[11px] font-bold leading-4 text-muted shadow-sm lg:rounded-xl">
        {latitude && longitude ? `${area} (${latitude}, ${longitude})` : area}
      </div>
    </div>
  );
}
