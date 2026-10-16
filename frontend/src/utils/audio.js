/**
 * SafeGuard AI — Web Audio API Synthesizer
 * Generates an authentic industrial 2.4 kHz pulsed piezo warning buzzer sound
 * when the ESP32 firmware enters STATE_ALARM.
 */

let audioCtx = null;
let beepInterval = null;
let isAudioEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSingleBeep(frequency = 2400, duration = 0.12) {
  if (!isAudioEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square'; // Harsh square wave mimics industrial piezo transducers
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Envelope for sharp click-free pulse
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn("Web Audio playback error:", err);
  }
}

export function startAlarmBuzzer() {
  if (beepInterval) return; // Already alarming
  playSingleBeep(2400, 0.15);
  beepInterval = setInterval(() => {
    playSingleBeep(2400, 0.15);
  }, 350); // Pulsing at ~2.8 Hz
}

export function stopAlarmBuzzer() {
  if (beepInterval) {
    clearInterval(beepInterval);
    beepInterval = null;
  }
}

export function setAudioEnabled(enabled) {
  isAudioEnabled = enabled;
  if (!enabled) {
    stopAlarmBuzzer();
  }
}

export function getAudioEnabled() {
  return isAudioEnabled;
}
