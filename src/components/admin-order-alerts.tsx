"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Volume2 } from "lucide-react";
import { getNewOrderSound, getNewOrderSoundSteps } from "@/lib/order-sounds";
import type { NewOrderSound, OrderStatus } from "@/lib/types";

type ApiOrder = {
  orderNumber: string;
  customer: { name: string; mobile: string };
  status: OrderStatus;
  grandTotal: number;
  items: { quantity: number; name: string }[];
};

const incomingStatuses: OrderStatus[] = ["NEW", "PENDING_PAYMENT"];
const settingsUpdateEvent = "wah-thali-admin-alert-settings-updated";

export function AdminOrderAlerts({ enabled, sound }: { enabled: boolean; sound: NewOrderSound }) {
  const [alertEnabled, setAlertEnabled] = useState(enabled);
  const [alertSound, setAlertSound] = useState<NewOrderSound>(getNewOrderSound(sound));
  const [incomingCount, setIncomingCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const knownOrders = useRef<Set<string>>(new Set());
  const audioContext = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (audioContext.current) return audioContext.current;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext.current = new AudioContextClass();
    return audioContext.current;
  }, []);

  const playAlarmSound = useCallback(async () => {
    if (!alertEnabled) return;

    const audio = getAudioContext();
    if (!audio) return;

    if (audio.state === "suspended") {
      await audio.resume().catch(() => undefined);
    }

    if (audio.state === "suspended") {
      setAudioBlocked(true);
      setAudioReady(false);
      return;
    }

    setAudioBlocked(false);
    setAudioReady(true);
    const now = audio.currentTime;

    getNewOrderSoundSteps(alertSound).forEach((step) => {
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
  }, [alertEnabled, alertSound, getAudioContext]);

  const unlockAudio = useCallback(async () => {
    const audio = getAudioContext();
    if (!audio) return;
    await audio.resume().catch(() => undefined);
    const blocked = audio.state === "suspended";
    setAudioBlocked(blocked);
    setAudioReady(!blocked);
    if (incomingCount > 0) {
      await playAlarmSound();
    }
  }, [getAudioContext, incomingCount, playAlarmSound]);

  const refreshOrders = useCallback(async () => {
    if (!alertEnabled) {
      setIncomingCount(0);
      return;
    }

    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.orders)) return;

    const orders = data.orders as ApiOrder[];
    const incoming = orders.filter((order) => incomingStatuses.includes(order.status));
    const newIncoming = incoming.find((order) => !knownOrders.current.has(order.orderNumber));
    knownOrders.current = new Set(orders.map((order) => order.orderNumber));
    setIncomingCount(incoming.length);

    if (newIncoming) {
      document.title = `New order ${newIncoming.orderNumber} - Wah Thali Admin`;
      await playAlarmSound();
    }
  }, [alertEnabled, playAlarmSound]);

  const refreshAlertSettings = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const settings = data.settings as { newOrderSoundEnabled?: unknown; newOrderSound?: unknown } | undefined;
    if (!response.ok || !settings) return;

    setAlertEnabled(settings.newOrderSoundEnabled === true);
    setAlertSound(getNewOrderSound(settings.newOrderSound));
  }, []);

  useEffect(() => {
    function handleSettingsUpdate(event: Event) {
      const detail = (event as CustomEvent<{ enabled?: unknown; sound?: unknown }>).detail;
      if (!detail) return;
      setAlertEnabled(detail.enabled === true);
      setAlertSound(getNewOrderSound(detail.sound));
    }

    window.addEventListener(settingsUpdateEvent, handleSettingsUpdate);
    return () => window.removeEventListener(settingsUpdateEvent, handleSettingsUpdate);
  }, []);

  useEffect(() => {
    function unlock() {
      void unlockAudio();
    }

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [unlockAudio]);

  useEffect(() => {
    const firstRun = window.setTimeout(() => {
      void refreshOrders();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshOrders();
    }, 10000);
    return () => {
      window.clearTimeout(firstRun);
      window.clearInterval(timer);
    };
  }, [refreshOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshAlertSettings();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshAlertSettings]);

  useEffect(() => {
    if (!alertEnabled || incomingCount === 0) return;

    const firstRing = window.setTimeout(() => {
      void playAlarmSound();
    }, 0);
    const timer = window.setInterval(() => {
      void playAlarmSound();
    }, 3200);
    return () => {
      window.clearTimeout(firstRing);
      window.clearInterval(timer);
    };
  }, [alertEnabled, incomingCount, playAlarmSound]);

  useEffect(() => {
    return () => {
      void audioContext.current?.close();
    };
  }, []);

  if (!alertEnabled || audioReady) return null;

  return (
    <button
      type="button"
      onClick={unlockAudio}
      className="fixed bottom-5 left-5 z-[70] inline-flex min-h-12 items-center gap-2 rounded-xl bg-maroon px-4 py-3 text-sm font-black text-white shadow-2xl"
    >
      <BellRing size={18} />
      {audioBlocked || incomingCount > 0 ? "Enable order sound" : "Prepare order sound"}
      <Volume2 size={18} />
    </button>
  );
}
