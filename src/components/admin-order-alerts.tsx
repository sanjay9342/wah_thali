"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Volume2 } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch } from "@/lib/admin-client-auth";
import { getNewOrderSound, getNewOrderSoundAudioSrc, getNewOrderSoundDurationMs, getNewOrderSoundSteps } from "@/lib/order-sounds";
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
const ordersUpdatedEvent = "wah-thali-admin-orders-updated";

export function AdminOrderAlerts({ enabled, sound }: { enabled: boolean; sound: NewOrderSound }) {
  const [alertEnabled, setAlertEnabled] = useState(enabled);
  const [alertSound, setAlertSound] = useState<NewOrderSound>(getNewOrderSound(sound));
  const [incomingCount, setIncomingCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const knownOrders = useRef<Set<string>>(new Set());
  const hasLoadedOrders = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const alarmActive = useRef(false);
  const alarmSound = useRef<NewOrderSound | null>(null);
  const alarmAudio = useRef<HTMLAudioElement | null>(null);
  const alarmTimer = useRef<number | null>(null);
  const alarmOscillators = useRef<OscillatorNode[]>([]);
  const adminAccess = useAdminAccess();

  const getAudioContext = useCallback(() => {
    if (audioContext.current) return audioContext.current;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext.current = new AudioContextClass();
    return audioContext.current;
  }, []);

  const stopAlarmSound = useCallback(() => {
    alarmActive.current = false;
    alarmSound.current = null;

    if (alarmTimer.current !== null) {
      window.clearTimeout(alarmTimer.current);
      alarmTimer.current = null;
    }

    if (alarmAudio.current) {
      alarmAudio.current.pause();
      alarmAudio.current.currentTime = 0;
      alarmAudio.current = null;
    }

    alarmOscillators.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may have already stopped naturally.
      }
    });
    alarmOscillators.current = [];
  }, []);

  const playGeneratedAlarmOnce = useCallback(async () => {
    const audio = getAudioContext();
    if (!audio) return false;

    if (audio.state === "suspended") {
      await audio.resume().catch(() => undefined);
    }

    if (audio.state === "suspended") {
      setAudioBlocked(true);
      setAudioReady(false);
      return false;
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
      oscillator.onended = () => {
        alarmOscillators.current = alarmOscillators.current.filter((item) => item !== oscillator);
      };
      alarmOscillators.current.push(oscillator);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });

    return true;
  }, [alertSound, getAudioContext]);

  const startAlarmSound = useCallback(async () => {
    if (!alertEnabled || alarmActive.current) return;

    alarmActive.current = true;
    alarmSound.current = alertSound;

    const audioSrc = getNewOrderSoundAudioSrc(alertSound);
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audio.currentTime = 0;
      alarmAudio.current = audio;
      const played = await audio.play().then(() => true).catch(() => false);

      if (!alarmActive.current || alarmAudio.current !== audio) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      if (!played) {
        alarmActive.current = false;
        alarmSound.current = null;
        alarmAudio.current = null;
      }

      setAudioBlocked(!played);
      setAudioReady(played);
      return;
    }

    const playLoop = async () => {
      if (!alarmActive.current) return;
      const played = await playGeneratedAlarmOnce();
      if (!played) {
        alarmActive.current = false;
        alarmSound.current = null;
        return;
      }
      if (!alarmActive.current) return;
      alarmTimer.current = window.setTimeout(playLoop, getNewOrderSoundDurationMs(alertSound) + 550);
    };

    await playLoop();
  }, [alertEnabled, alertSound, playGeneratedAlarmOnce]);

  const unlockAudio = useCallback(async () => {
    if (incomingCount > 0) {
      await startAlarmSound();
      return;
    }

    const audioSrc = getNewOrderSoundAudioSrc(alertSound);
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.loop = false;
      audio.currentTime = 0;
      const played = await audio.play().then(() => true).catch(() => false);
      if (played) {
        window.setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, getNewOrderSoundDurationMs(alertSound));
      }
      setAudioBlocked(!played);
      setAudioReady(played);
      return;
    }

    const audio = getAudioContext();
    if (!audio) return;
    await audio.resume().catch(() => undefined);
    const blocked = audio.state === "suspended";
    setAudioBlocked(blocked);
    setAudioReady(!blocked);
  }, [alertSound, getAudioContext, incomingCount, startAlarmSound]);

  const refreshOrders = useCallback(async () => {
    if (!alertEnabled) {
      setIncomingCount(0);
      stopAlarmSound();
      return;
    }

    const response = await adminFetch(adminAccess?.session, "/api/orders", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.orders)) return;

    const orders = data.orders as ApiOrder[];
    const incoming = orders.filter((order) => incomingStatuses.includes(order.status));
    const newIncoming = incoming.find((order) => !knownOrders.current.has(order.orderNumber));
    knownOrders.current = new Set(orders.map((order) => order.orderNumber));
    setIncomingCount(incoming.length);

    if (!hasLoadedOrders.current) {
      hasLoadedOrders.current = true;
      return;
    }

    if (newIncoming) {
      document.title = `New order ${newIncoming.orderNumber} - Wah Thali Admin`;
    }
  }, [adminAccess?.session, alertEnabled, stopAlarmSound]);

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
      if (detail.enabled !== true) stopAlarmSound();
    }

    window.addEventListener(settingsUpdateEvent, handleSettingsUpdate);
    return () => window.removeEventListener(settingsUpdateEvent, handleSettingsUpdate);
  }, [stopAlarmSound]);

  useEffect(() => {
    function handleOrdersUpdated() {
      void refreshOrders();
    }

    window.addEventListener(ordersUpdatedEvent, handleOrdersUpdated);
    return () => window.removeEventListener(ordersUpdatedEvent, handleOrdersUpdated);
  }, [refreshOrders]);

  useEffect(() => {
    if (!alertEnabled || incomingCount === 0) {
      stopAlarmSound();
      return;
    }

    if (alarmSound.current && alarmSound.current !== alertSound) {
      stopAlarmSound();
    }

    void startAlarmSound();
  }, [alertEnabled, alertSound, incomingCount, startAlarmSound, stopAlarmSound]);

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
    return () => {
      stopAlarmSound();
      void audioContext.current?.close();
    };
  }, [stopAlarmSound]);

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
