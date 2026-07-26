"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  ChevronRight,
  Home,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Save,
  Share2,
} from "lucide-react";
import { saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { readCustomerSession } from "@/lib/customer-session";
import type { RestaurantSettings } from "@/lib/types";

type AddressTag = "Home" | "Work" | "Other";

type SavedAddress = {
  id: string;
  tag: AddressTag;
  label?: string;
  area: string;
  details: string;
  receiver: string;
  phone: string;
  distance: string;
};

const storageKey = "wah-thali-addresses";

function readSavedAddresses() {
  if (typeof window === "undefined") return [] as SavedAddress[];

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) as SavedAddress[] : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item.id.startsWith("address-")) : [];
  } catch {
    return [];
  }
}

function getAddressLabel(tag: AddressTag, customLabel?: string) {
  if (tag !== "Other") return tag;
  return customLabel?.trim() || "Other";
}

export function AddressLocationClient({ restaurantSettings }: { restaurantSettings: RestaurantSettings }) {
  const router = useRouter();
  const deliveryLocation = useDeliveryLocation();
  const [mode, setMode] = useState<"select" | "add">("select");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => readSavedAddresses());
  const initialCustomerSession = readCustomerSession();
  const [address, setAddress] = useState({
    area: deliveryLocation.address === "Select delivery location" ? "" : deliveryLocation.address,
    details: "",
    receiver: initialCustomerSession?.name ?? "Sanjay",
    phone: initialCustomerSession?.mobile ?? "9342597116",
    tag: "Home" as AddressTag,
    customLabel: "",
    latitude: deliveryLocation.latitude ?? "",
    longitude: deliveryLocation.longitude ?? "",
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  async function syncAddressToCustomer(item: SavedAddress, isDefault: boolean) {
    const session = readCustomerSession();
    if (!session?.mobile) {
      setMessage("Address saved on this device. Login to sync it to your profile.");
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
          pinCode: "",
          landmark: item.receiver ? `Receiver: ${item.receiver}, ${item.phone}` : undefined,
          isDefault,
        }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Address saved to your profile." : data.error || "Address saved here, but Supabase sync failed.");
    } catch {
      setMessage("Address saved here, but Supabase sync failed. Please try again.");
    }
  }

  async function detectLocation() {
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
        let area = query || "Current location";

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const details = data.address ?? {};
          area = [details.suburb, details.neighbourhood, details.village, details.town, details.city, details.state].filter(Boolean).slice(0, 3).join(", ") || data.display_name || area;
        } catch {
          area = "Current location";
        }

        setAddress((current) => ({ ...current, area, latitude, longitude }));
        saveDeliveryLocation({ label: "Home", address: area, latitude, longitude });
        setMessage("Current location selected. Save it to keep it in your address list.");
        setLocating(false);
      },
      (error) => {
        setMessage(error.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/menu");
  }

  function saveCurrentLocation() {
    const area = address.area.trim() || query.trim() || deliveryLocation.address;
    if (!area || area === "Select delivery location") {
      setMessage("Please use current location or search an area first.");
      return;
    }

    const label = getAddressLabel(address.tag, address.customLabel);
    const next: SavedAddress = {
      id: `address-${Date.now()}`,
      tag: address.tag,
      label,
      area,
      details: address.details.trim() || area,
      receiver: address.receiver || "Customer",
      phone: address.phone || restaurantSettings.supportPhone,
      distance: address.latitude ? "0 m" : "Saved",
    };

    setSavedAddresses((current) => [next, ...current.filter((item) => `${item.details}, ${item.area}` !== `${next.details}, ${next.area}`)]);
    saveDeliveryLocation({
      label,
      address: `${next.details}, ${next.area}`,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    void syncAddressToCustomer(next, true);
  }

  function saveAddress() {
    if (!address.area.trim() && !query.trim()) {
      setMessage("Please search or use current location first.");
      return;
    }

    if (!address.details.trim()) {
      setMessage("Please enter Address details.");
      return;
    }

    const label = getAddressLabel(address.tag, address.customLabel);
    const next: SavedAddress = {
      id: `address-${Date.now()}`,
      tag: address.tag,
      label,
      area: address.area || query,
      details: address.details,
      receiver: address.receiver || "Customer",
      phone: address.phone || restaurantSettings.supportPhone,
      distance: address.latitude ? "0 m" : "Saved",
    };

    setSavedAddresses((current) => [next, ...current]);
    saveDeliveryLocation({
      label,
      address: `${next.details}, ${next.area}`,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    void syncAddressToCustomer(next, true);
    setMode("select");
  }

  function chooseAddress(item: SavedAddress) {
    const label = item.label || item.tag;
    saveDeliveryLocation({ label, address: `${item.details}, ${item.area}` });
    setAddress((current) => ({ ...current, ...item, customLabel: item.tag === "Other" ? label : current.customLabel }));
    setMessage(`${label} selected.`);
  }

  return (
    <section className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-4 pb-28 pt-7 text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.08)] sm:my-6 sm:rounded-[28px] sm:px-5 sm:pt-9 lg:max-w-5xl">
      {mode === "select" ? (
        <>
          <div className="flex items-center gap-3">
            <button type="button" onClick={goBack} className="grid h-9 w-9 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back">
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
            <h1 className="text-[22px] font-black leading-none text-charcoal sm:text-[26px]">Select a location</h1>
          </div>

          <label className="mt-6 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-border sm:mt-8 sm:h-16 sm:gap-4">
            <Search size={25} className="shrink-0 text-red sm:h-[31px] sm:w-[31px]" strokeWidth={3} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setAddress((current) => ({ ...current, area: event.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-black text-charcoal placeholder:text-charcoal/75 sm:text-[18px]"
              placeholder="Search for area, street name..."
            />
          </label>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm sm:mt-8">
            <button onClick={detectLocation} className="grid min-h-20 w-full grid-cols-[38px_1fr_auto] items-center gap-3 px-4 py-4 text-left sm:min-h-24 sm:grid-cols-[46px_1fr_auto] sm:px-5">
              <LocateFixed size={26} className={`text-red sm:h-[31px] sm:w-[31px] ${locating ? "animate-spin" : ""}`} strokeWidth={2.6} />
              <span className="min-w-0">
                <span className="block text-[17px] font-black text-red sm:text-[20px]">Use current location</span>
                <span className="mt-1 block truncate text-[13px] font-black text-muted sm:text-[17px]">
                  {deliveryLocation.address === "Select delivery location" ? "Detect with GPS" : deliveryLocation.address}
                </span>
              </span>
              <ChevronRight size={23} className="text-muted sm:h-[27px] sm:w-[27px]" />
            </button>
            <button onClick={saveCurrentLocation} className="grid h-16 w-full grid-cols-[38px_1fr_auto] items-center gap-3 border-t border-border px-4 text-left sm:grid-cols-[46px_1fr_auto] sm:px-5">
              <Save size={23} className="text-red" strokeWidth={2.7} />
              <span className="text-[16px] font-black text-red sm:text-[18px]">Save current location</span>
              <ChevronRight size={23} className="text-muted" />
            </button>
            <button onClick={() => setMode("add")} className="grid h-16 w-full grid-cols-[38px_1fr_auto] items-center gap-3 border-t border-border px-4 text-left sm:h-20 sm:grid-cols-[46px_1fr_auto] sm:px-5">
              <Plus size={27} className="text-red sm:h-[31px] sm:w-[31px]" strokeWidth={3} />
              <span className="text-[17px] font-black text-red sm:text-[20px]">Add Address</span>
              <ChevronRight size={23} className="text-muted sm:h-[27px] sm:w-[27px]" />
            </button>
          </div>

          <h2 className="mt-7 text-[14px] font-black uppercase tracking-[0.22em] text-muted sm:mt-8 sm:text-[17px]">Saved Addresses</h2>
          <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5">
            {savedAddresses.length ? savedAddresses.map((item) => (
              <article key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
                <button onClick={() => chooseAddress(item)} className="grid w-full grid-cols-[46px_1fr] gap-3 text-left sm:grid-cols-[56px_1fr] sm:gap-4">
                  <div className="grid justify-items-center">
                    {item.tag === "Home" ? <Home size={28} className="text-muted sm:h-[35px] sm:w-[35px]" /> : item.tag === "Work" ? <BriefcaseBusiness size={28} className="text-muted sm:h-[35px] sm:w-[35px]" /> : <MapPin size={28} className="text-muted sm:h-[35px] sm:w-[35px]" />}
                    <span className="mt-1 text-xs font-black text-muted">{item.distance}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-black text-charcoal sm:text-[17px]">{item.label || item.tag}</p>
                    <p className="mt-1 text-[13px] font-black leading-5 text-muted sm:text-[16px] sm:leading-6">{item.details}, {item.area}</p>
                    <p className="mt-1 text-[12px] font-black text-muted sm:text-[14px]">Phone number: +91-{item.phone}</p>
                  </div>
                </button>
                <div className="ml-[58px] mt-3 flex gap-3 sm:ml-[72px] sm:mt-4 sm:gap-4">
                  <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-red shadow-sm ring-1 ring-border" aria-label="More address actions">
                    <MoreHorizontal size={21} />
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-red shadow-sm ring-1 ring-border" aria-label="Share address">
                    <Share2 size={18} />
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-red shadow-sm ring-1 ring-border" aria-label="Add address photo">
                    <Camera size={18} />
                  </button>
                </div>
              </article>
            )) : (
              <div className="rounded-[24px] bg-white p-5 text-center shadow-sm">
                <MapPin className="mx-auto text-red" size={28} />
                <p className="mt-3 text-[15px] font-black text-charcoal sm:text-[17px]">No saved addresses yet</p>
                <p className="mt-1 text-sm font-bold text-muted">Use current location or add your delivery address.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setMode("select")} className="grid h-9 w-9 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back to locations">
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
            <h1 className="text-[19px] font-black leading-tight text-charcoal sm:text-[26px]">Select delivery location</h1>
          </div>

          <label className="mt-6 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-border sm:mt-8 sm:h-16 sm:gap-4">
            <Search size={25} className="shrink-0 text-red sm:h-[31px] sm:w-[31px]" strokeWidth={3} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setAddress((current) => ({ ...current, area: event.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-black text-charcoal placeholder:text-muted sm:text-[18px]"
              placeholder="Search for area, street name..."
            />
          </label>

          <div className="mt-6 rounded-t-[28px] bg-white px-4 pb-5 pt-4 shadow-[0_-2px_18px_rgba(34,31,32,0.08)] sm:mt-8 sm:px-5">
            <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-border" />
            <p className="text-[12px] font-black text-muted sm:text-[15px]">Delivery details</p>
            <button onClick={detectLocation} className="mt-4 grid h-16 w-full grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-white px-3 text-left sm:h-20 sm:grid-cols-[48px_1fr_auto] sm:px-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-red text-white sm:h-11 sm:w-11">
                <MapPin size={21} className="fill-white sm:h-[25px] sm:w-[25px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-black text-charcoal sm:text-[18px]">{address.area || "Use current location"}</span>
                {address.latitude ? <span className="mt-1 block text-xs font-bold text-muted">{address.latitude}, {address.longitude}</span> : null}
              </span>
              <ChevronRight size={26} className="text-muted" />
            </button>

            <label className="mt-6 block">
              <textarea
                value={address.details}
                onChange={(event) => setAddress({ ...address, details: event.target.value })}
                className="min-h-24 w-full resize-none rounded-2xl border border-border bg-white px-4 py-5 text-[14px] font-bold text-charcoal placeholder:text-muted/70 sm:py-6 sm:text-[16px]"
                placeholder="Address details*"
              />
              <span className="mt-2 block text-[12px] font-black text-muted">E.g. Floor, House no.</span>
            </label>

            <p className="mt-5 text-[12px] font-black text-muted sm:mt-7 sm:text-[15px]">Receiver details for this address</p>
            <label className="mt-3 grid h-14 w-full grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border border-border bg-white px-4 sm:mt-4 sm:h-20 sm:grid-cols-[42px_1fr]">
              <Phone size={21} className="text-charcoal sm:h-[25px] sm:w-[25px]" />
              <input
                value={`${address.receiver}, ${address.phone}`}
                onChange={(event) => {
                  const [receiver, phone] = event.target.value.split(",");
                  setAddress({ ...address, receiver: receiver?.trim() ?? "", phone: phone?.trim() ?? "" });
                }}
                className="min-w-0 bg-transparent text-[13px] font-black text-muted sm:text-[17px]"
              />
            </label>

            <p className="mt-5 text-[12px] font-black text-muted sm:mt-7 sm:text-[15px]">Save address as</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["Home", "Work", "Other"] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setAddress({ ...address, tag, customLabel: tag === "Other" ? address.customLabel : "" })}
                  className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[12px] font-black sm:h-12 sm:gap-2 sm:px-3 sm:text-[15px] ${
                    address.tag === tag ? "border-red bg-red/5 text-red ring-1 ring-red/20" : "border-border bg-white text-charcoal"
                  }`}
                >
                  {tag === "Home" ? <Home size={16} /> : tag === "Work" ? <BriefcaseBusiness size={16} /> : <MapPin size={16} />}
                  {tag}
                </button>
              ))}
            </div>
            {address.tag === "Other" ? (
              <label className="mt-3 block">
                <input
                  value={address.customLabel}
                  onChange={(event) => setAddress({ ...address, customLabel: event.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-[13px] font-bold text-charcoal placeholder:text-muted"
                  placeholder="Name this address, e.g. Mom's home"
                />
              </label>
            ) : null}

            <button onClick={saveAddress} className="mt-5 h-14 w-full rounded-xl bg-red text-[18px] font-black text-white shadow-[0_10px_24px_rgba(214,0,50,0.22)] sm:h-16 sm:text-[22px]">
              Save address
            </button>
          </div>
        </>
      )}

      {message ? <p className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}
    </section>
  );
}
