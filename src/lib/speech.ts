export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function pickChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const zhVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("zh"));
  return (
    zhVoices.find((voice) => voice.lang.toLowerCase() === "zh-cn") ??
    zhVoices.find((voice) => voice.lang.toLowerCase().startsWith("zh-")) ??
    zhVoices[0]
  );
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const enVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  return (
    enVoices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    enVoices.find((voice) => voice.lang.toLowerCase().startsWith("en-")) ??
    enVoices[0]
  );
}

async function getVoices(timeoutMs = 800): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length > 0) return immediate;

  return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const onVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    };

    synth.addEventListener("voiceschanged", onVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    }, timeoutMs);
  });
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

async function speakSequence(
  texts: string[],
  voicePicker: (voices: SpeechSynthesisVoice[]) => SpeechSynthesisVoice | undefined,
  fallbackLang: string,
  options: SpeakOptions = {},
): Promise<void> {
  if (!isSpeechSupported()) return;

  const { rate = 0.95, pitch = 1, volume = 1 } = options;
  const synth = window.speechSynthesis;

  synth.cancel();

  const voices = await getVoices();
  const voice = voicePicker(voices);

  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    const utterance = new SpeechSynthesisUtterance(trimmed);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? fallbackLang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    synth.speak(utterance);
  }
}

export async function speakChineseSequence(
  texts: string[],
  options: SpeakOptions = {},
): Promise<void> {
  await speakSequence(texts, pickChineseVoice, "zh-CN", options);
}

export async function speakEnglishSequence(
  texts: string[],
  options: SpeakOptions = {},
): Promise<void> {
  await speakSequence(texts, pickEnglishVoice, "en-US", options);
}
