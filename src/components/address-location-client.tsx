"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  ChevronRight,
  Home,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Share2,
} from "lucide-react";
import { saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import type { RestaurantSettings } from "@/lib/types";

type AddressTag = "Home" | "Work" | "Other";

type SavedAddress = {
  id: string;
  tag: AddressTag;
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

export function AddressLocationClient({ restaurantSettings }: { restaurantSettings: RestaurantSettings }) {
  const deliveryLocation = useDeliveryLocation();
  const [mode, setMode] = useState<"select" | "add">("select");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => readSavedAddresses());
  const [address, setAddress] = useState({
    area: deliveryLocation.address === "Select delivery location" ? "" : deliveryLocation.address,
    details: "",
    receiver: "Sanjay",
    phone: "9342597116",
    tag: "Home" as AddressTag,
    latitude: deliveryLocation.latitude ?? "",
    longitude: deliveryLocation.longitude ?? "",
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(savedAddresses));
  }, [savedAddresses]);

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
        setMessage("Current location selected.");
        setLocating(false);
      },
      (error) => {
        setMessage(error.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
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

    const next: SavedAddress = {
      id: `address-${Date.now()}`,
      tag: address.tag,
      area: address.area || query,
      details: address.details,
      receiver: address.receiver || "Customer",
      phone: address.phone || restaurantSettings.supportPhone,
      distance: address.latitude ? "0 m" : "Saved",
    };

    setSavedAddresses((current) => [next, ...current]);
    saveDeliveryLocation({
      label: next.tag,
      address: `${next.details}, ${next.area}`,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    setMessage("Address saved.");
    setMode("select");
  }

  function chooseAddress(item: SavedAddress) {
    saveDeliveryLocation({ label: item.tag, address: `${item.details}, ${item.area}` });
    setAddress((current) => ({ ...current, ...item }));
    setMessage(`${item.tag} selected.`);
  }

  return (
    <section className="mx-auto min-h-screen max-w-[430px] bg-[#f4f5fb] px-5 pb-28 pt-9 text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.12)] sm:my-6 sm:rounded-[28px]">
      {mode === "select" ? (
        <>
          <div className="flex items-center gap-4">
            <Link href="/menu" className="grid h-9 w-9 place-items-center text-charcoal" aria-label="Back">
              <ChevronDown size={31} strokeWidth={3} />
            </Link>
            <h1 className="text-[26px] font-black leading-none text-charcoal">Select a location</h1>
          </div>

          <label className="mt-8 flex h-16 items-center gap-4 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-border">
            <Search size={31} className="shrink-0 text-red" strokeWidth={3} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setAddress((current) => ({ ...current, area: event.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-[18px] font-black text-charcoal placeholder:text-charcoal/75"
              placeholder="Search for area, street name..."
            />
          </label>

          <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <button onClick={detectLocation} className="grid min-h-24 w-full grid-cols-[46px_1fr_auto] items-center gap-3 px-5 py-4 text-left">
              <LocateFixed size={31} className={`text-red ${locating ? "animate-spin" : ""}`} strokeWidth={2.6} />
              <span className="min-w-0">
                <span className="block text-[20px] font-black text-red">Use current location</span>
                <span className="mt-1 block truncate text-[17px] font-black text-muted">
                  {deliveryLocation.address === "Select delivery location" ? "Detect with GPS" : deliveryLocation.address}
                </span>
              </span>
              <ChevronRight size={27} className="text-muted" />
            </button>
            <button onClick={() => setMode("add")} className="grid h-20 w-full grid-cols-[46px_1fr_auto] items-center gap-3 border-t border-border px-5 text-left">
              <Plus size={31} className="text-red" strokeWidth={3} />
              <span className="text-[20px] font-black text-red">Add Address</span>
              <ChevronRight size={27} className="text-muted" />
            </button>
          </div>

          <h2 className="mt-8 text-[17px] font-black uppercase tracking-[0.22em] text-muted">Saved Addresses</h2>
          <div className="mt-5 grid gap-5">
            {savedAddresses.length ? savedAddresses.map((item) => (
              <article key={item.id} className="rounded-[24px] bg-white p-5 shadow-sm">
                <button onClick={() => chooseAddress(item)} className="grid w-full grid-cols-[56px_1fr] gap-4 text-left">
                  <div className="grid justify-items-center">
                    {item.tag === "Home" ? <Home size={35} className="text-muted" /> : item.tag === "Work" ? <BriefcaseBusiness size={35} className="text-muted" /> : <MapPin size={35} className="text-muted" />}
                    <span className="mt-1 text-xs font-black text-muted">{item.distance}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[17px] font-black text-charcoal">{item.tag}</p>
                    <p className="mt-1 text-[16px] font-black leading-6 text-muted">{item.details}, {item.area}</p>
                    <p className="mt-1 text-[14px] font-black text-muted">Phone number: +91-{item.phone}</p>
                  </div>
                </button>
                <div className="ml-[72px] mt-4 flex gap-4">
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
                <MapPin className="mx-auto text-red" size={32} />
                <p className="mt-3 text-[17px] font-black text-charcoal">No saved addresses yet</p>
                <p className="mt-1 text-sm font-bold text-muted">Use current location or add your delivery address.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <button onClick={() => setMode("select")} className="grid h-9 w-9 place-items-center text-charcoal" aria-label="Back to locations">
              <ChevronDown size={31} strokeWidth={3} />
            </button>
            <h1 className="text-[26px] font-black leading-none text-charcoal">Select delivery location</h1>
          </div>

          <label className="mt-8 flex h-16 items-center gap-4 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-border">
            <Search size={31} className="shrink-0 text-red" strokeWidth={3} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setAddress((current) => ({ ...current, area: event.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-[18px] font-black text-charcoal placeholder:text-muted"
              placeholder="Search for area, street name..."
            />
          </label>

          <div className="mt-8 rounded-t-[28px] bg-white px-5 pb-5 pt-4 shadow-[0_-2px_18px_rgba(34,31,32,0.08)]">
            <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-border" />
            <p className="text-[15px] font-black text-muted">Delivery details</p>
            <button onClick={detectLocation} className="mt-4 grid h-20 w-full grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-white px-4 text-left">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-red text-white">
                <MapPin size={25} className="fill-white" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[18px] font-black text-charcoal">{address.area || "Use current location"}</span>
                {address.latitude ? <span className="mt-1 block text-xs font-bold text-muted">{address.latitude}, {address.longitude}</span> : null}
              </span>
              <ChevronRight size={26} className="text-muted" />
            </button>

            <label className="mt-6 block">
              <textarea
                value={address.details}
                onChange={(event) => setAddress({ ...address, details: event.target.value })}
                className="min-h-24 w-full resize-none rounded-2xl border border-border bg-white px-4 py-6 text-[16px] font-bold text-charcoal placeholder:text-muted/70"
                placeholder="Address details*"
              />
              <span className="mt-2 block text-[12px] font-black text-muted">E.g. Floor, House no.</span>
            </label>

            <p className="mt-7 text-[15px] font-black text-muted">Receiver details for this address</p>
            <label className="mt-4 grid h-20 w-full grid-cols-[42px_1fr] items-center gap-3 rounded-2xl border border-border bg-white px-4">
              <Phone size={25} className="text-charcoal" />
              <input
                value={`${address.receiver}, ${address.phone}`}
                onChange={(event) => {
                  const [receiver, phone] = event.target.value.split(",");
                  setAddress({ ...address, receiver: receiver?.trim() ?? "", phone: phone?.trim() ?? "" });
                }}
                className="min-w-0 bg-transparent text-[17px] font-black text-muted"
              />
            </label>

            <p className="mt-7 text-[15px] font-black text-muted">Save address as</p>
            <div className="mt-3 flex gap-2">
              {(["Home", "Work", "Other"] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setAddress({ ...address, tag })}
                  className={`inline-flex h-12 items-center gap-2 rounded-xl border px-3 text-[15px] font-black ${
                    address.tag === tag ? "border-red bg-red/5 text-red" : "border-border bg-white text-charcoal"
                  }`}
                >
                  {tag === "Home" ? <Home size={18} /> : tag === "Work" ? <BriefcaseBusiness size={18} /> : <MapPin size={18} />}
                  {tag}
                </button>
              ))}
            </div>

            <button onClick={saveAddress} className="mt-5 h-16 w-full rounded-xl bg-red text-[22px] font-black text-white shadow-[0_10px_24px_rgba(214,0,50,0.22)]">
              Save address
            </button>
          </div>
        </>
      )}

      {message ? <p className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}
    </section>
  );
}
