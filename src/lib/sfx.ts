type AudioContextLike = AudioContext;

let audioContext: AudioContextLike | null = null;

function getAudioContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

function resumeIfNeeded(context: AudioContextLike): void {
  if (context.state !== "suspended") return;
  void context.resume().catch(() => {
    // ignore
  });
}

function createNoiseBuffer(context: AudioContextLike, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index++) {
    const t = index / length;
    const fade = 1 - t;
    channel[index] = (Math.random() * 2 - 1) * fade;
  }
  return buffer;
}

function scheduleEnvelope(
  gainParam: AudioParam,
  startTime: number,
  peak: number,
  attackSeconds: number,
  releaseSeconds: number,
): void {
  const endTime = startTime + attackSeconds + releaseSeconds;
  gainParam.cancelScheduledValues(startTime);
  gainParam.setValueAtTime(0.0001, startTime);
  gainParam.linearRampToValueAtTime(Math.max(0.0001, peak), startTime + attackSeconds);
  gainParam.exponentialRampToValueAtTime(0.0001, endTime);
}

export function playPop(): void {
  const context = getAudioContext();
  if (!context) return;
  resumeIfNeeded(context);

  const startTime = context.currentTime;
  const output = context.createGain();
  output.gain.value = 0.22;
  output.connect(context.destination);

  const envelope = context.createGain();
  scheduleEnvelope(envelope.gain, startTime, 1, 0.006, 0.09);
  envelope.connect(output);

  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(240, startTime);
  osc.frequency.exponentialRampToValueAtTime(85, startTime + 0.1);
  const oscGain = context.createGain();
  oscGain.gain.value = 0.7;
  osc.connect(oscGain).connect(envelope);

  const noise = context.createBufferSource();
  noise.buffer = createNoiseBuffer(context, 0.06);
  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1700;
  bandpass.Q.value = 0.8;
  const noiseGain = context.createGain();
  scheduleEnvelope(noiseGain.gain, startTime, 0.35, 0.002, 0.05);
  noise.connect(bandpass).connect(noiseGain).connect(envelope);

  osc.start(startTime);
  osc.stop(startTime + 0.12);
  noise.start(startTime);
  noise.stop(startTime + 0.07);
}

export function playDing(): void {
  const context = getAudioContext();
  if (!context) return;
  resumeIfNeeded(context);

  const startTime = context.currentTime;
  const output = context.createGain();
  output.gain.value = 0.18;
  output.connect(context.destination);

  const envelope = context.createGain();
  scheduleEnvelope(envelope.gain, startTime, 1, 0.01, 0.55);

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 5200;
  lowpass.Q.value = 0.7;

  lowpass.connect(envelope);
  envelope.connect(output);

  const mix = context.createGain();
  mix.gain.value = 0.9;
  mix.connect(lowpass);

  const osc1 = context.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, startTime);
  const gain1 = context.createGain();
  gain1.gain.value = 0.75;
  osc1.connect(gain1).connect(mix);

  const osc2 = context.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(1320, startTime);
  const gain2 = context.createGain();
  gain2.gain.value = 0.25;
  osc2.connect(gain2).connect(mix);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + 0.65);
  osc2.stop(startTime + 0.65);
}

function scheduleTone(
  context: AudioContextLike,
  mix: GainNode,
  frequency: number,
  startTime: number,
  durationSeconds: number,
  peak: number,
  detuneCents = 0,
): void {
  const osc = context.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.detune.setValueAtTime(detuneCents, startTime);

  const env = context.createGain();
  scheduleEnvelope(env.gain, startTime, peak, 0.01, Math.max(0.05, durationSeconds - 0.01));

  osc.connect(env).connect(mix);

  osc.start(startTime);
  osc.stop(startTime + durationSeconds + 0.05);
}

export function playTada(): void {
  const context = getAudioContext();
  if (!context) return;
  resumeIfNeeded(context);

  const startTime = context.currentTime;
  const output = context.createGain();
  output.gain.value = 0.2;
  output.connect(context.destination);

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 20;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.12;
  compressor.connect(output);

  const mix = context.createGain();
  mix.gain.value = 0.9;
  mix.connect(compressor);

  const notes = [
    { freq: 523.25, offset: 0.0, peak: 0.9 },
    { freq: 659.25, offset: 0.07, peak: 0.8 },
    { freq: 783.99, offset: 0.14, peak: 0.75 },
    { freq: 1046.5, offset: 0.21, peak: 0.7 },
  ];

  for (const { freq, offset, peak } of notes) {
    scheduleTone(context, mix, freq, startTime + offset, 0.65, peak, -6);
    scheduleTone(context, mix, freq, startTime + offset, 0.65, peak * 0.35, 6);
  }

  scheduleTone(context, mix, 261.63, startTime, 0.7, 0.35, 0);
}

