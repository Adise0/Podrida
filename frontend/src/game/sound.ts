// The game's few sounds, synthesized so there are no files to load: a soft chime for "your turn",
// and a short tick for a card hitting the table.
let context: AudioContext | null = null;

const getContext = () => {
  if (typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  // Browsers start it suspended until the page has been interacted with.
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
};

const tone = (frequency: number, startIn: number, duration: number, volume: number) => {
  const audio = getContext();
  if (!audio) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + startIn;

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
};

export const playChime = () => {
  tone(880, 0, 0.6, 0.08);
  tone(1320, 0.12, 0.7, 0.06);
};

export const playCardTick = () => {
  tone(240, 0, 0.08, 0.05);
};
