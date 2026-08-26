export const newOrderSoundOptions = [
  {
    id: "classic-bell",
    label: "Classic bell",
    helper: "Clear and balanced for regular kitchen alerts.",
    steps: [
      { frequency: 880, startMs: 0, durationMs: 95, wave: "square", gain: 0.38 },
      { frequency: 1175, startMs: 110, durationMs: 95, wave: "triangle", gain: 0.4 },
      { frequency: 1568, startMs: 220, durationMs: 110, wave: "square", gain: 0.36 },
      { frequency: 1175, startMs: 350, durationMs: 105, wave: "triangle", gain: 0.34 },
    ],
  },
  {
    id: "kitchen-chime",
    label: "Kitchen chime",
    helper: "Softer chime that is pleasant for longer shifts.",
    steps: [
      { frequency: 659, startMs: 0, durationMs: 150, wave: "sine", gain: 0.34 },
      { frequency: 880, startMs: 155, durationMs: 150, wave: "sine", gain: 0.34 },
      { frequency: 1175, startMs: 310, durationMs: 190, wave: "triangle", gain: 0.32 },
      { frequency: 1568, startMs: 530, durationMs: 240, wave: "sine", gain: 0.28 },
    ],
  },
  {
    id: "urgent-pulse",
    label: "Urgent pulse",
    helper: "Sharper pulse for noisy counters and rush hours.",
    steps: [
      { frequency: 988, startMs: 0, durationMs: 80, wave: "square", gain: 0.42 },
      { frequency: 988, startMs: 130, durationMs: 80, wave: "square", gain: 0.42 },
      { frequency: 784, startMs: 260, durationMs: 80, wave: "sawtooth", gain: 0.34 },
      { frequency: 1175, startMs: 390, durationMs: 90, wave: "square", gain: 0.4 },
      { frequency: 1568, startMs: 520, durationMs: 120, wave: "triangle", gain: 0.38 },
    ],
  },
  {
    id: "whatsapp-incoming",
    label: "WhatsApp incoming",
    helper: "Uploaded WhatsApp audio for a familiar incoming-order alert.",
    audioSrc: "/order-sounds/whatsapp-new-order.mpeg",
    durationMs: 2400,
    steps: [],
  },
] as const;

export type NewOrderSound = (typeof newOrderSoundOptions)[number]["id"];

export const defaultNewOrderSound: NewOrderSound = "classic-bell";

export const newOrderSoundIds = newOrderSoundOptions.map((option) => option.id) as [
  NewOrderSound,
  ...NewOrderSound[],
];

export type NewOrderSoundStep = {
  frequency: number;
  startMs: number;
  durationMs: number;
  wave: OscillatorType;
  gain: number;
};

export function isNewOrderSound(value: unknown): value is NewOrderSound {
  return newOrderSoundOptions.some((option) => option.id === value);
}

export function getNewOrderSound(value: unknown): NewOrderSound {
  return isNewOrderSound(value) ? value : defaultNewOrderSound;
}

export function getNewOrderSoundSteps(sound: NewOrderSound): readonly NewOrderSoundStep[] {
  return newOrderSoundOptions.find((option) => option.id === sound)?.steps ?? newOrderSoundOptions[0].steps;
}

export function getNewOrderSoundAudioSrc(sound: NewOrderSound) {
  const option = newOrderSoundOptions.find((item) => item.id === sound);
  return option && "audioSrc" in option ? option.audioSrc : undefined;
}

export function getNewOrderSoundDurationMs(sound: NewOrderSound) {
  const option = newOrderSoundOptions.find((item) => item.id === sound);
  return option && "durationMs" in option ? option.durationMs : 850;
}
